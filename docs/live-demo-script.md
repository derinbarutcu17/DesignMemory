# Live demo script (5 minutes)

Preconditions (rehearse twice before the meeting):

- `npm --prefix apps/procure-dash install` done; preview server running: `npm --prefix apps/procure-dash run preview -- --port 4173`
- Coding agent (Claude Code / OpenCode / Cursor) open in `apps/procure-dash` with the MCP server registered:
  `{ "mcpServers": { "design-memory": { "command": "npx", "args": ["-y", "@derinb/design-memory", "mcp"], "cwd": "<repo>/apps/procure-dash" } } }`
- Terminal at repo root, `node dist/cli/index.js` built (`npm run build`).
- Fallbacks staged: `docs/video/design-memory-motion-30fps.mp4` open in a player; `demo/fallback/mutation.patch` ready; app state clean (`git status` in `apps/procure-dash`).

| Time | Action | What to say |
| --- | --- | --- |
| 0:00 | Open `http://localhost:4173/#/suppliers` | "This is the kind of surface a procurement team lives in: dense tables, risk states, contract renewals. Three routes, one token system." |
| 0:25 | Show `apps/procure-dash/tokens.json` and `DESIGN.md` for 10 seconds; switch to terminal | "The design truth is machine-readable: DTCG tokens plus component contracts." |
| 0:35 | `node dist/cli/index.js sync-reference --cwd apps/procure-dash` | "One command snapshots it. Everything downstream reads this snapshot." |
| 0:50 | In the agent: "Add a negotiation leverage badge to the supplier table and a savings column, keep it consistent with our design system." Let it write. | "Notice it reaches for a hex code and a 13px padding. That is default agent behavior." |
| 1:35 | Run `node dist/cli/index.js audit --cwd apps/procure-dash` (or let the hook fire) | "The gate is deterministic: color.raw-hex at line 16, with the exact replacement named." |
| 2:00 | In the agent: call `dm_get_context` for `src/ui/DataTable.tsx`, then `dm_suggest_token` for the found value. Show the compact replies. | "Before writing again, it asks the system. This reply is 2.5 KB, asserted by test." |
| 2:40 | Agent applies `text-info`; re-run audit | "Clean." |
| 3:00 | Ask the agent to call `dm_get_decisions` with `path: "src/ui/DataTable.tsx"` | "This is the memory: the 13px numerics exception, its reason, its expiry, and its dependency on the type scale." |
| 3:30 | Open `apps/procure-dash/tokens.json`, change `fontSize.sm` to 15px, run `sync-reference`; re-run audit | "The type scale changed, so the exception invalidated itself and the finding blocks again. Memory with a lifecycle, not a silenced warning." |
| 4:00 | `git -C apps/procure-dash checkout -- tokens.json` (or restore), `sync-reference` again; show `node dist/cli/index.js memory list --cwd apps/procure-dash` | "Accepted drift stays auditable: kind, target, reason, author, expiry." |
| 4:30 | Close on the clean dashboard | "Deterministic guardrails, agent-readable memory, and a real product surface to hang it on. That is what I would bring to Delvo." |

## Fallbacks

- Agent stalls or offline: apply `demo/fallback/mutation.patch` in `apps/procure-dash`, keep narrating from 1:35.
- MCP registration fails: use the CLI equivalents (`audit --json`, `memory list`) with `jq`.
- Build/server fails: play `docs/video/design-memory-motion-30fps.mp4` and walk through it.
- Network down: nothing in this demo needs the network (verify once in airplane mode).
- Anything else: the recorded video plus `docs/graphics/*.png` is the backup talk track.

## Numbers to quote (all measured)

- MCP surface: 7 tools, 8 resources, 3 prompts.
- Test floor: 49 core tests, 8 MCP protocol/budget tests, 14 bake scenarios.
- `dm_get_context` standard reply on DataTable.tsx: 2566 bytes (test asserts < 4096).
- Demo baseline: 2 accepted legacy findings; 3 seeded decisions.
