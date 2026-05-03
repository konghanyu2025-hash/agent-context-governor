# Shell Hook

`agent-context-governor` 的定位是辅助现有编程工具，不替代它们。

短命令是：

```bash
agc
```

一次开启：

```bash
agc on
```

重启终端后继续使用：

```bash
claude
codex
```

hook 会在 shell 里定义名为 `claude` 和 `codex` 的函数。函数会调用 `agc run <tool> -- ...`，先准备本地项目记忆，再启动真正的工具可执行文件。

关闭：

```bash
agc off
```

短命令手动兜底：

```bash
agc pf "你的任务"
```

支持的 shell：

- PowerShell
- bash
- zsh
