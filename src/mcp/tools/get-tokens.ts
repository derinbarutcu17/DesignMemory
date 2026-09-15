import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getTokens } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerGetTokens(server: McpServer) {
  server.registerTool(
    'dm_get_tokens',
    {
      title: 'List design tokens',
      description:
        'Use to browse the token vocabulary before writing styles. Default detail "index" returns token paths and class hints only; pass detail "values" to include values. Filter with type or a DTCG path prefix.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        type: z
          .enum(['color', 'spacing', 'radius', 'fontSize', 'shadow', 'fontFamily', 'other'])
          .optional()
          .describe('Token family filter.'),
        prefix: z.string().optional().describe('DTCG path prefix, for example "color." or "spacing.".'),
        detail: z.enum(['index', 'values']).optional().describe('Include values. Default "index".'),
        limit: z.number().int().min(1).max(200).optional().describe('Max tokens. Default 40.'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = getTokens({
          cwd: resolveCwd(args.cwd),
          ...(args.type ? { type: args.type } : {}),
          ...(args.prefix ? { prefix: args.prefix } : {}),
          detail: args.detail ?? 'index',
          limit: args.limit ?? 40,
        });
        return toToolResult({
          v: 1,
          kind: 'tokens',
          summary: `${result.total} token(s)${result.total > result.tokens.length ? `, showing ${result.tokens.length}` : ''}`,
          data: { tokens: result.tokens, total: result.total, types: result.types },
          refs: ['dm://tokens'],
          ...(result.total > result.tokens.length ? { truncated: true } : {}),
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
