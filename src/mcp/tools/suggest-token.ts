import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { suggestToken } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerSuggestToken(server: McpServer) {
  server.registerTool(
    'dm_suggest_token',
    {
      title: 'Suggest a design token for a raw value',
      description:
        'Use when a raw value must be replaced with a system token, for example audit findings or values the agent is about to write. Returns the exact token when the value already matches one, otherwise up to 3 nearest tokens with a score. Deterministic, no LLM.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        value: z.string().min(1).max(64).describe('The offending value, for example "#0f766e" or "13px".'),
        kind: z
          .enum(['color', 'spacing', 'radius', 'fontSize', 'shadow'])
          .describe('Token family to search.'),
        context: z.string().optional().describe('Optional repo-relative file to prefer tokens already used there.'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = suggestToken({
          cwd: resolveCwd(args.cwd),
          value: args.value,
          kind: args.kind,
          ...(args.context ? { context: args.context } : {}),
        });
        const best = result.exact ?? result.near[0];
        const summary = best
          ? `replace ${result.value} with ${best.classHint} (token ${best.path})`
          : `no token within threshold for ${result.value}`;
        return toToolResult({
          v: 1,
          kind: 'suggest',
          summary,
          data: result,
          refs: ['dm://tokens'],
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
