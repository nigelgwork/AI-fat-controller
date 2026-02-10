# Security Documentation

## Overview

AI Phat Controller is a local developer tool that orchestrates AI agents (Claude Code) to perform software development tasks. It runs as an Express.js server on localhost. Given its privileged access to execute commands and modify files, security is a critical concern.

## Deployment Model

The application runs locally on the developer's machine. It is **not designed for public internet exposure**. The Express server binds to `0.0.0.0:3001` but should only be accessed from localhost.

## Command Execution Model

### Allowed Commands

The application restricts command execution to approved commands:

| Command | Purpose | Notes |
|---------|---------|-------|
| `claude` | Claude Code CLI | Main AI execution engine |

### Why `--dangerously-skip-permissions` is Used

Claude Code requires explicit permission for file system operations. The `--dangerously-skip-permissions` flag is used because:

1. **User-initiated tasks**: All Claude operations are explicitly requested by the user
2. **Approval workflow**: High-risk operations can require manual approval
3. **Sandboxed execution**: Operations are confined to the user's project directories
4. **Audit trail**: All actions are logged and can be reviewed

**Important**: This flag should only be used in controlled environments where the user trusts the AI's actions.

## Data Storage Security

### SQLite Database

Settings, tasks, conversations, and session data are stored in a SQLite database at `./data/controller.db`.

- Database is local to the machine
- No encryption at rest (planned for future)
- WAL mode provides crash safety

### Sensitive Data Handling

| Data Type | Storage | Protection |
|-----------|---------|------------|
| ntfy auth tokens | SQLite settings | Planned encryption |
| Conversation history | SQLite | File system permissions |
| Claude Code output | Memory + SQLite | Not persisted beyond session |
| API responses | Memory only | Garbage collected |

## Network Security

### External Communications

The application communicates with:

1. **Claude Code CLI**: Local process communication via stdin/stdout
2. **ntfy server**: Optional push notifications (user-configured endpoint)
3. **No cloud APIs**: Does not call Anthropic API directly

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

### Command Arguments

Arguments passed to subprocess commands:

- Validated against expected patterns (Zod schemas)
- Arrays used instead of string concatenation
- No shell interpolation of user strings

## Logging

### What is Logged

- Command executions (command, duration, success/failure)
- Approval queue events
- Token usage statistics
- Error conditions

### What is NOT Logged

- Full conversation content (stored separately in SQLite)
- API keys or tokens
- File contents

### Log Location

Logs are written to stdout/stderr (visible in terminal).

## Recommendations for Users

1. **Review approvals carefully**: Don't approve operations you don't understand
2. **Use project boundaries**: Work within defined project directories
3. **Monitor token usage**: Set appropriate daily/hourly limits
4. **Don't expose to the internet**: This is a localhost-only tool
5. **Secure ntfy endpoints**: Use authentication for notification servers
6. **Review conversation history**: Periodically audit AI interactions

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Email security concerns to the maintainers
3. Include steps to reproduce the issue
4. Allow time for a fix before public disclosure
