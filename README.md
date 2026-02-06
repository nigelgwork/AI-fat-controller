# AI Controller

Electron desktop app for multi-agent orchestration with Claude Code.

![AI Controller Dashboard](docs/screenshot.png)

## Features

- **Town Overview**: Real-time stats on agents, work items, and system health
- **Controller Chat**: AI-powered chat interface to coordinate work via Claude Code CLI
- **Agent Management**: Monitor agent status, context usage, and trigger handoffs
- **Convoy Tracking**: Track grouped work packages with progress visualization
- **Beads Browser**: Filter and search work items by status, type, and priority
- **Dependency Graph**: Interactive React Flow visualization of work dependencies
- **Insights Dashboard**: Graph analytics (bottlenecks, keystones, cycles)
- **Mail Center**: View agent communication and announcements

## Quick Start

### Prerequisites

- [Go 1.23+](https://go.dev/dl/) - for building Gas Town CLI
- [Git 2.25+](https://git-scm.com/) - for worktree support
- [pnpm](https://pnpm.io/) - package manager

### Installation

```bash
# Clone this repo
git clone https://github.com/nigelgwork/AI-phat-controller.git
cd AI-phat-controller

# One-command setup
pnpm setup
```

The setup script will:
1. Check prerequisites
2. Clone and build Gas Town (`gt`) and Beads (`bd`) CLIs
3. Install Node dependencies
4. Initialize a Gas Town workspace at `~/gt`

### Running

```bash
# Start the Electron app (full dev workflow)
pnpm dev:electron

# Or start just the Vite dev server
pnpm dev
# Open http://localhost:3001
```

## Configuration

Create `.env.local`:

```bash
# Required: Path to your Gas Town workspace
GASTOWN_PATH=~/gt
```

## Using with Gas Town

```bash
# Add the CLI tools to your PATH
export PATH="$PATH:$(pwd)/bin"

# Start the Mayor session (AI coordinator)
cd ~/gt && gt prime

# Or use individual commands
gt convoy create "Feature X" issue-123 issue-456
gt sling issue-123 myproject
gt convoy list
```

## Project Structure

```
ai-controller/
├── frontend/              # Vite + React frontend
│   ├── src/               # React source
│   └── index.html         # Entry HTML
├── electron/              # Electron main process (TypeScript)
│   ├── main.ts            # Main process entry
│   ├── preload.ts         # Preload script
│   ├── ipc/               # IPC handlers
│   └── services/          # Backend services
├── dist-electron/         # Compiled Electron JS
├── bin/                   # Built CLI binaries
└── scripts/setup.sh       # Setup script
```

## Tech Stack

- **Desktop**: Electron
- **Frontend**: Vite, React 19, TypeScript, Tailwind CSS
- **Visualization**: @xyflow/react (React Flow)
- **Data Fetching**: TanStack Query
- **State**: Zustand
- **Icons**: Lucide React

## License

MIT - This project builds on [Gas Town](https://github.com/steveyegge/gastown) and [Beads](https://github.com/steveyegge/beads), both MIT licensed.

## Credits

- [Steve Yegge](https://github.com/steveyegge) - Gas Town & Beads
- [Anthropic](https://anthropic.com) - Claude Code
