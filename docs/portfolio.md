# Design Memory — portfolio brief

## The pitch (3 sentences)

Design Memory is a deterministic gate between a design system and the AI agents that write frontend code: it parses the repo's design truth (W3C DTCG `tokens.json`, `DESIGN.md`, Tailwind v4 `@theme`), diff-scopes every check to lines actually changed in a PR, and blocks net-new drift before a human reviews it. It ships three enforcement surfaces — a pre-commit hook, a GitHub Action with inline PR annotations, and an `audit --json` contract agents parse directly — and remembers baseline and review decisions so adoption on brownfield codebases never blocks the backlog. It is local-first, deterministic, zero telemetry, and the first tool in the niche to speak the 2026 DTCG token pipeline end to end.

## The metrics

- Deterministic AST checks (`className`/`style` only), 1-based line/column, no LLM required
- Net-new-only enforcement: baseline + review memory, reopen detection, stable fingerprints
- DTCG-native: reads the exact `tokens.json` Tokens Studio and Figma export; DESIGN.md authoring via `ghost --format design-md`
- Three surfaces: pre-commit hook / GitHub Action / agent loop (MCP + CLI)
- 26-test regression floor, CI on Node 18/20/22, live demo PR with real annotations

## The story arc

1. **Found the gap.** Research showed the 2026 problem is agents destroying design systems ("the 80% problem", "five design systems" wall, Builder.io's "make wrong paths fail mechanically") — while DTCG Design Tokens 2025.10 went stable backed by Adobe/Google/Meta/Figma, and DESIGN.md became a real spec. Direct competitors (ds-lint, drift-guard, design-lint) are tiny and fragmented; the enforcement slot between design docs and agent output was empty.
2. **Built the gate.** A local-first CLI: snapshot the design truth, audit only net-new drift with deterministic rules, remember review decisions.
3. **Proved it live.** [PR #1](https://github.com/derinbarutcu17/design-memory-demo/pull/1) on a public demo repo introduced raw hex, arbitrary padding/radius, and an inline style; the GitHub Action failed the check with inline annotations on the exact lines — reproducible by anyone in 5 minutes, at a quality the competitors can't match.

## Links

- Repo: https://github.com/derinbarutcu17/DesignMemory
- Live demo PR: https://github.com/derinbarutcu17/design-memory-demo/pull/1
- npm: `@derin/design-memory` — package name reserved, publish pending (needs `npm login`)

## Later (not now)

LinkedIn carousel + portfolio site entry once the repo is live and the package is published.
