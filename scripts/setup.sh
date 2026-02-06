#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            Gas Town UI - Complete Setup                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$PROJECT_DIR/bin"
GASTOWN_PATH="${GASTOWN_PATH:-$HOME/gt}"

cd "$PROJECT_DIR"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed. Please install Go 1.23+ from https://go.dev/dl/${NC}"
    exit 1
fi

GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo -e "  ${GREEN}✓${NC} Go $GO_VERSION"

if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: Git is not installed.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Git $(git --version | awk '{print $3}')"

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed. Install with: npm install -g pnpm${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} pnpm $(pnpm --version)"

echo ""

# Build Go binaries
echo -e "${YELLOW}Building Gas Town CLI (gt)...${NC}"
mkdir -p "$BIN_DIR"

if [ -d "backend" ]; then
    cd backend
    go build -o "$BIN_DIR/gt" ./cmd/gt
    echo -e "  ${GREEN}✓${NC} gt binary built at bin/gt"
    cd ..
else
    echo -e "  ${YELLOW}⚠${NC} Backend not found, installing from go install..."
    go install github.com/steveyegge/gastown/cmd/gt@latest
    echo -e "  ${GREEN}✓${NC} gt installed via go install"
fi

echo -e "${YELLOW}Building Beads CLI (bd)...${NC}"
if [ -d "beads-cli" ]; then
    cd beads-cli
    go build -o "$BIN_DIR/bd" ./cmd/bd
    echo -e "  ${GREEN}✓${NC} bd binary built at bin/bd"
    cd ..
else
    echo -e "  ${YELLOW}⚠${NC} Beads CLI not found, installing from go install..."
    go install github.com/steveyegge/beads/cmd/bd@latest
    echo -e "  ${GREEN}✓${NC} bd installed via go install"
fi

echo ""

# Install Node dependencies
echo -e "${YELLOW}Installing Node dependencies...${NC}"
pnpm install
echo -e "  ${GREEN}✓${NC} Dependencies installed"

echo ""

# Add bin to PATH so gt can find bd
export PATH="$BIN_DIR:$PATH"

# Initialize Gas Town workspace if it doesn't exist
if [ ! -d "$GASTOWN_PATH" ]; then
    echo -e "${YELLOW}Initializing Gas Town workspace at $GASTOWN_PATH...${NC}"
    if [ -f "$BIN_DIR/gt" ]; then
        "$BIN_DIR/gt" install "$GASTOWN_PATH" --no-beads || true
    else
        gt install "$GASTOWN_PATH" --no-beads || true
    fi
    # Initialize beads separately
    if [ -f "$BIN_DIR/bd" ]; then
        cd "$GASTOWN_PATH" && "$BIN_DIR/bd" init || true
        cd "$PROJECT_DIR"
    fi
    echo -e "  ${GREEN}✓${NC} Workspace initialized"
else
    echo -e "${GREEN}Gas Town workspace already exists at $GASTOWN_PATH${NC}"
fi

echo ""

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Creating .env.local...${NC}"
    cat > .env.local << EOF
# Gas Town Configuration
GASTOWN_PATH=$GASTOWN_PATH

# Add local bin to PATH for gt and bd commands
# You may need to add this to your shell profile:
# export PATH="\$PATH:$(pwd)/bin"
EOF
    echo -e "  ${GREEN}✓${NC} .env.local created"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To add the CLI tools to your PATH, run:"
echo -e "  ${BLUE}export PATH=\"\$PATH:$BIN_DIR\"${NC}"
echo ""
echo -e "To start the dashboard:"
echo -e "  ${BLUE}pnpm dev${NC}"
echo ""
echo -e "To start Gas Town with the Mayor session:"
echo -e "  ${BLUE}cd $GASTOWN_PATH && gt prime${NC}"
echo ""
echo -e "Dashboard will be available at ${BLUE}http://localhost:3001${NC}"
