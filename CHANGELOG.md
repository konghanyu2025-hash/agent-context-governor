# Changelog

## 0.1.0

- Added local JSONL-backed memory storage.
- Added CLI commands for init, index, search, preflight, pack, record, dependency review, and doctor.
- Added MCP stdio server with tools for search, context packing, recording, dependency review, and project indexing.
- Added negative-cache behavior for failed and abandoned attempts.
- Added npm dependency review using registry metadata.
- Added privacy redaction for common secret patterns.
- Added `agc on`, `agc off`, and `agc st` for default MCP-based Claude/Codex integration.
- Moved shell wrapper hooks behind explicit `agc sh on|off` commands with backup and dry-run support.
- Added tests, CI, documentation, and open-source project templates.
