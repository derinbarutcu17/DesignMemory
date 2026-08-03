# Design Memory Showcase

A self-contained demo that runs the real Design Memory engine against a throwaway git repo. No build step, no network, no dependencies beyond the repo's own `npm run build`.

## Run it

```bash
npm run build
npm run demo:design-memory:audit
```

## What you'll see

1. **Run 1** — a new, token-correct component (`Input.tsx`) passes with zero findings.
2. **Run 2** — `Button.tsx` gains drift (`rounded-[14px]`, inline `style={{ color: '#ff0000' }}`, missing hover state). The audit finds it and blocks the commit with exit code 1.
3. **Run 3** — arbitrary values that ARE backed by the repo's Tailwind v4 `@theme` tokens (`rounded-[8px]`, `p-[16px]` backed by `--radius-lg: 8px`, `--spacing-4: 16px`) pass clean.

## Layout

- `DESIGN.md` — the design reference contract (tokens + Button contract)
- `design-memory.config.json` — audit config (block strictness)
- `src/styles/theme.css` — Tailwind v4 `@theme` tokens read by the engine
- `src/components/` — clean, token-correct components
- `drift/` — the drift variants the demo copies in
- `scripts/demo.sh` — the demo harness (temp repo, baseline commit, three audit runs)

## Trying it on your own repo

```bash
design-memory init
design-memory sync-reference
git add .
design-memory audit
```

Or add the GitHub Action for PR-gate enforcement (see the main README).
