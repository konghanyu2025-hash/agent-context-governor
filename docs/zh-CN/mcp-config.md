# MCP 配置

最简单的路径是：

```bash
agc on
agc st
```

`agc on` 会把 `agent-context-governor` 注册到检测到的 Claude Code 和 Codex CLI，并写入托管项目指令。日常命令仍然是：

```bash
claude
codex
```

## 手动 server 命令

如果某个 MCP 客户端需要手动配置，stdio server 命令是：

```bash
agent-context-mcp
```

示例 MCP 客户端配置：

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

如果你直接从本地源码仓库使用，先构建，再指向构建后的 server：

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

## 可用工具

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`

agent 应该在大范围探索前调用 `context.pack` 或 `memory.search`，并在重要决策或失败尝试后记录结果。
