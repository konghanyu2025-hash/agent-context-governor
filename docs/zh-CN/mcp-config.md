# MCP 配置

先构建项目：

```bash
npm install
npm run build
```

启动 MCP server：

```bash
agent-context-mcp
```

示例客户端配置：

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

如果你直接从本地源码仓库使用，可以指向构建后的 server：

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

可用工具：

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`
