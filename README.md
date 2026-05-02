# agent-context-governor

Local-first context and memory governor for coding agents. It helps Claude Code, Codex, Cursor, and MCP-capable tools avoid repeated context gathering, repeated failed paths, and blind dependency choices.

The project stores structured memory in `.agent-memory/` inside the local project. It has no telemetry, no cloud service, and no vector database requirement.

## What It Does

- Records durable decisions, failed attempts, successful attempts, and dependency reviews.
- Generates compact context packs before an agent starts work.
- Keeps a negative cache for abandoned or failed approaches so agents do not retry known-bad paths blindly.
- Reviews npm dependencies using registry metadata before adoption.
- Exposes both a CLI and an MCP stdio server.
- Keeps private project memory out of Git by default.

## Install

From a local checkout:

```bash
npm install
npm run build
npm link
```

After linking:

```bash
agent-context --help
agent-context-mcp
```

Compatibility aliases are also provided:

```bash
agent-memory --help
agent-memory-mcp
```

## Quick Start

```bash
agent-context init
agent-context index
agent-context doctor

agent-context record decision \
  --title "Use JSONL for local memory" \
  --rationale "It is auditable, local-first, and works without external services." \
  --scope "src/store,src/search"

agent-context record attempt \
  --task "Add dependency memory" \
  --approach "Use a hosted vector database in MVP" \
  --result abandoned \
  --failure-reason "MVP must remain local-first and dependency-light"

agent-context deps review commander --use-case "CLI command parsing"
agent-context preflight "extend the CLI with a new record command" --budget 3000
```

## CLI

- `agent-context init` creates `.agent-memory/`, config, JSONL stores, and a private `.agent-memory/.gitignore`.
- `agent-context index` scans package manager, languages, entry files, scripts, and key directories.
- `agent-context doctor` checks setup health, privacy guardrails, and project index state.
- `agent-context search "<query>"` searches decisions, attempts, dependency reviews, and the project index.
- `agent-context preflight "<task>"` creates an evidence-backed context pack before an agent starts work.
- `agent-context pack "<task>" --budget 3000` creates and saves a context pack with an approximate token budget.
- `agent-context record decision|attempt|dependency` records durable project memory.
- `agent-context deps review <package> --use-case "<why>"` checks npm registry metadata and records a dependency recommendation.
- `agent-context mcp` starts the MCP stdio server.

## MCP

Run:

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

See [docs/mcp-config.md](docs/mcp-config.md) for example client configuration.

## Local Storage

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

## License

MIT
