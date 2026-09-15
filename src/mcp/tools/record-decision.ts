import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { recordDecisionRequest } from '../../lib/api';
import { resolveCwd } from '../defaults';
import { envelopeOutputSchema, toToolError, toToolResult } from '../envelope';

export function registerRecordDecision(server: McpServer) {
  server.registerTool(
    'dm_record_decision',
    {
      title: 'Record a design decision',
      description:
        'Use only after a human or the team agrees that a finding is intentional. Records a decision in .design-memory/decisions.json so the finding stops blocking and future agents retrieving context see the reason. Requires a specific target and a real reason (min 10 chars). Set dryRun true to preview the suppression effect without writing.',
      inputSchema: {
        cwd: z.string().optional().describe('Repository root. Defaults to the server working directory.'),
        kind: z.enum(['intentional', 'exception', 'decision']).describe('Decision type.'),
        ruleId: z.string().min(1).max(120).describe('Policy rule id the decision applies to, or "*" for any rule.'),
        target: z
          .object({
            file: z.string().optional().describe('Repo-relative file path.'),
            glob: z.string().optional().describe('Glob like "src/ui/SupplierMark.tsx" or "src/legacy/**".'),
            component: z.string().optional().describe('Component name from the reference snapshot.'),
            tokenPath: z.string().optional().describe('DTCG token path, for example "fontSize.sm".'),
            value: z.string().optional().describe('Specific offending value, for example "13px" or "#0f766e".'),
            fingerprint: z.string().optional().describe('Exact finding fingerprint (usually for migrated reviews).'),
          })
          .describe('At least one field is required.'),
        reason: z.string().min(10).max(500).describe('Why the deviation is intentional.'),
        author: z.string().min(1).max(64).describe('Who recorded this, for example "human:derin".'),
        expiresAt: z.string().optional().describe('ISO date when the decision expires.'),
        tokenDependency: z
          .array(z.string())
          .max(5)
          .optional()
          .describe('Token paths; the decision invalidates if any token value changes.'),
        supersedes: z.string().optional().describe('Decision id to supersede.'),
        dryRun: z.boolean().optional().describe('Preview without writing. Default false.'),
      },
      outputSchema: envelopeOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = await recordDecisionRequest({
          cwd: resolveCwd(args.cwd),
          kind: args.kind,
          ruleId: args.ruleId,
          target: args.target,
          reason: args.reason,
          author: args.author,
          ...(args.expiresAt ? { expiresAt: args.expiresAt } : {}),
          ...(args.tokenDependency ? { tokenDependency: args.tokenDependency } : {}),
          ...(args.supersedes ? { supersedes: args.supersedes } : {}),
          dryRun: args.dryRun ?? false,
        });
        return toToolResult({
          v: 1,
          kind: 'decisions',
          summary: result.decisionSummary,
          data: {
            action: result.action,
            id: result.decision.id,
            effect: result.effect,
            suppressesNow: result.suppressesNow,
            ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
          },
          refs: ['dm://decisions'],
          next: ['Re-run dm_audit_diff to confirm the finding no longer blocks.'],
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
