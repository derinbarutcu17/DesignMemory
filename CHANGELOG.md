# Changelog

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
