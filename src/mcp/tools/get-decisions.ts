import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { listDecisionsQuery } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerGetDecisions(server: McpServer) {
  server.registerTool(
    'dm_get_decisions',
    {
      title: 'List design decisions',
      description:
        'Use before changing an area that may already be governed by an accepted decision, or when a finding looks intentional. Returns compact decisions with reasons, statuses (active, expired, invalidated, superseded), and expiry dates.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        status: z
          .enum(['active', 'expired', 'invalidated', 'superseded', 'all'])
          .optional()
          .describe('Filter by status. Default "active".'),
        ruleId: z.string().optional().describe('Filter by policy rule id.'),
        path: z.string().optional().describe('Filter by repo-relative file path.'),
        component: z.string().optional().describe('Filter by component name.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max decisions. Default 10.'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = listDecisionsQuery({
          cwd: resolveCwd(args.cwd),
          ...(args.status ? { status: args.status } : {}),
          ...(args.ruleId ? { ruleId: args.ruleId } : {}),
          ...(args.path ? { path: args.path } : {}),
          ...(args.component ? { component: args.component } : {}),
          limit: args.limit ?? 10,
        });
        return toToolResult({
          v: 1,
          kind: 'decisions',
          summary: `${result.total} decision(s)`,
          data: { decisions: result.decisions, total: result.total },
          refs: ['dm://decisions'],
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
