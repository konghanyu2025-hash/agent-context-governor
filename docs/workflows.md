# Workflows

## Before Starting Agent Work

```bash
agent-context index
agent-context preflight "describe the task here" --budget 3000
```

Read the generated context pack before spending more tokens on broad repository exploration.

## After a Decision

```bash
agent-context record decision \
  --title "Short decision title" \
  --rationale "Why this is the right tradeoff" \
  --scope "src/module,tests/module.test.ts"
```

## After a Failed or Abandoned Path

```bash
agent-context record attempt \
  --task "What you were trying to do" \
  --approach "What was tried" \
  --result failure \
  --error-signature "Stable error text or symptom" \
  --failure-reason "Why this should not be repeated blindly"
```

Failed and abandoned attempts are shown in future context packs as negative cache entries.

## Before Adding an npm Dependency

```bash
agent-context deps review package-name --use-case "why it is needed"
```

The review records license, maintenance state, direct dependency count, obvious risks, and a `use`, `spike`, or `avoid` recommendation.
