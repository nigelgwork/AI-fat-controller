# Architecture

## System Overview

AI Phat Controller is a local developer tool with a React frontend and Express backend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI Phat Controller                                  │
│                                                                              │
│  ┌────────────────────────────┐       ┌────────────────────────────────┐    │
│  │      Frontend              │       │          Backend               │    │
│  │      (Vite + React)        │       │          (Express.js)          │    │
│  │                            │       │                                │    │
│  │  ┌──────────────────────┐  │       │  ┌──────────────────────────┐  │    │
│  │  │ Pages (16)           │  │ HTTP  │  │ REST API Routes (21)     │  │    │
│  │  │ Dashboard, Controller│  │──────▶│  │ /api/tasks               │  │    │
│  │  │ Tasks, Sessions,     │  │       │  │ /api/claude              │  │    │
│  │  │ Projects, Settings...│  │◀──────│  │ /api/settings            │  │    │
│  │  └──────────────────────┘  │  JSON │  │ /api/projects            │  │    │
│  │                            │       │  │ /api/sessions            │  │    │
│  │  ┌──────────────────────┐  │       │  │ /api/system  ...         │  │    │
│  │  │ State Management     │  │       │  └──────────────────────────┘  │    │
│  │  │ TanStack Query       │  │       │                                │    │
│  │  │ Zustand              │  │  WS   │  ┌──────────────────────────┐  │    │
│  │  └──────────────────────┘  │◀─────▶│  │ WebSocket Server         │  │    │
│  │                            │       │  │ (live updates)            │  │    │
│  │  ┌──────────────────────┐  │       │  └──────────────────────────┘  │    │
│  │  │ Visualization        │  │       │                                │    │
│  │  │ @xyflow/react        │  │       │  ┌──────────────────────────┐  │    │
│  │  │ (dependency graphs)  │  │       │  │ SQLite Database          │  │    │
│  │  └──────────────────────┘  │       │  │ (better-sqlite3)         │  │    │
│  │                            │       │  │                          │  │    │
│  │  Port: 5173 (dev)         │       │  │ Tables: tasks, sessions, │  │    │
│  │  Served from :3001 (prod) │       │  │ settings, conversations, │  │    │
│  └────────────────────────────┘       │  │ projects, token_history  │  │    │
│                                        │  └──────────────────────────┘  │    │
│                                        │                                │    │
│                                        │  ┌──────────────────────────┐  │    │
│                                        │  │ External Processes       │  │    │
│                                        │  │                          │  │    │
│                                        │  │ claude (Code CLI)        │  │    │
│                                        │  └──────────────────────────┘  │    │
│                                        │                                │    │
│                                        │  Port: 3001                   │    │
│                                        └────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Request Flow

```
  Browser                    Express Server               External
  ───────                    ──────────────               ────────

  User clicks              ┌──────────────┐
  "Run Task"  ───────────▶ │ POST         │
                            │ /api/claude  │
                            │ /execute     │
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │ Validate     │
                            │ (Zod schema) │
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐            ┌──────────────┐
                            │ Spawn        │───────────▶│ claude       │
                            │ child_process│            │ --print      │
                            │              │◀───────────│ --output-fmt │
                            └──────┬───────┘   stdout   │ json         │
                                   │                    └──────────────┘
                            ┌──────▼───────┐
                            │ Parse JSON   │
                            │ response     │
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │ Store in     │
                            │ SQLite       │
                            │ (session,    │
                            │  tokens)     │
                            └──────┬───────┘
                                   │
  UI updates  ◀────────────────────┘
  via response
```

## Data Layer

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SQLite Database                              │
│                         ./data/controller.db                        │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ tasks           │  │ projects        │  │ settings            │ │
│  │                 │  │                 │  │                     │ │
│  │ id              │  │ id              │  │ key                 │ │
│  │ title           │  │ name            │  │ value               │ │
│  │ status          │  │ path            │  │ updated_at          │ │
│  │ description     │  │ created_at      │  └─────────────────────┘ │
│  │ created_at      │  └─────────────────┘                          │
│  └─────────────────┘                                                │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ conversations   │  │ execution_      │  │ token_history       │ │
│  │                 │  │ sessions        │  │                     │ │
│  │ id              │  │                 │  │ id                  │ │
│  │ project_id      │  │ id              │  │ session_id          │ │
│  │ messages (JSON) │  │ session_id      │  │ input_tokens        │ │
│  │ created_at      │  │ status          │  │ output_tokens       │ │
│  └─────────────────┘  │ started_at      │  │ timestamp           │ │
│                        └─────────────────┘  └─────────────────────┘ │
│                                                                      │
│  Migrations: server/db/migrations/*.sql                             │
│  Repository pattern: server/db/repositories/*-repo.ts               │
└─────────────────────────────────────────────────────────────────────┘
```

## Deployment Modes

### Native (primary)

```
┌────────────────────────────────────────────┐
│              Your Machine                   │
│                                             │
│  pnpm dev                                   │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Vite dev server  │  │ Express server  │  │
│  │ :5173 (HMR)      │  │ :3001           │  │
│  │                  │  │                 │  │
│  │ Proxies /api/*───┼─▶│ API + WebSocket │  │
│  │ to :3001         │  │ SQLite DB       │  │
│  └─────────────────┘  └────────┬────────┘  │
│                                 │           │
│                        ┌────────▼────────┐  │
│                        │ claude CLI      │  │
│                        │ (in PATH)       │  │
│                        └─────────────────┘  │
│                                             │
│  pnpm start (production)                    │
│  ┌──────────────────────────────────────┐   │
│  │ Express server :3001                 │   │
│  │ Serves built frontend from dist/     │   │
│  │ API + WebSocket + static files       │   │
│  └──────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

## Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Overview stats, quick navigation |
| Projects | `/projects` | Project management |
| New Project | `/projects/new` | Create new project |
| Tasks | `/projects/tasks` | Task management with status workflows |
| Sessions | `/projects/sessions` | Active Claude Code sessions (WSL/Win grouped) |
| History | `/projects/history` | Claude Code session history |
| Agents | `/resources/agents` | Agent definitions (WSL/Win grouped) |
| MCP | `/resources/mcp` | MCP server configuration |
| Skills | `/resources/skills` | Skills/commands management |
| Terminals | `/terminals` | Terminal session management |
| Settings | `/settings` | App configuration, debug info |

## API Routes

All routes are under `/api/` and defined in `server/routes/`.

| Route | Method(s) | Purpose |
|-------|-----------|---------|
| `/api/tasks` | CRUD | Task management |
| `/api/projects` | CRUD | Project management |
| `/api/claude` | POST | Execute Claude Code commands |
| `/api/claude-sessions` | GET | Claude session history |
| `/api/sessions` | CRUD | Execution session management |
| `/api/conversations` | CRUD | Conversation history |
| `/api/settings` | GET/PUT | App settings |
| `/api/mode` | GET | Execution mode detection |
| `/api/token-history` | GET | Token usage analytics |
| `/api/activity` | GET | Activity log |
| `/api/mcp` | CRUD | MCP server configuration |
| `/api/ntfy` | POST | Push notifications |
| `/api/agents` | CRUD | Agent definitions |
| `/api/skills` | CRUD | Skills management |
| `/api/terminals` | CRUD | Terminal session management |
| `/api/filesystem` | GET | Directory browsing |
| `/api/system` | GET | Health check, version, debug, metrics |

## Build Pipeline

```
pnpm run build
    │
    ├── pnpm run build:frontend
    │   └── vite build
    │       └── Output: dist/           (HTML + JS + CSS)
    │
    ├── pnpm run build:server
    │   └── tsc -p tsconfig.server.json
    │       └── Output: dist-server/    (compiled JS)
    │
    └── pnpm run copy-assets
        └── cp -r server/db/migrations dist-server/server/db/
            └── Copies .sql files tsc ignores
```

## Key Design Decisions

1. **SQLite over file-based storage**: Atomic operations, proper migrations, repository pattern for data access. Single file at `./data/controller.db`.

2. **Express over Next.js**: Decoupled frontend/backend allows independent development. Vite for fast frontend HMR, Express for stable API server.

3. **Spawn over API for Claude**: Uses `claude` CLI directly via `child_process.spawn()` rather than the Anthropic HTTP API. This gives access to Claude Code's full toolset (file editing, bash, etc.).
