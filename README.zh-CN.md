# agent-context-governor

[English](README.md)

`agent-context-governor` 是一个本地优先的 coding agent 上下文与记忆治理工具。它面向 Claude Code、Codex、Cursor 以及支持 MCP 的 agent，目标是减少重复读上下文、重复尝试失败方案、重复造轮子和盲目引入依赖。

项目默认把结构化记忆保存在当前项目的 `.agent-memory/` 目录中。它不使用遥测、不依赖云服务，也不要求向量数据库。

## 能做什么

- 记录长期有效的技术决策、失败尝试、成功尝试和依赖审查。
- 提供 MCP stdio server，让 agent 可以搜索记忆、生成 context pack、记录决策和审查依赖。
- 写入短小的项目指令，让 agent 在大范围探索前先调用记忆工具。
- 把失败或放弃的方案作为负缓存，提醒 agent 不要无脑重试。
- 在引入 npm 依赖前读取 registry metadata，给出 `use`、`spike` 或 `avoid` 建议。
- 默认保护私有项目记忆，不把 `.agent-memory/` 提交进 Git。

## 安装

直接从 GitHub 安装，不需要先发布到 npm：

```bash
npm install -g github:konghanyu2025-hash/agent-context-governor
```

从本地仓库安装：

```bash
npm install
npm run build
npm link
```

安装后可以使用：

```bash
agc --help
agent-context-mcp
```

同时保留兼容别名：

```bash
agent-memory --help
agent-memory-mcp
```

## 快速开始

在项目里开启一次：

```bash
agc on
```

这会初始化 `.agent-memory/`、索引项目、把本地 MCP server 注册到可用的 `claude` 和 `codex` CLI，并向 `AGENTS.md` 与 `CLAUDE.md` 写入可审查的托管指令块。

检查状态：

```bash
agc st
```

之后继续用原来的命令：

```bash
claude
codex
```

默认接入方式是 MCP 加项目指令，不会修改你的 shell profile。如果 Claude/Codex 会话已经打开，需要重启该会话，让它重新加载 MCP server 和项目指令。

手动兜底也保持短命令：

```bash
agc pf "extend auth flow"
```

关闭当前项目接入：

```bash
agc off
```

## CLI 命令

- `agc on`：为当前项目开启 MCP 记忆和托管项目指令。
- `agc off`：移除 MCP 注册和托管项目指令块。
- `agc st`：检查本地记忆、MCP 命令、Claude/Codex 注册状态和项目指令。
- `agc pf "<task>"`：`preflight` 的短命令形式。
- `agc setup`：一条命令完成 `init`、`index` 和 `doctor`。
- `agc sh on|off`：管理可选的旧式 shell wrapper hook。它不是默认路径。
- `agent-context init`：创建 `.agent-memory/`、配置文件、JSONL 存储和私有 `.agent-memory/.gitignore`。
- `agent-context index`：扫描包管理器、语言、入口文件、脚本和关键目录。
- `agent-context doctor`：检查本地设置、隐私保护和项目索引状态。
- `agent-context search "<query>"`：搜索决策、尝试记录、依赖审查和项目索引。
- `agent-context preflight "<task>"`：在 agent 开始工作前生成 context pack。
- `agent-context pack "<task>" --budget 3000`：按大致 token 预算生成并保存 context pack。
- `agent-context record decision|attempt|dependency`：记录项目记忆。
- `agent-context deps review <package> --use-case "<why>"`：审查 npm 依赖并记录建议。
- `agent-context mcp`：启动 MCP stdio server。

## MCP 工具

server 命令是：

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

`agc on` 会自动为检测到的 Claude Code 和 Codex CLI 注册这个 server。手动配置示例见 [docs/zh-CN/mcp-config.md](docs/zh-CN/mcp-config.md)。

## 本地存储

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

`.agent-memory/` 默认应保留在 `.gitignore` 中。除非明确设计团队共享流程，否则它应该被视为私有工作记忆。

## 为什么能省 token

- 决策只记录一次，后续以短摘要和证据引用复用。
- 失败路径会进入负缓存，避免 agent 反复尝试同一条坏路。
- 依赖审查结果可复用，不必每次重新调研。
- context pack 只带任务相关内容，不重复粘贴大段文件和日志。
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

## 简单使用原则

日常主命令仍然是 `claude` 和 `codex`。`agc` 只是 3 个字母的辅助命令，用来开启、关闭、检查状态和少量手动兜底。

## 许可证

MIT
