# Contributing to Design Memory

Design Memory blocks net-new design policy violations and reference mismatches in React/Tailwind PRs with deterministic checks first.

## Ground rules

- **Deterministic checks come first.** Prefer rule-based enforcement over AI fallback.
- **Add tests** when you fix a bug or add a rule.
- **Keep reference snapshots as the contract.** Changes to normalization affect every downstream audit.
- **Prefer honest failure modes** over fake confidence — a clear "can't determine" is better than a wrong answer.
- **Baselines should block only net-new or reopened drift.** The goal is adoption, not punishment.

## Workflow

1. Make a small, focused change.
2. Run `npm run build` and `npm test`.
3. Update docs if the contract, config schema, or CLI output changed.
4. Keep CLI outputs stable enough for automated review workflows.

## Development setup

```bash
npm install
npm run build
npm link   # makes `design-memory` available globally
```

## Before opening a PR

- Verify the showcase still works: `npm run demo:design-memory:audit`
- Check that `design-memory init` still writes a valid default config
- If you changed rule behavior, update the examples and tests that demonstrate the rule
- Keep reference normalization deterministic and explainable

## What to avoid

- Quietly turning on fuzzy, non-deterministic enforcement as the default
- Letting the demo path diverge from the real engine
- Skipping snapshot generation when the audit flow depends on it
- Mixing enforcement logic with UI polish code
