# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

AI Phat Controller is a local dashboard + backend for managing Claude Code sessions, tasks, agents, and multi-agent orchestration. It consists of:

- **Frontend**: Vite + React 19 SPA with section-based sidebar navigation
- **Backend**: Express.js server with SQLite database, REST API, and WebSocket support
- **Claude Code Integration**: Spawns Claude Code CLI as child processes for AI operations
- **Terminal Management**: Launch and manage Claude Code terminal sessions from the UI

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm dev              # Start Vite (:5173) + Express (:3001)
pnpm start            # Build and start production server
pnpm test:run         # Run tests
```

## Architecture

```
Frontend (Vite + React)          Backend (Express.js)
:5173 (dev) / :3001 (prod)      :3001

  React 19 + TypeScript            REST API (16 routes)
  TanStack Query                   WebSocket (live updates)
  Zustand                          SQLite (better-sqlite3)
  @xyflow/react                    Claude Code CLI (spawned)
  Tailwind CSS 3                   Terminal Manager
```

In development, Vite runs on :5173 with HMR and proxies API calls to Express on :3001. In production, Express serves the built frontend from `dist/`.

## Development Commands

```bash
pnpm dev              # Start both Vite + Express (concurrently)
pnpm dev:server       # Start Express only (tsx watch)
pnpm build            # Build frontend + server + copy migration assets
pnpm build:frontend   # Build Vite frontend to dist/
pnpm build:server     # Compile server TypeScript to dist-server/
pnpm start            # Build everything then start server
pnpm test:run         # Run Vitest test suite
pnpm lint             # ESLint
pnpm typecheck        # TypeScript type check
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATA_DIR` | `./data` | SQLite database directory |
| `EXECUTION_MODE` | `linux` | Execution mode |

---

## CRITICAL: Process Management Safety

**DO NOT spawn multiple concurrent processes.** Previous sessions crashed bash by spawning too many processes.

### Rules:

1. **NEVER run dev servers in background** - `pnpm dev` spawns multiple child processes via concurrently
2. **NEVER use `run_in_background: true`** for npm/pnpm commands in this project
3. **ONE process at a time** - Kill existing processes before starting new ones
4. **Check running processes first** - Run `pgrep -a node` before spawning new processes
5. **Use timeouts** - Always use timeout for any exec calls

---

## Frontend Routes

```
/                     → Dashboard (overview stats, running sessions)
/controller           → Phat Controller (AI orchestration chat)
/projects             → Project management (add, edit, remove)
/projects/new         → Create new project
/projects/tasks       → Task management
/projects/sessions    → Active Claude Code sessions (Windows + WSL grouped)
/projects/history     → Activity log
/resources/agents     → Agent definitions (Windows + WSL, copy between)
/resources/mcp        → MCP server configuration
/terminals            → Terminal session management (launch, view output)
/settings             → Configuration (mode, ntfy, usage limits, MCP, debug)
```

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [AI Phat Controller]  v1.x       [?] [🔔] [◑] [⚙]        │  TopBar
├────────────┬────────────────────────────────────────────────┤
│ DASHBOARD  │                                                │
│  Overview  │  [Page content - Outlet]                       │
│ PROJECTS   │                                                │
│  Projects  │                                                │
│  Tasks     │                                                │
│  Sessions  │                                                │
│  History   │                                                │
│ RESOURCES  │                                                │
│  Agents    │                                                │
│  MCP       │                                                │
│ TERMINALS  │                                                │
│  Terminals │                                                │
│ CONTROLLER │                                                │
│  Phat Ctrl │                                                │
├────────────┼────────────────────────────────────────────────┤
│ Settings   │                                                │
│ Collapse ◂ │                                                │
├────────────┴────────────────────────────────────────────────┤
│ CPU: 12% | RAM: 45% | App: 180MB | 2h 15m  | Weekly: 145k │  DiagnosticsBar
└─────────────────────────────────────────────────────────────┘
```

Sidebar collapses via Ctrl/Cmd+B keyboard shortcut.

## Project Structure

```
ai-controller/
├── frontend/                   # Vite + React SPA
│   ├── src/
│   │   ├── pages/              # Page components (10 pages)
│   │   │   ├── Dashboard.tsx   # Overview stats + running sessions
│   │   │   ├── Controller.tsx  # AI Controller chat
│   │   │   ├── Tasks.tsx       # Task management
│   │   │   ├── Sessions.tsx    # Claude Code sessions (WSL/Win grouped)
│   │   │   ├── Projects.tsx    # Project management
│   │   │   ├── NewProject.tsx  # Create new project
│   │   │   ├── Terminals.tsx   # Terminal session management
│   │   │   ├── Agents.tsx      # Agent definitions
│   │   │   ├── ActivityLog.tsx # Activity history
│   │   │   └── Settings.tsx    # Configuration + debug
│   │   ├── components/         # Shared UI (15 components)
│   │   │   ├── Layout.tsx      # App shell (TopBar + Sidebar + main)
│   │   │   ├── TopBar.tsx      # Header with version, notifications, settings
│   │   │   ├── Sidebar.tsx     # Collapsible section-based navigation
│   │   │   ├── DiagnosticsBar.tsx # System metrics footer
│   │   │   ├── MCPServerConfig.tsx # MCP server panel
│   │   │   └── ...
│   │   ├── api/                # API client (server-api.ts)
│   │   ├── hooks/              # Custom React hooks
│   │   └── __tests__/          # Vitest test files
│   └── index.html
│
├── server/                     # Express.js backend
│   ├── index.ts                # Server entry point
│   ├── routes/                 # API routes (16 modules)
│   │   ├── tasks.ts            # Task CRUD
│   │   ├── claude.ts           # Execute Claude Code
│   │   ├── settings.ts         # App settings
│   │   ├── projects.ts         # Project management
│   │   ├── agents.ts           # Agent definitions
│   │   ├── terminals.ts        # Terminal session management
│   │   ├── controller.ts       # AI Controller operations
│   │   ├── conversations.ts    # Chat history
│   │   ├── execution-sessions.ts
│   │   ├── claude-sessions.ts
│   │   ├── token-history.ts
│   │   ├── mode.ts
│   │   ├── system.ts           # Health, version, debug, metrics
│   │   ├── ntfy.ts             # Notifications
│   │   ├── mcp.ts              # MCP server config
│   │   └── activity.ts         # Activity log
│   ├── db/
│   │   ├── database.ts         # SQLite init + migrations
│   │   ├── repositories/       # Data access layer
│   │   └── migrations/         # SQL migration files
│   ├── services/               # Business logic
│   │   ├── executor/           # Claude Code execution
│   │   ├── terminal-manager.ts # Terminal session spawning
│   │   ├── mode-detection.ts   # Linux/Docker/WSL detection
│   │   ├── settings.ts         # Settings service
│   │   └── ...
│   ├── middleware/              # Express middleware
│   ├── utils/                  # Logger, paths, errors
│   └── websocket.ts            # WebSocket server
│
├── shared/                     # Types shared between frontend/server
│   └── types/index.ts
│
├── bin/cli.js                  # CLI entry point (npx)
├── Dockerfile                  # Docker build
├── docker-compose.yml          # Docker Compose
├── vite.config.ts              # Vite config
├── tsconfig.json               # Frontend TypeScript config
├── tsconfig.server.json        # Server TypeScript config
├── vitest.config.ts            # Test config
└── docs/                       # Documentation
    ├── ARCHITECTURE.md          # Detailed architecture diagrams
    ├── SECURITY.md              # Security model
    ├── folder-structure.md      # Naming conventions
    └── clean-code.md            # Code quality guidelines
```

## Key Files

| File | Purpose |
|------|---------|
| `server/index.ts` | Express server entry, middleware, route registration |
| `server/db/database.ts` | SQLite init, migrations runner |
| `server/services/mode-detection.ts` | Detect Claude CLI, Docker, WSL |
| `server/services/terminal-manager.ts` | Spawn and manage terminal sessions |
| `server/services/settings.ts` | Settings service (SQLite-backed) |
| `frontend/src/api/server-api.ts` | Frontend API client |
| `frontend/src/App.tsx` | React Router setup |
| `frontend/src/components/Layout.tsx` | App shell (TopBar + Sidebar + DiagnosticsBar) |
| `shared/types/index.ts` | Shared TypeScript interfaces |
| `bin/cli.js` | npm/npx CLI entry point |

## API Routes

All routes mount under `/api/` in `server/index.ts`:

| Route | Source | Purpose |
|-------|--------|---------|
| `/api/tasks` | `routes/tasks.ts` | Task CRUD |
| `/api/projects` | `routes/projects.ts` | Project management |
| `/api/claude` | `routes/claude.ts` | Execute Claude Code |
| `/api/sessions` | `routes/execution-sessions.ts` | Session tracking |
| `/api/conversations` | `routes/conversations.ts` | Chat history |
| `/api/settings` | `routes/settings.ts` | App settings |
| `/api/mode` | `routes/mode.ts` | Mode detection |
| `/api/system` | `routes/system.ts` | Health, version, debug, metrics |
| `/api/controller` | `routes/controller.ts` | AI Controller ops |
| `/api/terminals` | `routes/terminals.ts` | Terminal session management |
| `/api/token-history` | `routes/token-history.ts` | Token analytics |
| `/api/activity` | `routes/activity.ts` | Activity log |
| `/api/agents` | `routes/agents.ts` | Agent definitions |
| `/api/claude-sessions` | `routes/claude-sessions.ts` | Claude session history |
| `/api/ntfy` | `routes/ntfy.ts` | Notifications |
| `/api/mcp` | `routes/mcp.ts` | MCP server config |

## Tech Stack

### Frontend
- React 19 + TypeScript 5
- Vite 6 (build + HMR)
- Tailwind CSS 3
- TanStack Query 5 (data fetching)
- Zustand 5 (state management)
- @xyflow/react 12 (dependency graphs)
- React Router 7
- Lucide React (icons)

### Backend
- Express 4 + TypeScript
- SQLite via better-sqlite3
- Zod 4 (runtime validation)
- ws (WebSocket)

### Testing
- Vitest 4
- React Testing Library
- jsdom

## Database

SQLite database at `$DATA_DIR/controller.db` (default: `./data/controller.db`).

- Migrations in `server/db/migrations/*.sql`, applied automatically on startup
- Repository pattern in `server/db/repositories/`
- WAL mode enabled for concurrent read performance

## Build Outputs

| Command | Output | Contents |
|---------|--------|----------|
| `build:frontend` | `dist/` | Vite-built HTML + JS + CSS |
| `build:server` | `dist-server/` | Compiled TypeScript |
| `copy-assets` | `dist-server/server/db/` | SQL migration files |

In production, Express serves `dist/` as static files and handles API routes.
