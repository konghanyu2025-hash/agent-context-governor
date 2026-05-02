# MCP Configuration

Build the project first:

```bash
npm install
npm run build
```

Use the generated MCP server:

```bash
agent-context-mcp
```

Example client configuration:

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

When working from an unpublished local checkout, point directly at the built server:

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

Available tools:

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`
