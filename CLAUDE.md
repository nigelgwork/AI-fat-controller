# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

AI Controller (forked from Gastown UI) is a dashboard + backend for multi-agent orchestration. It includes:

- **Frontend**: Vite + React dashboard for monitoring agents, beads, convoys, and insights
- **Backend**: Electron IPC — all backend functionality runs through Electron main process
- **Beads CLI**: (`bd`) - git-backed issue tracker (MIT licensed, from steveyegge/beads)
- **Claude Code Bridge**: Integration layer that routes natural language commands through Claude Code CLI

## Quick Start

```bash
# One command setup
pnpm setup

# Start the dashboard
pnpm dev
```

The setup script will:
1. Check prerequisites (Go 1.23+, Git, pnpm)
2. Build `gt` and `bd` CLI tools to `./bin/`
3. Install Node dependencies
4. Initialize a Gas Town workspace at `~/gt`

## Development Commands

```bash
pnpm setup       # Full setup (Go tools + Node deps + workspace init)
pnpm dev         # Start Vite dev server at http://localhost:3001
pnpm dev:electron # Start full Electron dev workflow (Vite + tsc watch + Electron)
pnpm build       # Build for production (typecheck + compile Electron + Vite + electron-builder)
```

## Environment Variables

```bash
GASTOWN_PATH=~/gt   # Path to your Gas Town workspace (default: ~/gt)
```

Create `.env.local` with your configuration.

---

## CRITICAL: Process Management Safety

**DO NOT spawn multiple concurrent processes.** Previous sessions crashed bash by spawning too many processes.

### Rules for Claude Code When Working Here:

1. **NEVER run dev servers in background** - `pnpm dev`, `pnpm terminal`, `pnpm gastown` spawn multiple child processes
2. **NEVER use `run_in_background: true`** for npm/pnpm commands in this project
3. **ONE process at a time** - Kill existing processes before starting new ones
4. **Check running processes first** - Run `pgrep -a node` before spawning new processes
5. **Use timeouts** - Always use timeout for any exec calls (already implemented in route.ts)
6. **Prefer direct commands** - Use `gt rig list` directly instead of natural language when possible

### Safe Testing Workflow:

```bash
# 1. Check what's running
pgrep -a node

# 2. Kill any existing dev servers
pkill -f "vite" || true

# 3. Run ONE command in foreground (not background)
pnpm dev
# Ctrl+C to stop when done

# 4. For API testing, use curl instead of running dev server
curl http://localhost:3001/api/beads
```

### Dangerous Patterns to Avoid:

```bash
# BAD: Running multiple servers
pnpm dev &
pnpm terminal &
pnpm gastown &

# BAD: Background with concurrently
pnpm dev:all &

# BAD: Multiple Claude Code calls in parallel
for i in {1..10}; do claude "test" & done
```

---

## Project Structure

```
ai-controller/
├── frontend/               # Vite + React frontend
│   ├── src/                # React source
│   │   ├── App.tsx         # Main app component
│   │   ├── components/     # Shared components
│   │   ├── lib/            # Utilities
│   │   └── types/          # TypeScript definitions
│   └── index.html          # Entry HTML
├── electron/               # Electron main process (TypeScript)
│   ├── main.ts             # Main process entry
│   ├── preload.ts          # Preload script (contextBridge)
│   ├── ipc/                # IPC handlers
│   ├── services/           # Backend services (executor, settings, etc.)
│   ├── stores/             # Persistent stores
│   └── utils/              # Utilities (logger, etc.)
├── dist-electron/          # Compiled Electron JS (from tsc)
├── bin/                    # Built CLI binaries (gt, bd)
├── scripts/
│   ├── setup.sh            # Full setup script
│   └── build-go-tools.sh   # Go CLI build script
└── docs/                   # Documentation
```

## Architecture

### Frontend Tech Stack

- Vite + React 19
- TypeScript 5
- Tailwind CSS
- @xyflow/react (React Flow) for dependency graphs
- TanStack Query for data fetching
- Lucide React for icons
- Zustand for state management

### Backend Integration

The API routes execute CLI commands or parse files directly:

| Route | Data Source |
|-------|-------------|
| `/api/beads` | Parse `.beads/beads.jsonl` |
| `/api/agents` | `gt status --json` |
| `/api/convoys` | `gt convoy list --json` |
| `/api/insights` | `bv --robot-insights` |
| `/api/mail` | `gt mail inbox --json` |
| `/api/mayor` | Direct commands or Claude Code bridge |
| `/api/mayor/status` | Claude Code availability check |

### Claude Code Bridge

The `/api/mayor` endpoint routes requests two ways:

1. **Direct commands** (`gt rig list`, `bd list`) - Executed directly via `execFileAsync`
2. **Natural language** - Routed through `scripts/claude-bridge.sh` to Claude Code CLI

```
User Input → API Route → Is direct command?
                              │
                    ┌─────────┴─────────┐
                    │ YES               │ NO
                    ▼                   ▼
              execFileAsync       claude-bridge.sh
              (gt/bd command)     (Claude Code CLI)
```

### Gas Town Concepts

- **Town**: Workspace root (`~/gt`) containing all projects
- **Rig**: A git project under Gas Town management
- **Bead**: Atomic unit of work (issue) stored in JSONL
- **Convoy**: Grouped beads for tracking related work
- **Hook**: Where work hangs for an agent (persists across restarts)
- **Agent Roles**:
  - Mayor: Cross-rig coordinator
  - Witness: Monitors polecats per rig
  - Refinery: Merge queue per rig
  - Polecat: Ephemeral worker (spawn → work → disappear)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/beads.ts` | JSONL parser for `.beads/beads.jsonl` |
| `src/lib/gastown.ts` | CLI wrapper for `gt`, `bd`, `bv` |
| `src/types/gastown.ts` | TypeScript types (Bead, Agent, Convoy, etc.) |
| `src/app/api/mayor/route.ts` | Controller API with Claude Code integration |
| `src/app/terminal/page.tsx` | Controller chat UI |
| `scripts/claude-bridge.sh` | Claude Code CLI wrapper script |
| `server/terminal-server.ts` | WebSocket server for terminal (node-pty) |
| `scripts/setup.sh` | Full setup script |

---

## Progress Log

### 2025-01-22: Claude Code Bridge Integration (In Progress)

**Goal**: Replace Anthropic API direct calls with Claude Code CLI integration

**Changes Made**:
- [x] Renamed project from `gastown-ui` to `ai-controller`
- [x] Rebranded UI: "Gas Town" → "AI Controller", "Mayor" → "Controller"
- [x] Changed color scheme from amber to cyan
- [x] Created `scripts/claude-bridge.sh` - Claude Code CLI wrapper
- [x] Rewrote `/api/mayor/route.ts`:
  - Switched from `execSync` to `execFileAsync` (safer, async)
  - Direct command execution for `gt` and `bd` commands
  - Natural language routing through Claude Code bridge
  - Added proper timeouts and error handling
- [x] Updated `/api/mayor/status/route.ts` to check Claude Code availability
- [x] Updated terminal page UI with Claude Code status banner
- [x] Updated sidebar icons and labels

**Remaining**:
- [ ] Test Claude Code bridge integration end-to-end
- [ ] Handle Claude Code not installed gracefully
- [ ] Add conversation context/history support
- [ ] Commit and push changes

**Issue Encountered**: Session crashed due to spawning too many processes. Added safety documentation above.

---

## Project Plan

### Phase 1: Complete Claude Code Integration (Current)
1. Test the bridge script manually
2. Verify API routes work with Claude Code
3. Handle edge cases (Claude Code not installed, timeouts)
4. Commit current progress

### Phase 2: Enhanced Controller Features
1. Add conversation history/context persistence
2. Implement streaming responses from Claude Code
3. Add quick action buttons for common workflows
4. Improve error messages and fallbacks

### Phase 3: Dashboard Improvements
1. Real-time updates via polling or WebSocket
2. Better visualization of agent states
3. Convoy progress tracking
4. Bead dependency graph

### Phase 4: Production Readiness
1. Add proper logging
2. Error monitoring
3. Rate limiting for Claude Code calls
4. Documentation for deployment

---

## Using with Gas Town

After setup:

```bash
# Add PATH to use the CLI tools
export PATH="$PATH:$(pwd)/bin"

# Initialize workspace (if not done by setup)
gt install ~/gt

# Add a project
cd ~/gt
gt rig add myproject https://github.com/you/repo.git

# Start the Mayor session (AI coordinator)
gt prime

# Or use the dashboard
pnpm dev
# Open http://localhost:3001
```
