# 可选 Shell Hook

shell hook 不再是默认接入方式。优先使用：

```bash
agc on
agc st
```

这会配置 MCP 和项目指令，不会修改你的 shell profile。日常命令仍然是：

```bash
claude
codex
```

## 旧式 wrapper

如果你仍然想在 shell 里定义名为 `claude` 和 `codex` 的函数，让它们调用 `agc run <tool> -- ...`，需要显式安装：

```bash
agc sh on
```

只预览、不写入：

```bash
agc sh on --dry-run
```

移除：

```bash
agc sh off
```

支持的 shell：

- PowerShell
- bash
- zsh

hook 安装器只写入带 marker 的托管块，并会在修改已有 profile 前备份。除非确实需要包装 shell 命令，否则优先使用 MCP。
