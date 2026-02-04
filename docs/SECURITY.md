# Security Documentation

This document describes the security model and practices implemented in AI Fat Controller.

## Overview

AI Fat Controller is an Electron application that orchestrates AI agents (Claude Code) to perform software development tasks. Given its privileged access to execute commands and modify files, security is a critical concern.

## Command Execution Model

### Allowed Commands

The application restricts command execution to a whitelist of approved commands:

| Command | Purpose | Notes |
|---------|---------|-------|
| `claude` | Claude Code CLI | Main AI execution engine |
| `gt` | Gas Town CLI | Multi-agent orchestrator |
| `bd` | Beads CLI | Git-backed issue tracker |
| `git` | Version control | Used for project status checks |
| `wsl.exe` | WSL interop | Windows-only, for WSL mode detection |

### Why `shell: true` is Required on Windows

On Windows, the application uses `shell: true` when spawning processes in certain scenarios:

1. **Path resolution**: Windows requires shell expansion to resolve commands in PATH
2. **WSL interop**: `wsl.exe` commands require shell context for proper argument handling
3. **Environment inheritance**: Shell ensures proper environment variable inheritance

**Mitigations**:
- All command inputs are validated and sanitized before execution
- Arguments are passed as arrays (not concatenated strings) where possible
- No user-provided strings are directly interpolated into commands

### Why `--dangerously-skip-permissions` is Used

Claude Code requires explicit permission for file system operations. The `--dangerously-skip-permissions` flag is used because:

1. **User-initiated tasks**: All Claude operations are explicitly requested by the user
2. **Approval workflow**: High-risk operations (git push, large edits) require manual approval
3. **Sandboxed execution**: Operations are confined to the user's project directories
4. **Audit trail**: All actions are logged and can be reviewed

**Important**: This flag should only be used in controlled environments where the user trusts the AI's actions. The approval queue provides a safety net for destructive operations.

## Data Storage Security

### Electron-Store

The application uses `electron-store` for persistent data storage. Stores contain:

- **settings**: User preferences (non-sensitive)
- **controller**: Task state and approval queue
- **ntfy**: Notification configuration (may contain auth tokens)
- **project-briefs**: Project analysis data
- **token-history**: Usage analytics

### Encryption (Planned)

Future versions will implement encryption for stores containing sensitive data:

- Encryption key generated using `crypto.randomBytes(32)`
- Key stored in OS keychain (via `keytar` or platform-specific secure storage)
- AES-256-GCM encryption for store data

### Sensitive Data Handling

The application handles the following sensitive data:

| Data Type | Storage | Protection |
|-----------|---------|------------|
| ntfy auth tokens | electron-store | Planned encryption |
| Conversation history | JSONL files | File system permissions |
| API responses | Memory only | Not persisted |

## Network Security

### External Communications

The application communicates with:

1. **Claude Code CLI**: Local process communication via stdin/stdout
2. **ntfy server**: Optional push notifications (user-configured endpoint)
3. **GitHub releases**: Auto-update checks (HTTPS)

### MCP Server Connections

Model Context Protocol (MCP) servers can be configured:

- Connections are user-initiated
- Transport supports stdio (local) and WebSocket (network)
- No default MCP servers are auto-connected

## Input Validation

### User Prompts

User prompts sent to Claude Code are passed through without modification to preserve intent. However:

- Maximum prompt length limits prevent memory exhaustion
- Output is streamed and truncated if excessively large

### File Paths

File paths are validated before operations:

- Must be absolute paths
- Resolved to prevent directory traversal
- Checked against project boundaries where applicable

### Command Arguments

Arguments passed to subprocess commands:

- Validated against expected patterns
- Arrays used instead of string concatenation
- No shell interpolation of user strings

## Temporary Files

### Cleanup

Temporary files created during execution:

- Stored in session-specific scratchpad directory
- Cleaned up on application exit
- Include: intermediate results, temp scripts, working files

### Secure Deletion (Planned)

Future versions will implement secure deletion for files containing conversation data:

- Overwrite file contents with random data before deletion
- Multiple passes for sensitive files
- Applied to temp files and cleared conversation history

## Approval Workflow

### High-Risk Operations

The following operations require explicit user approval:

| Action Type | Description | Auto-Approve Option |
|-------------|-------------|---------------------|
| `planning` | Large-scale planning operations | Yes (configurable) |
| `architecture` | Architectural changes | No |
| `git_push` | Pushing to remote repositories | No |
| `large_edit` | Bulk file modifications | No |

### Approval Timeout

- Approval requests have configurable timeouts
- Expired requests are marked as timed out (not auto-approved)
- Desktop notifications alert users to pending approvals

## Logging

### What is Logged

- Command executions (command, duration, success/failure)
- Approval queue events
- Token usage statistics
- Error conditions

### What is NOT Logged

- Full conversation content (stored separately)
- API keys or tokens
- File contents

### Log Location

Logs are written to the application data directory:
- Windows: `%APPDATA%/ai-controller/logs/`
- macOS: `~/Library/Application Support/ai-controller/logs/`
- Linux: `~/.config/ai-controller/logs/`

## Recommendations for Users

1. **Review approvals carefully**: Don't approve operations you don't understand
2. **Use project boundaries**: Work within defined project directories
3. **Monitor token usage**: Set appropriate daily/hourly limits
4. **Keep software updated**: Install updates for security patches
5. **Secure ntfy endpoints**: Use authentication for notification servers
6. **Review conversation history**: Periodically audit AI interactions

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Email security concerns to the maintainers
3. Include steps to reproduce the issue
4. Allow time for a fix before public disclosure

## Version History

| Version | Changes |
|---------|---------|
| 0.8.0 | Initial security documentation |
