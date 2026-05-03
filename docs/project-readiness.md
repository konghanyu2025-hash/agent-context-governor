# Project Readiness

This repository is usable as a project-level open-source v1 when the following checks pass:

- The repository has a clean `main` branch and a configured GitHub remote.
- `npm run check` passes.
- `npm pack --dry-run` includes `dist`, `docs`, `README.md`, `README.zh-CN.md`, `CHANGELOG.md`, `LICENSE`, and `SECURITY.md`.
- A packed install can run `agent-context --help`.
- The built CLI can run `doctor`.
- The built MCP server returns `tools/list`.
- `.agent-memory/`, `node_modules/`, `dist/`, and generated tarballs are not committed.

## Current Scope

Included:

- CLI
- MCP stdio server
- Local JSONL memory storage
- Project indexing
- Context pack generation
- Failed-path negative cache
- npm dependency review
- English and Chinese documentation
- GitHub Actions CI
- Issue and pull request templates

Not included yet:

- npm registry publication
- Cloud sync
- Team sharing and permissions
- Editor extensions
- Vector search
