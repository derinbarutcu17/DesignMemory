# Meeting notes: Design Memory 0.4 (Delvo)

## One paragraph

Design Memory is the deterministic memory and guardrail layer between a design system and the agents writing frontend code. It blocks net-new drift (raw hex, off-scale spacing/radius, inline styles, contract violations) with exact line/column and a closest-token suggestion, and it serves agents the same design truth over MCP before they write: tokens, component contracts, and prior decisions with reasons, expiry, and token dependencies. Net-new-only enforcement via baseline plus decision memory means adoption on an existing codebase never blocks the backlog.

## What is in the repo now

- Real MCP server: `design-memory mcp` (stdio), 7 tools, 8 resources, 3 prompts, compact envelopes, byte budgets asserted in `test/mcp/`.
- Decision memory v2: `.design-memory/decisions.json` plus an append-only log; expiry, invalidation on token change, supersede chains, deterministic precedence, auto-migration from `reviews.json`, `memory repair`.
- Procurement demo app: `apps/procure-dash` (React 19, Vite 6, Tailwind v4), 36 DTCG tokens, 6 contracts, baseline of 2 legacy findings, 3 seeded decisions, loading/empty/error states.
- Bake suite: 14 end-to-end agent-edit scenarios (`npm run bake`), including legacy-file net-new drift, decision suppression, token-change invalidation, consumer-file isolation, malformed config, missing snapshot, and a 40-file performance budget.
- Quality gates: typecheck, lint, 49 tests, 8 MCP tests, 14 bake scenarios, package smoke test; CI on Node 20/22.
- Graphics in `docs/graphics/` and a 60-second motion piece in `docs/video/`.

## Answers to likely questions

- "Is the gate an LLM?" No. Regex, AST, and contract checks. The optional LLM layer is off by default and never blocks.
- "How is this different from a linter?" Linting is per-file style. Design Memory is a design-system contract with memory: baseline, decisions, expiry, and agent context retrieval.
- "Will it spam us on our existing repo?" No: baseline first, then only net-new or reopened findings block. Accepted deviations are recorded with reasons.
- "How do agents consume it?" Over MCP: `dm_get_context` before edits, `dm_audit_diff` after, `dm_suggest_token` to repair, `dm_record_decision` only after human approval.
- "What does it not do?" Vue/Svelte, visual diffing, remote MCP transport, multi-config monorepos. Listed in the README limitations section.

## Where it would fit at Delvo

- UI consistency while several people and agents ship fast: the gate and the memory both live in the repo, no cloud.
- Agent workflows: MCP context for any coding agent the team uses; deterministic checks in CI.
- Expert-facing product surfaces: the demo app shows dense tables, statuses, and agent-driven edits on a procurement-shaped dashboard.
