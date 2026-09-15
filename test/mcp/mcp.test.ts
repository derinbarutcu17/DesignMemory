import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { makeTempDir, writeConfig, writeSnapshot } from '../helpers';

const TOOL_NAMES = [
  'dm_get_context',
  'dm_audit_diff',
  'dm_suggest_token',
  'dm_record_decision',
  'dm_get_decisions',
  'dm_get_tokens',
  'dm_get_contract',
];

function makeSandbox() {
  const cwd = makeTempDir('design-memory-mcp-');
  writeConfig(cwd);
  writeSnapshot(cwd);
  fs.mkdirSync(path.join(cwd, 'src/components'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, 'src/components/Button.tsx'),
    'export function Button() { return <button className="bg-[#ff0000] hover:bg-primary" />; }\n',
  );
  return cwd;
}

async function withServer(sandbox: string, fn: (client: Client) => Promise<void>) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', path.join(process.cwd(), 'src/cli/index.ts'), 'mcp', '--cwd', sandbox],
    cwd: process.cwd(),
    stderr: 'pipe',
  });
  const client = new Client({ name: 'design-memory-test', version: '1.0.0' });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

function textOf(result: { content: unknown }) {
  const content = result.content as Array<{ type: string; text: string }>;
  return content.find((entry) => entry.type === 'text')?.text ?? '';
}

test('mcp: tools, resources, and prompts are registered deterministically', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      TOOL_NAMES,
    );
    for (const tool of tools.tools) {
      assert.ok(tool.description && tool.description.length > 40, `${tool.name} has a description`);
      assert.ok(tool.outputSchema, `${tool.name} declares an output schema`);
    }

    const resources = await client.listResources();
    assert.equal(resources.resources.length, 6);
    const templates = await client.listResourceTemplates();
    assert.equal(templates.resourceTemplates.length, 2);

    const prompts = await client.listPrompts();
    assert.deepEqual(
      prompts.prompts.map((prompt) => prompt.name).sort(),
      ['dm/fix-drift', 'dm/implement-component', 'dm/review-drift'],
    );
  });
});

test('mcp: dm_get_tokens is deterministic and within budget', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const first = await client.callTool({ name: 'dm_get_tokens', arguments: {} });
    const second = await client.callTool({ name: 'dm_get_tokens', arguments: {} });
    assert.equal(textOf(first), textOf(second));
    assert.ok(textOf(first).length < 2500, 'token index stays under 2500 chars');

    const values = await client.callTool({
      name: 'dm_get_tokens',
      arguments: { type: 'color', detail: 'values' },
    });
    const parsed = JSON.parse(textOf(values));
    assert.equal(parsed.kind, 'tokens');
    assert.ok(parsed.data.tokens.length >= 1);
    assert.ok(parsed.data.tokens.every((token: { value?: string }) => token.value), 'values are present');
  });
});

test('mcp: dm_get_context returns tokens and contracts within budget', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const result = await client.callTool({
      name: 'dm_get_context',
      arguments: { paths: ['src/components/Button.tsx'] },
    });
    const text = textOf(result);
    assert.ok(text.length < 4096, `context stays under 4096 chars (was ${text.length})`);
    const parsed = JSON.parse(text);
    assert.equal(parsed.kind, 'context');
    assert.ok(parsed.data.contracts.some((contract: { component: string }) => contract.component === 'Button'));
    assert.ok(parsed.data.tokens.some((token: { path: string }) => token.path === 'color.button.primary'));

    const minimal = await client.callTool({
      name: 'dm_get_context',
      arguments: { paths: ['src/components/Button.tsx'], detail: 'minimal' },
    });
    assert.ok(textOf(minimal).length < 800, 'minimal context stays under 800 chars');
  });
});

test('mcp: dm_audit_diff blocks on net-new drift and errors cleanly without git', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const files = await client.callTool({
      name: 'dm_audit_diff',
      arguments: { scope: 'files', files: ['src/components/Button.tsx'] },
    });
    const parsed = JSON.parse(textOf(files));
    assert.equal(parsed.kind, 'audit');
    assert.equal(parsed.data.wouldBlock, true);
    assert.ok(parsed.data.issues.some((issue: { ruleId: string }) => issue.ruleId === 'color.raw-hex'));
    assert.ok(parsed.next?.[0]?.includes('dm_suggest_token'));

    const staged = await client.callTool({ name: 'dm_audit_diff', arguments: { scope: 'staged' } });
    assert.equal(staged.isError, true);
    const stagedParsed = JSON.parse(textOf(staged));
    assert.equal(stagedParsed.error.code, 'DM_E_NOT_GIT');
  });
});

test('mcp: dm_suggest_token finds exact and near tokens', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const exact = await client.callTool({
      name: 'dm_suggest_token',
      arguments: { value: '#00ff00', kind: 'color' },
    });
    const exactParsed = JSON.parse(textOf(exact));
    assert.equal(exactParsed.data.exact.path, 'color.button.primary');

    const near = await client.callTool({
      name: 'dm_suggest_token',
      arguments: { value: '#00fe00', kind: 'color' },
    });
    const nearParsed = JSON.parse(textOf(near));
    assert.ok(nearParsed.data.near.length >= 1);

    const unknownKind = await client.callTool({
      name: 'dm_suggest_token',
      arguments: { value: '13px', kind: 'nope' },
    });
    assert.equal(unknownKind.isError, true);
  });
});

async function callOrError(
  client: Client,
  request: Parameters<Client['callTool']>[0],
): Promise<{ isError?: boolean; text: string }> {
  try {
    const result = await client.callTool(request);
    return { isError: result.isError === true, text: textOf(result) };
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : String(error) };
  }
}

test('mcp: decision recording flow suppresses the finding end to end', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const shortReason = await callOrError(client, {
      name: 'dm_record_decision',
      arguments: {
        kind: 'intentional',
        ruleId: 'color.raw-hex',
        target: { file: 'src/components/Button.tsx' },
        reason: 'n/a',
        author: 'human:test',
      },
    });
    assert.equal(shortReason.isError, true);

    const placeholder = await callOrError(client, {
      name: 'dm_record_decision',
      arguments: {
        kind: 'intentional',
        ruleId: 'color.raw-hex',
        target: { file: 'src/components/Button.tsx' },
        reason: 'TODO TODO TODO',
        author: 'human:test',
      },
    });
    assert.equal(placeholder.isError, true);
    assert.match(placeholder.text, /placeholder|DM_E_INVALID_INPUT/);

    // Persist a run first so suppressesNow has findings to count against.
    await client.callTool({
      name: 'dm_audit_diff',
      arguments: { scope: 'files', files: ['src/components/Button.tsx'], persist: true },
    });

    const recorded = await client.callTool({
      name: 'dm_record_decision',
      arguments: {
        kind: 'intentional',
        ruleId: 'color.raw-hex',
        target: { file: 'src/components/Button.tsx', value: 'bg-[#ff0000]' },
        reason: 'Campaign artwork uses a dedicated red by brand direction.',
        author: 'human:test',
      },
    });
    const recordedParsed = JSON.parse(textOf(recorded));
    assert.equal(recordedParsed.data.action, 'created');
    assert.equal(recordedParsed.data.suppressesNow, 1);

    const decisions = await client.callTool({
      name: 'dm_get_decisions',
      arguments: { path: 'src/components/Button.tsx' },
    });
    const decisionsParsed = JSON.parse(textOf(decisions));
    assert.equal(decisionsParsed.data.total, 1);

    const audit = await client.callTool({
      name: 'dm_audit_diff',
      arguments: { scope: 'files', files: ['src/components/Button.tsx'] },
    });
    const auditParsed = JSON.parse(textOf(audit));
    const rawHex = auditParsed.data.issues.find((issue: { ruleId: string }) => issue.ruleId === 'color.raw-hex');
    assert.equal(rawHex.status, 'intentional');
    assert.ok(rawHex.suppressedBy);
  });
});

test('mcp: dm_get_contract resolves and reports missing components helpfully', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const found = await client.callTool({ name: 'dm_get_contract', arguments: { component: 'Button' } });
    const parsed = JSON.parse(textOf(found));
    assert.equal(parsed.data.component, 'Button');
    assert.ok(parsed.data.required.includes('bg-primary'));

    const missing = await callOrError(client, { name: 'dm_get_contract', arguments: { component: 'ZebraSystem' } });
    assert.equal(missing.isError, true);
    assert.match(missing.text, /DM_E_COMPONENT_NOT_FOUND/);
  });
});

test('mcp: malformed tool calls are rejected without killing the server', async () => {
  const sandbox = makeSandbox();
  await withServer(sandbox, async (client) => {
    const badArgs = await callOrError(client, { name: 'dm_get_context', arguments: { paths: [] } });
    assert.equal(badArgs.isError, true);

    const unknownTool = await callOrError(client, { name: 'dm_not_a_tool', arguments: {} });
    assert.equal(unknownTool.isError, true);

    const after = await client.callTool({ name: 'dm_get_tokens', arguments: {} });
    assert.equal(JSON.parse(textOf(after)).kind, 'tokens');
  });
});
