# Agent Instructions

This repository is a TypeScript/Node project for a local-first coding-agent memory layer.

## Working Rules

- Keep `.agent-memory/` private and out of Git.
- Prefer small, auditable changes over large rewrites.
- Do not add hosted services, telemetry, or cloud sync without explicit design work.
- Preserve compatibility aliases for `agent-memory` and `agent-memory-mcp` unless a breaking release plan exists.
- Add or update tests for CLI, MCP, storage, context packing, and dependency review behavior when touching those areas.

## Validation

Run before committing:

```bash
npm run check
npm pack --dry-run
```

For MCP changes, also smoke test:

```bash
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/mcp/server.js
```
