import fs from 'node:fs';
import path from 'node:path';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getContract, getRules, getTokens, listDecisionsQuery } from '../lib/api';
import { readConfig } from '../lib/config';
import { loadReferenceSnapshot } from '../lib/state';
import { getDefaultCwd } from './defaults';

const MAX_TEXT = 32_000;

function readTextFile(cwd: string, filePath: string) {
  try {
    const text = fs.readFileSync(path.resolve(cwd, filePath), 'utf-8');
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n...[truncated]` : text;
  } catch {
    return null;
  }
}

function jsonContent(uri: URL, value: unknown) {
  return {
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
  };
}

export function registerResources(server: McpServer) {
  server.registerResource(
    'tokens',
    'dm://tokens',
    {
      title: 'Design tokens',
      description: 'All design tokens of the synced reference snapshot (path, value, class hint).',
      mimeType: 'application/json',
    },
    async (uri) => jsonContent(uri, getTokens({ cwd: getDefaultCwd(), detail: 'values', limit: 200 })),
  );

  server.registerResource(
    'token',
    new ResourceTemplate('dm://tokens/{path}', { list: undefined }),
    {
      title: 'Single design token',
      description: 'One token by DTCG path, for example dm://tokens/color.primary.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const tokenPath = String(variables.path ?? '');
      const result = getTokens({ cwd: getDefaultCwd(), detail: 'values', limit: 200 });
      const token = result.tokens.find((entry) => entry.path === tokenPath) ?? null;
      return jsonContent(uri, { token, found: Boolean(token) });
    },
  );

  server.registerResource(
    'design-md',
    'dm://design-md',
    {
      title: 'DESIGN.md',
      description: 'The raw design contract document from the repository.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const cwd = getDefaultCwd();
      const config = readConfig(cwd);
      const candidates = [config.reference.designMdPath, config.reference.path, 'DESIGN.md'].filter(
        (value): value is string => Boolean(value && value.endsWith('.md')),
      );
      for (const candidate of candidates) {
        const text = readTextFile(cwd, candidate);
        if (text !== null) {
          return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
        }
      }
      return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'No DESIGN.md found in this repository.' }] };
    },
  );

  server.registerResource(
    'rules',
    'dm://rules',
    {
      title: 'Policy rules',
      description: 'The active rule table with severities plus strictness and baseline mode.',
      mimeType: 'application/json',
    },
    async (uri) => jsonContent(uri, getRules(getDefaultCwd())),
  );

  server.registerResource(
    'contracts',
    'dm://contracts',
    {
      title: 'Component contract index',
      description: 'Names and summaries of all component contracts in the reference snapshot.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const snapshot = loadReferenceSnapshot(getDefaultCwd());
      const contracts = (snapshot?.components ?? []).map((component) => ({
        component: component.name,
        ...(component.summary ? { summary: component.summary } : {}),
        tokens: component.tokensUsed?.length ?? 0,
      }));
      return jsonContent(uri, { contracts, total: contracts.length });
    },
  );

  server.registerResource(
    'contract',
    new ResourceTemplate('dm://contracts/{component}', { list: undefined }),
    {
      title: 'Component contract',
      description: 'Full contract for one component, for example dm://contracts/DataTable.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const component = String(variables.component ?? '');
      try {
        return jsonContent(uri, getContract({ cwd: getDefaultCwd(), component }));
      } catch (error) {
        return jsonContent(uri, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  server.registerResource(
    'decisions',
    'dm://decisions',
    {
      title: 'Design decisions',
      description: 'All decision-memory entries (active, expired, invalidated, superseded).',
      mimeType: 'application/json',
    },
    async (uri) => jsonContent(uri, listDecisionsQuery({ cwd: getDefaultCwd(), status: 'all', limit: 100 })),
  );

  server.registerResource(
    'config',
    'dm://config',
    {
      title: 'Effective config',
      description: 'The effective design-memory.config.json for the default repository.',
      mimeType: 'application/json',
    },
    async (uri) => jsonContent(uri, readConfig(getDefaultCwd())),
  );
}
