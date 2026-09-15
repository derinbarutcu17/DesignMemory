import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getContext } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerGetContext(server: McpServer) {
  server.registerTool(
    'dm_get_context',
    {
      title: 'Get design context for files',
      description:
        'Use when about to write or edit UI files (React/Tailwind). Returns the design tokens, component contracts, active design decisions, and policy rules relevant to the given repo-relative paths. Call this before generating UI code, then call dm_audit_diff after editing. Set detail "minimal" for the smallest possible reply.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        paths: z.array(z.string()).min(1).max(20).describe('Repo-relative files the agent is about to touch.'),
        task: z.string().max(200).optional().describe('Short description of the change.'),
        detail: z.enum(['minimal', 'standard', 'full']).optional().describe('Response size. Default "standard".'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = getContext({
          cwd: resolveCwd(args.cwd),
          paths: args.paths,
          ...(args.task ? { task: args.task } : {}),
          detail: args.detail ?? 'standard',
        });
        return toToolResult({
          v: 1,
          kind: 'context',
          summary: result.summary,
          data: {
            files: result.files,
            tokens: result.tokens,
            contracts: result.contracts,
            decisions: result.decisions,
            rules: result.rules,
            strictness: result.strictness,
          },
          refs: result.refs,
          ...(result.warnings.length > 0 ? { next: result.warnings } : {}),
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
