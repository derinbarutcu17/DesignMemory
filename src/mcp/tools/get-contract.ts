import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getContract } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerGetContract(server: McpServer) {
  server.registerTool(
    'dm_get_contract',
    {
      title: 'Get a component contract',
      description:
        'Use before editing a known component. Returns its required patterns, disallowed patterns, states, variants, tokens used, and any active decisions attached to it or its file. Provide either component or file.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        component: z.string().optional().describe('Component name, for example "DataTable".'),
        file: z.string().optional().describe('Repo-relative file path, for example "src/ui/DataTable.tsx".'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = getContract({
          cwd: resolveCwd(args.cwd),
          ...(args.component ? { component: args.component } : {}),
          ...(args.file ? { file: args.file } : {}),
        });
        return toToolResult({
          v: 1,
          kind: 'contract',
          summary: `contract for ${result.component}${result.decisions.length > 0 ? `, ${result.decisions.length} decision(s)` : ''}`,
          data: result,
          refs: ['dm://contracts', `dm://contracts/${result.component}`],
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
