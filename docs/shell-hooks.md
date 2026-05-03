# Shell Hooks

`agent-context-governor` is meant to assist existing coding tools, not replace them.

The short command is:

```bash
agc
```

Enable once:

```bash
agc on
```

Restart the shell. Then keep using:

```bash
claude
codex
```

The hook defines shell functions named `claude` and `codex`. Each function calls `agc run <tool> -- ...`, which prepares local memory and then launches the real tool executable.

Disable:

```bash
agc off
```

Short manual fallback:

```bash
agc pf "your task"
```

Supported shells:

- PowerShell
- bash
- zsh
