import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { runAuditRequest } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerAuditDiff(server: McpServer) {
  server.registerTool(
    'dm_audit_diff',
    {
      title: 'Audit a diff for design drift',
      description:
        'Use after editing UI files to check for net-new design drift. Runs the deterministic audit and returns findings with exact file/line/column and a closest-token suggestion. Read-only by default (persist false). Set scope "files" with explicit paths when the repo is not a git repo or files are untracked. wouldBlock true means the change would be blocked by the configured gate.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        scope: z
          .enum(['staged', 'working', 'both', 'range', 'files'])
          .optional()
          .describe('Diff source. Default "staged" (git index).'),
        range: z.string().optional().describe('Required when scope is "range", for example "main...HEAD".'),
        files: z.array(z.string()).min(1).max(50).optional().describe('Required when scope is "files".'),
        detail: z.enum(['minimal', 'standard', 'full']).optional().describe('Response size. Default "standard".'),
        maxFindings: z.number().int().min(1).max(50).optional().describe('Max findings returned. Default 8.'),
        persist: z.boolean().optional().describe('Write the run to .design-memory. Default false.'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = await runAuditRequest({
          cwd: resolveCwd(args.cwd),
          scope: args.scope ?? 'staged',
          ...(args.range ? { range: args.range } : {}),
          ...(args.files ? { files: args.files } : {}),
          persist: args.persist ?? false,
          maxFindings: args.maxFindings ?? 8,
        });

        const detail = args.detail ?? 'standard';
        const issues = detail === 'minimal' ? [] : result.issues;

        const summary = result.skipped
          ? 'no changes in scope'
          : result.missingSnapshot
            ? 'no reference snapshot; run sync-reference'
            : `${result.totalIssues} finding(s), ${result.wouldBlock ? 'would block' : 'clean'}`;

        return toToolResult({
          v: 1,
          kind: 'audit',
          summary,
          data: {
            scope: result.scope,
            wouldBlock: result.wouldBlock,
            exitCode: result.exitCode,
            summary: result.summary,
            issues,
            ...(result.comparison ? { comparison: result.comparison } : {}),
            ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
            ...(result.truncated ? { totalIssues: result.totalIssues } : {}),
          },
          ...(result.truncated ? { truncated: true } : {}),
          refs: ['dm://decisions'],
          ...(result.wouldBlock
            ? { next: ['Call dm_suggest_token for each found value, apply the replacements, then call dm_audit_diff again.'] }
            : {}),
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
