# Contributing

Thanks for helping improve `agent-context-governor`.

## Setup

```bash
npm install
npm run check
```

## Development Expectations

- Keep the default storage local-first.
- Keep private memory out of Git.
- Avoid heavy runtime dependencies unless they clearly reduce risk or complexity.
- Prefer structured records and evidence references over free-form logs.
- Add tests for behavior changes.

## Pull Requests

Before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Describe what changed, why it changed, and how it was validated.
