# Project Readiness

This repository is usable as a project-level open-source v1 when the following checks pass:

- The repository has a clean `main` branch and a configured GitHub remote.
- `npm run check` passes.
- `npm pack --dry-run` includes `dist`, `docs`, `README.md`, `README.zh-CN.md`, `CHANGELOG.md`, `LICENSE`, and `SECURITY.md`.
- GitHub installs work through `npm install -g github:konghanyu2025-hash/agent-context-governor`.
- Daily use can stay on `claude` and `codex` after one-time `agc on`.
- `agc st` reports ready when local memory, MCP registration, and project instructions are installed.
- A packed install can run `agent-context --help`.
- A first-time project can run `agent-context setup`.
- The built CLI can run `doctor`.
- The built MCP server returns `tools/list`.
- `agc on` does not modify shell profiles unless an explicit shell-hook option is used.
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
