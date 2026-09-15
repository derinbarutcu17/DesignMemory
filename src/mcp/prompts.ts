import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'dm/implement-component',
    {
      title: 'Implement a component with design memory',
      description: 'Guides an agent: fetch context, honor contracts and decisions, edit, then audit the diff.',
      argsSchema: {
        task: z.string().describe('What should be built or changed.'),
        paths: z.string().describe('Comma-separated repo-relative files the agent will touch.'),
        component: z.string().optional().describe('Component name when known.'),
      },
    },
    ({ task, paths, component }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Task: ${task}`,
              `Files: ${paths}`,
              component ? `Component: ${component}` : undefined,
              '',
              'Workflow (follow in order):',
              `1. Call dm_get_context with paths="${paths}" and detail="standard".`,
              component ? `2. Call dm_get_contract with component="${component}".` : '2. Call dm_get_contract for the component you are about to edit.',
              '3. If a finding looks intentional, call dm_get_decisions before touching it.',
              '4. Write the code using only tokens and classes returned by the context calls, including required states.',
              '5. Call dm_audit_diff with the same paths (scope "files" if the repo has no git diff yet).',
              '6. For each finding, call dm_suggest_token and apply the replacement. Repeat until wouldBlock is false.',
              '7. Do not record decisions yourself; report findings that look intentional to the human instead.',
            ]
              .filter((line): line is string => line !== undefined)
              .join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'dm/fix-drift',
    {
      title: 'Fix design drift findings',
      description: 'Guides an agent through resolving audit findings with token-backed replacements.',
      argsSchema: {
        file: z.string().describe('Repo-relative file with findings.'),
        ruleId: z.string().optional().describe('Optional rule id to focus on.'),
      },
    },
    ({ file, ruleId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Fix design drift in ${file}${ruleId ? ` for rule ${ruleId}` : ''}.`,
              '',
              'Workflow:',
              '1. Call dm_audit_diff with scope "files" and files=["' + file + '"].',
              '2. For every finding, call dm_suggest_token with the found value and the correct kind.',
              '3. Apply the suggested class or token value exactly.',
              '4. Re-run dm_audit_diff until there are no new findings.',
              '5. If a finding cannot be fixed without breaking intent, call dm_get_decisions first; if no decision exists, stop and report it.',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'dm/review-drift',
    {
      title: 'Review a drift finding',
      description: 'Walks a human and agent through recording an intentional decision safely.',
      argsSchema: {
        file: z.string().describe('Repo-relative file with the finding.'),
      },
    },
    ({ file }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Review the design drift in ${file}.`,
              '',
              'Workflow:',
              `1. Call dm_get_decisions with path="${file}" to check for an existing decision.`,
              '2. Call dm_audit_diff with scope "files" to list current findings.',
              '3. Present the findings to the human and ask which should be accepted.',
              '4. Only after the human agrees, call dm_record_decision with a specific target, a real reason, and an expiry when the exception is temporary.',
              '5. Re-run dm_audit_diff to confirm the accepted finding no longer blocks.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
