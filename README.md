# AI Phat Controller

A local dashboard for managing Claude Code sessions, tasks, agents, and terminal sessions.

## What It Does

- **Dashboard**: Monitor sessions, tasks, and system metrics from a web UI
- **Terminal Management**: Launch and manage Claude Code terminal sessions
- **Session Tracking**: View active and recent Claude Code sessions (WSL/Windows grouped)
- **Task Management**: Create and manage tasks with status workflows
- **Agent & Skill Management**: Browse and configure agents and skills
- **MCP Support**: Configure Model Context Protocol servers

## Architecture

```
Frontend (Vite + React)          Backend (Express.js)
:5173 (dev) / :3001 (prod)      :3001

  React 19 + TypeScript            REST API (18 routes)
  TanStack Query                   WebSocket (live updates)
  Tailwind CSS 3                   SQLite (better-sqlite3)
  Zustand (state)                  Claude Code CLI (spawned)
                                   Terminal Manager
```

In development, Vite runs on :5173 with HMR and proxies API calls to Express on :3001. In production, Express serves the built frontend from `dist/`.

## Quick Start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

### Install & Run

```bash
# Install dependencies
pnpm install

# Development (Vite HMR + Express server)
pnpm dev
# Frontend: http://localhost:5173
# API: http://localhost:3001

# Production build & start
pnpm start
# Dashboard: http://localhost:3001
```

## Project Structure

```
ai-controller/
├── frontend/               # Vite + React app
│   └── src/
│       ├── pages/          # Page components
│       ├── components/     # Shared UI components
│       ├── api/            # API client (server-api.ts)
│       └── hooks/          # Custom React hooks
├── server/                 # Express.js backend
│   ├── routes/             # API route modules
│   ├── db/                 # SQLite database + migrations
│   │   └── repositories/   # Data access layer
│   ├── services/           # Business logic
│   ├── middleware/          # Validation, error handling
│   └── websocket.ts        # WebSocket server
├── shared/                 # Types shared between frontend/server
└── bin/cli.js              # CLI entry point
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5, Vite 6, Tailwind CSS 3 |
| State | TanStack Query, Zustand |
| Backend | Express 4, Node.js 20 |
| Database | SQLite (better-sqlite3) |
| Validation | Zod 4 |
| Real-time | WebSocket (ws) |
| Testing | Vitest, React Testing Library |

## Development Commands

```bash
pnpm dev              # Start dev servers (Vite + Express)
pnpm build            # Build frontend + server + copy assets
pnpm start            # Build and start production server
pnpm test:run         # Run test suite
pnpm lint             # Lint
pnpm typecheck        # Type check
```

## Configuration

The server auto-configures on first run. Settings are stored in SQLite at `./data/controller.db`.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATA_DIR` | `./data` | Database directory |

## License

MIT
