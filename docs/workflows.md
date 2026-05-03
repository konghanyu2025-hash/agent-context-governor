# Workflows

## Before Starting Agent Work

One-time per project:

```bash
agc on
agc st
```

Then keep using the original tools:

```bash
claude
codex
```

`agc on` registers the MCP server and writes managed instructions that tell agents to call `context.pack` and `memory.search` before broad exploration.

Manual fallback:

```bash
agc pf "describe the task here"
```

Read the generated context pack before spending more tokens on broad repository exploration.

## After a Decision

```bash
agc record decision \
  --title "Short decision title" \
  --rationale "Why this is the right tradeoff" \
  --scope "src/module,tests/module.test.ts"
```

## After a Failed or Abandoned Path

```bash
agc record attempt \
  --task "What you were trying to do" \
  --approach "What was tried" \
  --result failure \
  --error-signature "Stable error text or symptom" \
  --failure-reason "Why this should not be repeated blindly"
```

Failed and abandoned attempts are shown in future context packs as negative cache entries.

## Before Adding an npm Dependency

```bash
agc deps review package-name --use-case "why it is needed"
```

The review records license, maintenance state, direct dependency count, obvious risks, and a `use`, `spike`, or `avoid` recommendation.
