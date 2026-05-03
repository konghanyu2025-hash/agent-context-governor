# agent-context-governor

[简体中文](README.zh-CN.md)

Local-first context and memory governor for coding agents. It helps Claude Code, Codex, Cursor, and MCP-capable tools avoid repeated context gathering, repeated failed paths, and blind dependency choices.

The project stores structured memory in `.agent-memory/` inside the local project. It has no telemetry, no cloud service, and no vector database requirement.

## What It Does

- Records durable decisions, failed attempts, successful attempts, and dependency reviews.
- Exposes an MCP stdio server with search, context pack, record, dependency review, and project index tools.
- Installs project instructions so agents know to call the memory tools before broad exploration.
- Keeps a negative cache for abandoned or failed approaches so agents do not retry known-bad paths blindly.
- Reviews npm dependencies using registry metadata before adoption.
- Keeps private project memory out of Git by default.

## Install

From GitHub, without npm registry publication:

```bash
npm install -g github:konghanyu2025-hash/agent-context-governor
```

From a local checkout:

```bash
npm install
npm run build
npm link
```

After installing:

```bash
agc --help
agent-context-mcp
```

Compatibility aliases are also provided:

```bash
agent-memory --help
agent-memory-mcp
```

## Quick Start

Enable once inside a project:

```bash
agc on
```

This initializes `.agent-memory/`, indexes the project, registers the local MCP server with available `claude` and `codex` CLIs, and writes small managed blocks to `AGENTS.md` and `CLAUDE.md`.

Check the setup:

```bash
agc st
```

Then keep using your normal tools:

```bash
claude
codex
```

The default integration is MCP plus project instructions. It does not modify your shell profile. If an agent session is already open, restart that session so it loads the new MCP server and instructions.

Manual fallback, still short:

```bash
agc pf "extend auth flow"
```

Disable the project integration:

```bash
agc off
```

## CLI

- `agc on` enables MCP memory and managed project instructions for this project.
- `agc off` removes the MCP registration and managed instruction blocks.
- `agc st` checks local memory, MCP command availability, Claude/Codex registration, and project instructions.
- `agc pf "<task>"` is the short form of `preflight`.
- `agc setup` runs `init`, `index`, and `doctor` in one step.
- `agc sh on|off` manages optional legacy shell wrapper hooks. This is not the default path.
- `agent-context init` creates `.agent-memory/`, config, JSONL stores, and a private `.agent-memory/.gitignore`.
- `agent-context index` scans package manager, languages, entry files, scripts, and key directories.
- `agent-context doctor` checks setup health, privacy guardrails, and project index state.
- `agent-context search "<query>"` searches decisions, attempts, dependency reviews, and the project index.
- `agent-context preflight "<task>"` creates an evidence-backed context pack before an agent starts work.
- `agent-context pack "<task>" --budget 3000` creates and saves a context pack with an approximate token budget.
- `agent-context record decision|attempt|dependency` records durable project memory.
- `agent-context deps review <package> --use-case "<why>"` checks npm registry metadata and records a dependency recommendation.
- `agent-context mcp` starts the MCP stdio server.

## MCP Tools

The server command is:

```bash
agent-context-mcp
```

Available tools:

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`

`agc on` registers this server automatically for detected Claude Code and Codex CLIs. Manual client configuration examples are in [docs/mcp-config.md](docs/mcp-config.md).

## Local Storage

```text
.agent-memory/
  config.json
  decisions.jsonl
  attempts.jsonl
  dependencies.jsonl
  project-index.json
  context-packs/
  backups/
```

`.agent-memory/` is intentionally ignored by default. Treat it as private working memory unless you explicitly design a team-sharing workflow.

## How It Saves Tokens

- Stores decisions once and reuses them as short, cited summaries.
- Records failed attempts as a negative cache so agents do not retry known-bad paths.
- Reviews dependencies once, including license, maintenance, dependency surface, and recommendation.
- Generates small task-specific context packs instead of repeatedly pasting full files or logs.
- Keeps evidence links with every conclusion so stale memory can be checked against current code.

## Development

```bash
npm install
npm run check
```

Useful focused commands:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Project Status

This is an early v1 for local use and public iteration. It intentionally does not include cloud sync, a hosted team service, an editor extension, or a vector database.

## Simple Use Policy

Daily use should stay on `claude` and `codex`. `agc` is only the short auxiliary command for setup, status, toggling, and rare manual context checks.

For Chinese documentation, see [README.zh-CN.md](README.zh-CN.md) and [docs/zh-CN](docs/zh-CN).

## License

MIT
