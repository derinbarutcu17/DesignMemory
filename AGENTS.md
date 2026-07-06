# Design Memory Agent Guide

## Identity

Design Memory blocks net-new design policy violations and reference mismatches in React/Tailwind PRs using deterministic checks first.

This repo is a local-first CLI and review engine. It is not a visual QA platform and not a generic prompt wrapper.

## Core Rules

- Deterministic checks come first.
- Reference snapshots are the contract.
- Baselines should block only net-new or reopened drift.
- Keep the workflow PR-gate oriented.
- Prefer explicit rule checks over vague heuristics.
- Do not let the tool drift into a universal frontend linter.

## Repo Layout

- `src/cli` - Command-line entrypoints.
- `src/lib` - Core engine, policy, git, GitHub, context, and state logic.
- `src/lib/design-md` - Design.md normalization and parsing helpers.
- `src/lib/figma` - Figma extraction and normalization helpers.
- `src/lib/stitch` - Stitch parsing and normalization helpers.
- `examples/design-memory-showcase` - Demo app and showcase harness that runs the real engine against a temporary repo.
- `test/` - Unit and integration tests.
- `agent-plugin.json` - Plugin metadata.
- `mcp.json` - MCP surface definition.

## Important Docs

- `README.md` - Main workflow and command reference.
- `examples/design-memory-showcase/README.md` - Demo-specific notes.
- `examples/design-memory-showcase/DESIGN.md` - Reference design contract used by the showcase.

## Typical Workflow

1. Identify the reference source first.
2. Sync or normalize the reference snapshot before auditing.
3. Run the deterministic audit path before any optional fallback behavior.
4. Use baselines for adoption, not as a way to hide regressions.
5. Update tests when rules or normalization behavior changes.

## Common Commands

```bash
npm install
npm run build
npm test
npm run lint
```

Primary CLI flows:

```bash
design-memory init
design-memory sync-reference
design-memory audit
design-memory scan --pr=123
design-memory review
design-memory compare
design-memory ghost
```

Showcase flows:

```bash
npm run demo:design-memory:audit
npm run demo:design-memory:web
```

## Editing Guidance

- If you change rule behavior, update the examples and tests that demonstrate the rule.
- Keep reference normalization deterministic and explainable.
- Treat `DESIGN.md`, Stitch sources, and Figma-derived snapshots as different input forms that must converge to the same internal reference model.
- Keep CLI outputs stable enough for automated review workflows.
- If you add a new rule, make sure it has a clear default severity and a clear baseline story.

## What Not To Do

- Do not quietly turn on fuzzy, non-deterministic enforcement as the default.
- Do not let the demo path diverge from the real engine.
- Do not skip snapshot generation when the audit flow depends on it.
- Do not mix enforcement logic with UI polish code.

## Validation Mindset

This project is successful when an agent can compare current UI code to a reference, explain the drift in plain terms, and decide whether it is truly new. Preserve that clarity.
