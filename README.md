# agent-memory

Local-first memory for coding agents. `agent-memory` gives tools such as Claude Code, Codex, Cursor, and other MCP-capable agents a compact project memory layer so they can avoid repeated context gathering, repeated failed approaches, and blind dependency choices.

The MVP stores structured JSONL locally in `.agent-memory/`. It does not use cloud sync, a vector database, or telemetry.

## Install

```bash
npm install -g agent-memory
```

For local development:

```bash
npm install
npm run build
npm link
```

## Quick Start

```bash
agent-memory init
agent-memory index
agent-memory record decision \
  --title "Use JSONL for local memory" \
  --rationale "It is auditable, local-first, and works without external services." \
  --scope "src/store,src/search"

agent-memory record attempt \
  --task "Add dependency memory" \
  --approach "Use a hosted vector database in MVP" \
  --result abandoned \
  --failure-reason "MVP must remain local-first and dependency-light"

agent-memory deps review commander --use-case "CLI command parsing"
agent-memory preflight "extend the CLI with a new record command" --budget 3000
```

## CLI

- `agent-memory init` creates `.agent-memory/`, config, JSONL stores, and a private `.agent-memory/.gitignore`.
- `agent-memory index` scans package manager, languages, entry files, scripts, and key directories.
- `agent-memory search "<query>"` searches decisions, attempts, dependency reviews, and the project index.
- `agent-memory preflight "<task>"` creates an evidence-backed context pack before an agent starts work.
- `agent-memory pack "<task>" --budget 3000` creates and saves a context pack with an approximate token budget.
- `agent-memory record decision|attempt|dependency` records durable project memory.
- `agent-memory deps review <package> --use-case "<why>"` checks npm registry metadata and records a dependency recommendation.
- `agent-memory mcp` starts the MCP stdio server.

## MCP Tools

Run:

```bash
agent-memory-mcp
```

Available tools:

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`

The server uses JSON-RPC over newline-delimited stdio and writes only MCP messages to stdout.

## Local Files

```text
.agent-memory/
  config.json
  decisions.jsonl
  attempts.jsonl
  dependencies.jsonl
  project-index.json
  context-packs/
```

`.agent-memory/` is intentionally ignored by default. Treat it as private working memory unless you explicitly design a team-sharing workflow.

## Why This Saves Tokens

- Stores decisions once and reuses them as short, cited summaries.
- Records failed attempts as a negative cache so agents do not retry known-bad paths.
- Reviews dependencies once, including license, maintenance, dependency surface, and recommendation.
- Generates small task-specific context packs instead of repeatedly pasting full files or logs.
- Keeps evidence links with every conclusion so stale memory can be checked against current code.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## License

MIT
