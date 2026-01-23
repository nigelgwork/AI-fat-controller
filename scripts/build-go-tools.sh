#!/bin/bash
# Cross-compile gt and bd for Windows from Linux/WSL

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/resources/bin"
TEMP_DIR="$PROJECT_DIR/.go-build-temp"

mkdir -p "$BUILD_DIR" "$TEMP_DIR"

echo "=== Building Go tools for Windows ==="
echo "Build dir: $BUILD_DIR"
echo ""

# Check for Go
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed"
    exit 1
fi

echo "Go version: $(go version)"
echo ""

# Build gt
echo "Building gt for Windows..."
cd "$TEMP_DIR"
if [ ! -d "gastown" ]; then
    echo "Cloning gastown..."
    git clone --depth 1 https://github.com/steveyegge/gastown.git
else
    echo "Using cached gastown..."
    cd gastown && git pull && cd ..
fi
cd gastown
GOOS=windows GOARCH=amd64 go build -o "$BUILD_DIR/gt.exe" ./cmd/gt
echo "Built: $BUILD_DIR/gt.exe"
echo ""

# Build bd
echo "Building bd for Windows..."
cd "$TEMP_DIR"
if [ ! -d "beads" ]; then
    echo "Cloning beads..."
    git clone --depth 1 https://github.com/steveyegge/beads.git
else
    echo "Using cached beads..."
    cd beads && git pull && cd ..
fi
cd beads
GOOS=windows GOARCH=amd64 go build -o "$BUILD_DIR/bd.exe" ./cmd/bd
echo "Built: $BUILD_DIR/bd.exe"
echo ""

echo "=== Build complete ==="
ls -la "$BUILD_DIR"
