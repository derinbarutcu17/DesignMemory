# Design Memory Showcase

A self-contained demo that runs the real Design Memory engine against a throwaway git repo. It is also a real Vite + React + Tailwind v4 app — the "clean" side of the story.

## Run it

```bash
npm install          # only needed for the app itself
npm run dev          # the app
npm run demo         # the 6-act audit story (builds the engine if needed)
```

From the repo root: `npm run demo:design-memory:audit`.

## The 6 acts

1. **Sync the design truth** — `tokens.json` (W3C DTCG) + `DESIGN.md` → reference snapshot.
2. **Baseline the brownfield** — pre-existing drift is accepted; only net-new drift blocks from here on.
3. **Clean pass** — a new token-correct component stages with zero findings.
4. **Drift blocked** — raw hex, arbitrary padding/radius, and an inline style are caught with exact line:column and closest-token suggestions (`Replace p-[9px] with p-sm (token spacing.sm)`).
5. **Theme-backed arbitrary values pass** — values defined in the repo's own `@theme` are allowed.
6. **Review memory** — a finding marked `intentional` stops blocking every future run.

## Layout

- `tokens.json` — DTCG token file (the design truth, Tokens Studio / Figma export format)
- `DESIGN.md` — component contracts (Button, Input, Card, Badge) in the aligned format
- `design-memory.config.json` — dtcg source + designMdPath
- `src/styles/theme.css` — Tailwind v4 `@theme` generated from the tokens
- `src/components/` — clean, token-correct components
- `drift/` — the drift variants the demo stages
- `scripts/demo.sh` — the 6-act harness against `dist/`

## Trying it on your own repo

```bash
design-memory init
design-memory sync-reference
git add .
design-memory audit
```

Or add the GitHub Action for PR-gate enforcement (see the main README — the live demo repo `derinbarutcu17/design-memory-demo` runs it on every PR).
