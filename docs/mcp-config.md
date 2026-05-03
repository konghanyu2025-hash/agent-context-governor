# MCP Configuration

The easiest path is:

```bash
agc on
agc st
```

`agc on` registers `agent-context-governor` with detected Claude Code and Codex CLIs and writes managed project instructions. Daily use remains:

```bash
claude
codex
```

## Manual Server Command

If a client needs manual configuration, the stdio server command is:

```bash
agent-context-mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "agent-context-governor": {
      "command": "agent-context-mcp",
      "args": []
    }
  }
}
```

When working from an unpublished local checkout, build first and point directly at the server:

```bash
npm install
npm run build
```

```json
{
  "mcpServers": {
    "agent-context-governor": {
      "command": "node",
      "args": ["C:/path/to/agent-context-governor/dist/mcp/server.js"]
    }
  }
}
```

## Available Tools

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`

Agents should call `context.pack` or `memory.search` before broad repository exploration and should record durable outcomes after important decisions or failed attempts.
