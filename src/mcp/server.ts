import fs from 'node:fs';
import path from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { setDefaultCwd } from './defaults';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { registerAuditDiff } from './tools/audit-diff';
import { registerGetContext } from './tools/get-context';
import { registerGetContract } from './tools/get-contract';
import { registerGetDecisions } from './tools/get-decisions';
import { registerGetTokens } from './tools/get-tokens';
import { registerRecordDecision } from './tools/record-decision';
import { registerSuggestToken } from './tools/suggest-token';

function readVersion() {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function createServer() {
  const server = new McpServer({ name: 'design-memory', version: readVersion() });

  // Deterministic registration order keeps tools/list stable for prompt caching.
  registerGetContext(server);
  registerAuditDiff(server);
  registerSuggestToken(server);
  registerRecordDecision(server);
  registerGetDecisions(server);
  registerGetTokens(server);
  registerGetContract(server);

  registerResources(server);
  registerPrompts(server);

  return server;
}

export async function startMcpServer(options: { cwd?: string } = {}) {
  if (options.cwd) {
    setDefaultCwd(options.cwd);
  }
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
