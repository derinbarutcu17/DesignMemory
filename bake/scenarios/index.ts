import fs from 'node:fs';
import path from 'node:path';

import { syncReference } from '../../src/lib/reference';
import type { BakeScenario } from '../harness';

const DATA_TABLE = 'src/ui/DataTable.tsx';
const DRAWER = 'src/ui/Drawer.tsx';
const ALERT = 'src/ui/AlertBanner.tsx';
const STATUS_BADGE = 'src/ui/StatusBadge.tsx';
const LEGACY = 'src/legacy/SupplierRiskNote.tsx';

export const scenarios: BakeScenario[] = [
  {
    id: 'b01-raw-hex',
    title: 'Agent adds a raw hex accent to the supplier table',
    prompt: 'Add a savings opportunity column to the supplier table with a muted teal accent.',
    mutations: [
      { kind: 'replace', file: DATA_TABLE, find: 'overflow-x-auto rounded-md border border-border bg-surface', replace: 'overflow-x-auto rounded-md border border-border bg-surface text-[#0f766e]' },
    ],
    expect: {
      exitCode: 1,
      wouldBlock: true,
      issues: [{ ruleId: 'color.raw-hex', status: 'new', file: DATA_TABLE }],
    },
  },
  {
    id: 'b02-arbitrary-spacing',
    title: 'Agent compresses drawer padding with an off-scale value',
    prompt: 'Make the contract drawer padding more compact.',
    mutations: [{ kind: 'replace', file: DRAWER, find: 'rounded-lg bg-surface p-6 shadow-overlay', replace: 'rounded-lg bg-surface p-[13px] shadow-overlay' }],
    expect: {
      exitCode: 1,
      wouldBlock: true,
      issues: [{ ruleId: 'tailwind.arbitrary-spacing', status: 'new', file: DRAWER }],
    },
  },
  {
    id: 'b03-inline-style',
    title: 'Agent nudges alert spacing with an inline style',
    prompt: 'Nudge the alert dot down slightly.',
    mutations: [
      {
        kind: 'replace',
        file: ALERT,
        find: 'className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true"',
        replace: 'className="h-2 w-2 shrink-0 rounded-full bg-current" style={{ marginTop: 9 }} aria-hidden="true"',
      },
    ],
    expect: {
      exitCode: 1,
      wouldBlock: true,
      issues: [{ ruleId: 'style.inline', status: 'new', file: ALERT }],
    },
  },
  {
    id: 'b04-arbitrary-radius',
    title: 'Agent adds a pill radius outside the scale',
    prompt: 'Give the status badge a softer capsule shape.',
    mutations: [{ kind: 'replace', file: STATUS_BADGE, find: 'rounded-full border px-2 py-1', replace: 'rounded-[20px] border px-2 py-1' }],
    expect: {
      exitCode: 1,
      wouldBlock: true,
      issues: [{ ruleId: 'tailwind.arbitrary-radius', status: 'new', file: STATUS_BADGE }],
    },
  },
  {
    id: 'b05-required-pattern',
    title: 'Agent removes a required token class from the drawer',
    prompt: 'Simplify the drawer surface styling.',
    mutations: [{ kind: 'replace', file: DRAWER, find: 'rounded-lg bg-surface p-6 shadow-overlay', replace: 'bg-surface p-6 shadow-overlay' }],
    expect: {
      exitCode: 1,
      wouldBlock: true,
      issues: [{ ruleId: 'component.required-pattern', status: 'new', file: DRAWER }],
    },
  },
  {
    id: 'b06-decision-suppresses',
    title: 'Recorded 13px decision keeps dense numbers unblocked',
    prompt: 'Use a slightly tighter numeral size for the savings column.',
    mutations: [{ kind: 'replace', file: DATA_TABLE, find: 'text-sm">', replace: 'text-sm text-[13px]">' }],
    expect: {
      exitCode: 0,
      wouldBlock: false,
      issues: [{ ruleId: 'tailwind.arbitrary-font-size', status: 'intentional', file: DATA_TABLE }],
    },
  },
  {
    id: 'b07-legacy-untouched',
    title: 'Editing a baselined legacy file does not re-block old drift',
    prompt: 'Add a clarifying comment to the legacy risk note.',
    mutations: [{ kind: 'append', file: LEGACY, content: '// reviewed during the FY26 migration\n' }],
    expect: {
      exitCode: 0,
      wouldBlock: false,
    },
  },
  {
    id: 'b08-legacy-net-new',
    title: 'Net-new drift inside a baselined legacy file still blocks',
    prompt: 'Add a highlighted risk value to the legacy note.',
    mutations: [
      {
        kind: 'append',
        file: LEGACY,
        content: 'export function RiskAccent() { return <span className="text-[#0b1220]">high</span>; }\n',
      },
    ],
    expect: {
      exitCode: 1,
      wouldBlock: true,
      issues: [{ ruleId: 'color.raw-hex', status: 'new', file: LEGACY }],
    },
  },
  {
    id: 'b09-token-change-invalidates',
    title: 'Changing the type scale invalidates the 13px decision',
    prompt: 'Bump the base font scale in the design tokens.',
    setup: async (sandbox) => {
      const tokensPath = path.join(sandbox, 'tokens.json');
      const tokens = fs.readFileSync(tokensPath, 'utf-8');
      fs.writeFileSync(tokensPath, tokens.replace('"sm": { "$value": "14px", "$type": "fontSize" }', '"sm": { "$value": "15px", "$type": "fontSize" }'));
      await syncReference(sandbox);
    },
    mutations: [{ kind: 'replace', file: DATA_TABLE, find: 'text-sm">', replace: 'text-sm text-[13px]">' }],
    expect: {
      exitCode: 0,
      wouldBlock: false,
      issues: [{ ruleId: 'tailwind.arbitrary-font-size', status: 'new', file: DATA_TABLE }],
    },
  },
  {
    id: 'b10-clean-pass',
    title: 'A new token-only component passes without findings',
    prompt: 'Add a small savings summary strip to the supplier page.',
    mutations: [
      {
        kind: 'write',
        file: 'src/ui/SavingsStrip.tsx',
        content: [
          'export function SavingsStrip({ label, value }: { label: string; value: string }) {',
          '  return (',
          '    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-2">',
          '      <span className="text-sm text-text-muted">{label}</span>',
          '      <span className="text-sm font-medium tabular-nums text-success">{value}</span>',
          '    </div>',
          '  );',
          '}',
          '',
        ].join('\n'),
      },
    ],
    expect: {
      exitCode: 0,
      wouldBlock: false,
      absentRuleIds: ['color.raw-hex', 'tailwind.arbitrary-spacing'],
    },
  },
  {
    id: 'b11-consumer-file',
    title: 'A consumer page does not inherit component contract rules',
    prompt: 'Wire the contracts page into a new secondary route.',
    mutations: [
      {
        kind: 'write',
        file: 'src/routes/Home.tsx',
        content: [
          'import { DataTable } from "../ui/DataTable";',
          '',
          'export function Home() {',
          '  return <DataTable columns={[{ id: "x", label: "X" }]}>{null}</DataTable>;',
          '}',
          '',
        ].join('\n'),
      },
    ],
    expect: {
      exitCode: 0,
      wouldBlock: false,
      absentRuleIds: ['component.required-pattern', 'component.disallowed-pattern', 'component.missing-state'],
    },
  },
  {
    id: 'b12-malformed-config',
    title: 'Malformed config fails with a structured error',
    prompt: 'Save the config after a bad edit.',
    setup: (sandbox) => {
      fs.writeFileSync(path.join(sandbox, 'design-memory.config.json'), '{\n  "strictness": "block",\n}\n');
    },
    mutations: [{ kind: 'append', file: LEGACY, content: '// touched\n' }],
    expect: { errorCode: 'DM_E_NO_CONFIG' },
  },
  {
    id: 'b13-missing-snapshot',
    title: 'Missing reference snapshot reports exit 2 with a hint',
    prompt: 'Run the gate before syncing the reference.',
    setup: (sandbox) => {
      fs.rmSync(path.join(sandbox, '.design-memory', 'reference-snapshot.json'));
    },
    mutations: [{ kind: 'append', file: LEGACY, content: '// touched\n' }],
    expect: { exitCode: 2, missingSnapshot: true },
  },
  {
    id: 'b14-large-diff',
    title: 'Forty changed files audit within the performance budget',
    prompt: 'Apply a formatting pass across generated supplier panels.',
    mutations: Array.from({ length: 20 }, (_, index) => ({
      kind: 'write' as const,
      file: `src/ui/generated/Panel${index}.tsx`,
      content: [
        `export function Panel${index}() {`,
        '  return (',
        '    <section className="rounded-lg border border-border bg-surface p-4">',
        '      <p className="text-sm text-text-muted">Generated panel {"' + index + '"}</p>',
        '    </section>',
        '  );',
        '}',
        '',
      ].join('\n'),
    })),
    expect: { exitCode: 0, wouldBlock: false },
    maxDurationMs: 8000,
  },
];
