# AI Phat Controller - Development Roadmap

> **Current state**: v1.5.0 — Restructured from Electron app to plain Node.js server with section-based navigation, diagnostics bar, terminal management, and dual-environment (Windows/WSL) support.

---

## Completed

### Stability & Code Quality (Phases 0-1)
- [x] Process lifecycle management, memory leak fixes
- [x] Structured logging, error handling, custom error classes
- [x] Runtime validation with Zod schemas
- [x] Executor refactor (split into types/utils/impl)

### Core Features (Phase 2)
- [x] Token limit enforcement with hourly/daily resets
- [x] Conversation context management
- [x] Approval workflow with UI
- [x] Streaming responses with real-time UI

### Restructuring (v1.5.0)
- [x] Remove Electron, Gas Town, Clawdbot, and dead code (~80+ files)
- [x] Section-based sidebar navigation (Dashboard, Projects, Resources, Terminals, Controller)
- [x] Top bar with version, notifications bell, theme toggle, settings
- [x] Diagnostics bar (CPU, RAM, app memory, uptime, weekly token usage)
- [x] Windows/WSL environment grouping in Sessions and Agents pages
- [x] Terminal session management (launch, view output, send input)
- [x] Notification dropdown from top bar

---

## Next Steps

### Testing & Reliability
- [ ] Add server-side tests for API routes
- [ ] Add tests for terminal-manager service
- [ ] Add E2E tests with Playwright
- [ ] Improve frontend test coverage (currently 41 tests)

### Security
- [ ] Audit `--dangerously-skip-permissions` usage in terminal launcher
- [ ] Add command validation for terminal manager
- [ ] Review dependency security

### UX Polish
- [ ] Add keyboard shortcuts documentation (Ctrl+B sidebar, Ctrl+K command palette)
- [ ] Improve mobile/responsive layout
- [ ] Add loading skeletons for all data-fetching pages
- [ ] Add command palette integration for terminal launching

### Advanced Features
- [ ] WebSocket streaming for terminal output (replace polling)
- [ ] Multi-agent parallel execution
- [ ] Scheduled task execution
- [ ] Teams/Google Chat webhook integration for notifications
- [ ] Skills browser page
- [ ] MCP server dual-environment config (copy between Windows/WSL)

---

## Version History

| Version | Description |
|---------|-------------|
| v0.7.0 | Stability release (process management, memory fixes) |
| v0.8.0 | Feature complete (token limits, approvals, streaming) |
| v1.4.0 | Migrated to plain Node.js server |
| v1.5.0 | Restructured: new layout, terminal management, removed dead code |

---

*Last updated: 2026-02-07*
