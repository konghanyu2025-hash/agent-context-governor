# agent-context-governor

[English](README.md)

`agent-context-governor` 是一个本地优先的 coding agent 上下文与记忆治理工具。它面向 Claude Code、Codex、Cursor 以及支持 MCP 的 agent，目标是减少重复读上下文、重复尝试失败方案、重复造轮子和盲目引入依赖。

项目默认把结构化记忆保存在当前项目的 `.agent-memory/` 目录中。它不使用遥测、不依赖云服务，也不要求向量数据库。

## 能做什么

- 记录长期有效的技术决策、失败尝试、成功尝试和依赖审查。
- 在 agent 开始任务前生成小而准确的 context pack。
- 把失败或放弃的方案作为负缓存，提醒 agent 不要无脑重试。
- 在引入 npm 依赖前读取 registry metadata，给出 `use`、`spike` 或 `avoid` 建议。
- 同时提供 CLI 和 MCP stdio server。
- 默认保护私有项目记忆，不把 `.agent-memory/` 提交进 Git。

## 安装

从本地仓库安装：

```bash
npm install
npm run build
npm link
```

链接后可以使用：

```bash
agent-context --help
agent-context-mcp
```

同时保留兼容别名：

```bash
agent-memory --help
agent-memory-mcp
```

## 快速开始

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

## CLI 命令

- `agent-context init`：创建 `.agent-memory/`、配置文件、JSONL 存储和私有 `.agent-memory/.gitignore`。
- `agent-context index`：扫描包管理器、语言、入口文件、脚本和关键目录。
- `agent-context doctor`：检查本地设置、隐私保护和项目索引状态。
- `agent-context search "<query>"`：搜索决策、尝试记录、依赖审查和项目索引。
- `agent-context preflight "<task>"`：在 agent 开始工作前生成 context pack。
- `agent-context pack "<task>" --budget 3000`：按大致 token 预算生成并保存 context pack。
- `agent-context record decision|attempt|dependency`：记录项目记忆。
- `agent-context deps review <package> --use-case "<why>"`：审查 npm 依赖并记录建议。
- `agent-context mcp`：启动 MCP stdio server。

## MCP

运行：

```bash
agent-context-mcp
```

可用工具：

- `memory.search`
- `context.pack`
- `decision.record`
- `attempt.record`
- `dependency.review`
- `project.index`

MCP 客户端配置示例见 [docs/zh-CN/mcp-config.md](docs/zh-CN/mcp-config.md)。

## 本地存储

```text
.agent-memory/
  config.json
  decisions.jsonl
  attempts.jsonl
  dependencies.jsonl
  project-index.json
  context-packs/
```

`.agent-memory/` 默认应该保留在 `.gitignore` 中。除非你明确设计团队共享流程，否则它应该被视为私有工作记忆。

## 为什么能省 token

- 决策只记录一次，后续以短摘要和证据引用复用。
- 失败路径会进入负缓存，避免 agent 反复尝试同一条坏路。
- 依赖审查结果可复用，不必每次重新调研。
- context pack 只带任务相关内容，不反复粘贴大段文件和日志。
- 每条结论都保留来源，发现过期或冲突时可以回到真实代码核验。

## 开发

```bash
npm install
npm run check
```

更细的检查命令：

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## 项目状态

这是一个可自用、可公开迭代的早期 v1。它暂不包含云同步、托管团队服务、编辑器插件或向量数据库。

## 许可证

MIT
