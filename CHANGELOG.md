# Changelog

## v0.4.0

MCP-first interface, decision memory v2, the procurement demo, and a bake suite.

### Added
- **Real MCP server** (`design-memory mcp`, stdio) with seven tools: `dm_get_context`, `dm_audit_diff`, `dm_suggest_token`, `dm_record_decision`, `dm_get_decisions`, `dm_get_tokens`, `dm_get_contract`; eight resources; three workflow prompts. Compact envelope responses with detail levels and byte budgets asserted in tests.
- **Decision memory v2** (`decisions.json` + append-only log): kinds (intentional, exception, decision), targets (file, glob, component, tokenPath, value, fingerprint), expiry, token-dependency invalidation, supersede chains, precedence resolution, atomic writes, repair from the log, and automatic migration from `reviews.json`.
- **API facade** (`src/lib/api.ts`) shared by CLI and MCP, so the agent surface and the CLI can never drift apart.
- **Structured errors** (`DM_E_*` codes with hints) across CLI and MCP.
- **Demo app** `apps/procure-dash`: Northwind Procurement Console (React 19, Vite 6, Tailwind v4), token system, six component contracts, seeded decision memory, baseline of accepted legacy drift, and loading/empty/error states.
- **Bake suite** (`npm run bake`): fourteen end-to-end scenarios that simulate agent edits, stage them, and assert the exact audit outcome.
- `memory list|add|expire|repair` commands; `--reason` blocklist against placeholder decisions.

### Changed
- `assembleAudit` now computes decisions-aware statuses: suppressed findings report `intentional`/`ignored` plus `suppressedBy`, and expiry or invalidation reopens the finding.
- Class tokens are now extracted from `cn()`, `clsx()`, and similar helpers, including conditional and template expressions.
- Running in a subdirectory of a monorepo scopes git diffs and staged content to that directory (`--relative`, `:./path`).
- Component contract rules apply only to the component's own file, not to consumer pages that merely import it.
- Finding evidence is a capped excerpt instead of the whole diff.
- Node 20+ required; CI runs 20 and 22 with typecheck, build, lint, tests, MCP protocol tests, bake scenarios, and a package smoke test.
- `readConfig` failures now raise structured `DM_E_NO_CONFIG` errors with hints.

### Fixed
- Baselines no longer mask a finding that was previously suppressed by a decision but whose decision was later expired or invalidated.

## v0.3.0 (unreleased)

DTCG + agent pack + the memory story.

### Added
- `sync-reference` reads W3C DTCG `tokens.json` (`sourceType: "dtcg"`), including nested groups, `$type` inference, `{ref}` alias relationships, and automatic code hints (`color.primary` → `bg-primary`, `text-primary`, `border-primary`).
- Optional `reference.designMdPath`: tokens from DTCG, component contracts from DESIGN.md.
- DESIGN.md spec alignment (Google Stitch format): numbered sections, color roles, component bullets, token tables; `ghost --format design-md` exports a spec-aligned DESIGN.md that round-trips losslessly.
- Ghost v2: `ghost --write` generates the agent design pack — `.cursor/rules/design.mdc`, CLAUDE.md/AGENTS.md/copilot-instructions.md/.clinerules marker sections, `design-tokens.md`, DESIGN.md — idempotent, dry-run by default.
- Closest-token suggestions on every finding: `Replace p-[9px] with p-sm (token spacing.sm)`.
- Stale-reference warning (7 days) in human and JSON output (`warnings`).
- `review --export` markdown ledger; `compare` human printout; `baselineCreated` flag and baseline summary.
- Exit code 2 for missing reference snapshot (0 clean / 1 drift / 2 misconfig).
- Live demo repo `derinbarutcu17/design-memory-demo` with a real blocked PR (inline annotations).
- Showcase v2: real Vite + React + Tailwind v4 app, 6-act demo script.

### Fixed
- Issue-key collision in reopen detection: key now includes `found`, so distinct findings (e.g. className hex vs inline style hex) never mislabel each other as reopened.
- `scan --pr` file content fetch: `gh api` contents ref via query string (form encoding broke GET).
- GitHub Action sets `GH_TOKEN` for the `gh` CLI inside Actions.

## v0.2.0

AST engine + Tailwind v4 theme backing.

### Added
- Deterministic AST style rules (`className`/`style` JSX only) with 1-based line/column.
- Tailwind v4 `@theme` token backing: arbitrary values defined by the repo's own theme pass.
- Net-new-only baseline + review memory with reopen detection; `audit --create-baseline`.
- PR scan via `gh` CLI (`scan --pr`), GitHub Action with inline annotations, MCP + agent plugin surfaces.

## v0.1.0

Initial deterministic CLI.

### Added
- `init`, `sync-reference`, `audit`, `review`, `compare`, `ghost` commands.
- DESIGN.md/Stitch/Figma reference normalization into a canonical snapshot.
- Baseline and review state in `.design-memory/`.
- 26-test regression suite, CI on Node 18/20/22.
