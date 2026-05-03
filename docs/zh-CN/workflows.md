# 使用工作流

## agent 开始任务前

每个项目开启一次：

```bash
agc on
agc st
```

之后继续用原来的工具：

```bash
claude
codex
```

`agc on` 会注册 MCP server，并写入托管项目指令，让 agent 在大范围探索前先调用 `context.pack` 和 `memory.search`。

手动兜底：

```bash
agc pf "在这里描述任务"
```

先阅读生成的 context pack，再让 agent 做更大范围的仓库探索。

## 做出技术决策后

```bash
agc record decision \
  --title "简短决策标题" \
  --rationale "为什么这是合适取舍" \
  --scope "src/module,tests/module.test.ts"
```

## 失败或放弃某条路径后

```bash
agc record attempt \
  --task "当时要完成的任务" \
  --approach "尝试过的方法" \
  --result failure \
  --error-signature "稳定错误文本或症状" \
  --failure-reason "为什么以后不应该无脑重复"
```

失败和放弃的尝试会出现在未来的 context pack 中，作为负缓存提醒。

## 添加 npm 依赖前

```bash
agc deps review package-name --use-case "为什么需要它"
```

审查会记录许可证、维护状态、直接依赖数量、明显风险，并输出 `use`、`spike` 或 `avoid` 建议。
