# MCP client registration

Design Memory starts as a stdio server: `design-memory mcp`. Clients spawn it per project. The package is not published to npm yet, so use one of these forms:

- from this repo: `node <repo>/dist/cli/index.js mcp`
- or after `npm link` at the repo root: `design-memory mcp`
- once published: `npx -y @derinb/design-memory mcp`

Point the server at the project you want it to guard with `--cwd` when the client does not start the process inside the project.

## Claude Code / Claude Desktop

[`claude.json`](claude.json) uses the `mcpServers` shape. Merge it into your client config.

## Cursor

Same `mcpServers` shape as [`cursor.json`](cursor.json).

## OpenCode

[`opencode.jsonc`](opencode.jsonc) shows the `mcp` block with a local command.

## Codex

[`codex.toml`](codex.toml) shows the TOML form.

## What the agent gets

- tools: `dm_get_context`, `dm_audit_diff`, `dm_suggest_token`, `dm_record_decision`, `dm_get_decisions`, `dm_get_tokens`, `dm_get_contract`
- resources: `dm://tokens`, `dm://design-md`, `dm://rules`, `dm://contracts`, `dm://decisions`, `dm://config`
- prompts: `dm/implement-component`, `dm/fix-drift`, `dm/review-drift`

A healthy connection answers `dm_get_tokens` with the project's token list. If it returns `DM_E_NO_SNAPSHOT`, run `design-memory sync-reference` in that project first.
