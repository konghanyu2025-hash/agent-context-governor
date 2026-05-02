# Security Policy

## Supported Versions

The current pre-1.0 line receives security fixes on best effort.

## Reporting a Vulnerability

Please open a private security advisory on GitHub when available. If that is not possible, open an issue with only non-sensitive reproduction details and state that a private follow-up is needed.

Do not include real secrets, private repository data, `.env` contents, tokens, or proprietary logs in public issues.

## Data Handling

`agent-context-governor` stores memory locally in `.agent-memory/`. The tool redacts common secrets before writing records, but users should still treat memory files as private project data.

Recommended defaults:

- Keep `.agent-memory/` in `.gitignore`.
- Do not record full environment dumps.
- Do not paste private tokens into manual records.
- Review context packs before sharing them outside the local project.
