# AI Fat Controller - Development Roadmap

This document outlines a phased approach to address all identified issues and complete planned features.

---

## Phase 0: Critical Stability (Estimated: 2-3 days)

**Goal**: Fix issues that could cause crashes, security vulnerabilities, or data loss.

### 0.1 Electron Upgrade
- [ ] Update Electron 33.4.11 → 40.1.0
- [ ] Update electron-builder 25.1.8 → 26.7.0
- [ ] Update electron-store 8.2.0 → 11.0.2
- [ ] Test auto-updater still works with new versions
- [ ] Verify Windows + WSL execution modes work

### 0.2 Memory Leak Fixes
- [ ] Add cleanup for tray menu interval (`main.ts:172`)
- [ ] Add cleanup for auto-updater check interval (`auto-updater.ts`)
- [ ] Add cleanup for ntfy polling interval (`ntfy.ts`)
- [ ] Add `app.on('before-quit')` handler to clean all intervals
- [ ] Add periodic cleanup of `runningProcesses` Map in executor

### 0.3 Crash Prevention
- [ ] Add null-safety wrapper for BrowserWindow broadcasts (37 instances)
  - Create helper: `safeBroadcast(channel, data)` that checks window exists
  - Replace all `BrowserWindow.getAllWindows().forEach()` calls
- [ ] Add global unhandled rejection handler in main process
- [ ] Add error boundaries in React frontend

### 0.4 Process Lifecycle
- [ ] Clean up running processes on app exit
- [ ] Clean up old executor when switching modes
- [ ] Fix race condition in idle timeout vs natural process exit

**Deliverables**:
- App doesn't leak memory over extended use
- No crashes from destroyed windows
- Clean shutdown with no orphaned processes

---

## Phase 1: Code Quality & Structure (Estimated: 3-4 days)

**Goal**: Reduce technical debt and improve maintainability.

### 1.1 Executor Refactor
- [ ] Split `executor.ts` (1,460 lines) into:
  - `executor/types.ts` - Interfaces and types
  - `executor/base.ts` - Abstract base executor
  - `executor/windows.ts` - WindowsExecutor class
  - `executor/wsl.ts` - WslExecutor class
  - `executor/index.ts` - Factory and exports
- [ ] Extract duplicate JSON parsing into shared utility
- [ ] Add proper TypeScript types (remove 10 `any` usages)

### 1.2 Logging Infrastructure
- [ ] Add structured logging library (winston or pino)
- [ ] Replace 103 `console.log` calls with proper logger
- [ ] Add log levels (debug, info, warn, error)
- [ ] Add log rotation for production
- [ ] Add log file location in settings

### 1.3 Error Handling
- [ ] Create custom error classes for different failure types
- [ ] Add user-friendly error messages
- [ ] Add error reporting/tracking infrastructure
- [ ] Improve error recovery in file operations

### 1.4 Type Safety
- [ ] Add runtime validation for settings values
- [ ] Add Zod schemas for external data (Claude responses, file formats)
- [ ] Fix unsafe type casts throughout codebase

**Deliverables**:
- Cleaner, more maintainable code structure
- Consistent logging across all services
- Better error messages for users
- Stronger type safety

---

## Phase 2: Core Feature Completion (Estimated: 5-7 days)

**Goal**: Complete the partially-implemented features.

### 2.1 Token Limit Enforcement
- [ ] Implement actual blocking when limits reached (not just warnings)
- [ ] Add hourly reset logic with proper time tracking
- [ ] Add daily reset logic
- [ ] Add pause/resume based on limit status
- [ ] Add UI indicator showing time until limit reset
- [ ] Store historical token usage for analytics

### 2.2 Conversation Context
- [ ] Load conversation history into Claude prompts
- [ ] Implement token counting for context window management
- [ ] Add conversation summarization when approaching limit
- [ ] Add context pruning strategy (oldest first, smart selection)
- [ ] Persist conversation metadata (tokens used, model, cost)

### 2.3 Approval Workflow
- [ ] Complete approval request processing backend
- [ ] Wire up approval UI to backend actions
- [ ] Add approval history/audit log
- [ ] Add auto-approval rules configuration
- [ ] Add timeout handling for pending approvals
- [ ] Add notification for pending approvals (system tray)

### 2.4 Streaming Responses
- [ ] Connect JSON stream parsing to real-time UI updates
- [ ] Show tool calls as they happen in UI
- [ ] Add streaming text display for Claude responses
- [ ] Add cancel button during streaming
- [ ] Add progress indicator for long operations

**Deliverables**:
- Working token limit system that actually prevents overuse
- Conversation history maintained across sessions
- Functional approval workflow with UI
- Real-time streaming feedback in UI

---

## Phase 3: Testing & Reliability (Estimated: 4-5 days)

**Goal**: Add comprehensive test coverage and improve reliability.

### 3.1 Unit Tests
- [ ] Set up Vitest for Electron main process tests
- [ ] Add tests for executor services
  - Windows path conversion
  - WSL path conversion
  - JSON response parsing
  - Process lifecycle management
- [ ] Add tests for controller service
  - Token usage calculation
  - Limit checking
  - State transitions
- [ ] Add tests for conversation service
  - Session CRUD operations
  - Entry persistence
  - Index synchronization

### 3.2 Integration Tests
- [ ] Add tests for IPC communication
- [ ] Add tests for settings persistence
- [ ] Add tests for file operations
- [ ] Mock Claude Code CLI responses for testing

### 3.3 Frontend Tests
- [ ] Set up React Testing Library
- [ ] Add tests for critical UI components
- [ ] Add tests for state management
- [ ] Add E2E tests with Playwright

### 3.4 Reliability Improvements
- [ ] Add transaction safety for conversation files
- [ ] Add file locking for concurrent access
- [ ] Add backup/recovery for corrupted files
- [ ] Add health checks for external dependencies

**Deliverables**:
- 70%+ test coverage on critical paths
- CI pipeline running tests on PR
- Confidence in refactoring

---

## Phase 4: Security Hardening (Estimated: 2-3 days)

**Goal**: Address all identified security concerns.

### 4.1 Input Validation
- [ ] Validate WSL distro name format before use
- [ ] Sanitize file paths before operations
- [ ] Validate Claude API responses before processing
- [ ] Add input validation on all IPC handlers

### 4.2 Process Security
- [ ] Evaluate alternatives to `shell: true` on Windows
- [ ] Add command allowlist for executor
- [ ] Sandbox spawned processes where possible
- [ ] Audit `--dangerously-skip-permissions` usage

### 4.3 Data Security
- [ ] Audit what gets logged (remove sensitive paths)
- [ ] Ensure no credentials in logs or persisted data
- [ ] Add secure deletion for sensitive temp files
- [ ] Review electron-store encryption settings

### 4.4 Dependency Security
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Set up Dependabot or similar
- [ ] Review dependency licenses
- [ ] Pin dependency versions

**Deliverables**:
- No critical security vulnerabilities
- Automated security scanning
- Documented security model

---

## Phase 5: Dashboard & UX (Estimated: 5-7 days)

**Goal**: Complete the dashboard features from the original roadmap.

### 5.1 Real-Time Updates
- [ ] Enable polling for active sessions
- [ ] Add WebSocket option for lower latency
- [ ] Add connection status indicator
- [ ] Handle reconnection gracefully

### 5.2 Agent Visualization
- [ ] Improve agent state display
- [ ] Add agent activity timeline
- [ ] Add agent resource usage (tokens, time)
- [ ] Add agent communication visualization

### 5.3 Convoy Tracking
- [ ] Complete convoy progress UI
- [ ] Add convoy dependency visualization
- [ ] Add convoy completion estimates
- [ ] Add convoy history

### 5.4 Analytics Dashboard
- [ ] Token usage over time charts
- [ ] Cost tracking and projections
- [ ] Task completion metrics
- [ ] Performance benchmarks

### 5.5 UX Improvements
- [ ] Add quick action buttons for common workflows
- [ ] Improve error message display
- [ ] Add keyboard shortcuts
- [ ] Add dark/light theme toggle
- [ ] Add onboarding flow for new users

**Deliverables**:
- Polished, responsive dashboard
- Real-time visibility into system state
- Actionable analytics

---

## Phase 6: Advanced Features (Estimated: ongoing)

**Goal**: Add new capabilities beyond original scope.

### 6.1 Multi-Agent Support
- [ ] Parallel agent execution
- [ ] Agent coordination/communication
- [ ] Agent specialization (different models/prompts)
- [ ] Agent pool management

### 6.2 Project Intelligence
- [ ] Automatic project analysis on add
- [ ] Code quality scoring
- [ ] Dependency vulnerability alerts
- [ ] Suggested tasks based on codebase

### 6.3 Workflow Automation
- [ ] Saved workflow templates
- [ ] Scheduled task execution
- [ ] Git hook integration
- [ ] CI/CD integration

### 6.4 Collaboration
- [ ] Multi-user support
- [ ] Shared conversation history
- [ ] Team activity feed
- [ ] Role-based access control

**Deliverables**:
- Advanced orchestration capabilities
- Smarter automation
- Team collaboration features

---

## Dependency Graph

```
Phase 0 (Critical)
    │
    ├──► Phase 1 (Code Quality)
    │        │
    │        └──► Phase 3 (Testing)
    │                 │
    │                 └──► Phase 4 (Security)
    │
    └──► Phase 2 (Features)
             │
             └──► Phase 5 (Dashboard)
                      │
                      └──► Phase 6 (Advanced)
```

**Notes**:
- Phase 0 must complete first (stability baseline)
- Phases 1 and 2 can run in parallel
- Phase 3 depends on Phase 1 (need clean code to test)
- Phase 4 can start after Phase 1
- Phase 5 depends on Phase 2 (features to display)
- Phase 6 is ongoing/incremental

---

## Time Estimates Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Critical Stability | 2-3 days | None |
| Phase 1: Code Quality | 3-4 days | Phase 0 |
| Phase 2: Core Features | 5-7 days | Phase 0 |
| Phase 3: Testing | 4-5 days | Phase 1 |
| Phase 4: Security | 2-3 days | Phase 1 |
| Phase 5: Dashboard | 5-7 days | Phase 2 |
| Phase 6: Advanced | Ongoing | Phase 5 |

**Total to production-ready (Phases 0-5)**: ~21-29 days

---

## How to Track Progress

Each task can be tracked using the checkbox format above. When starting work:

1. Move task to "In Progress" section
2. Create feature branch: `phase-X/task-name`
3. Complete implementation
4. Add tests (Phase 3+)
5. Update this document
6. Create PR for review

---

## Version Milestones

| Version | Phases | Description |
|---------|--------|-------------|
| v0.7.0 | Phase 0 | Stability release |
| v0.8.0 | Phase 1+2 | Feature complete |
| v0.9.0 | Phase 3+4 | Production ready |
| v1.0.0 | Phase 5 | Full dashboard |
| v1.x | Phase 6 | Advanced features |

---

*Last updated: 2026-02-03*
