# Optional Shell Hooks

Shell hooks are no longer the default integration path. Use this first:

```bash
agc on
agc st
```

That configures MCP and project instructions without changing your shell profile. Daily commands remain:

```bash
claude
codex
```

## Legacy Wrapper

If you still want shell functions named `claude` and `codex` that call `agc run <tool> -- ...`, install them explicitly:

```bash
agc sh on
```

Preview without writing:

```bash
agc sh on --dry-run
```

Remove:

```bash
agc sh off
```

Supported shells:

- PowerShell
- bash
- zsh

The hook installer writes only a marked block and backs up an existing profile before modifying it. Prefer MCP unless you have a specific reason to wrap shell commands.
