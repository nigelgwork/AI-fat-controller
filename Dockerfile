# Single-stage build for simplicity with native modules
FROM node:20-slim
WORKDIR /app

# Install build tools and runtime dependencies
RUN apt-get update && \
    apt-get install -y git python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile || pnpm install

# Rebuild native modules (better-sqlite3 needs node-gyp)
RUN npm rebuild better-sqlite3

# Copy source code
COPY . .

# Build frontend and server
RUN pnpm run build:frontend && pnpm run build:server

# Copy migrations to the correct location (where compiled code expects them)
RUN mkdir -p /app/dist-server/server/db && cp -r /app/server/db/migrations /app/dist-server/server/db/

# Create data directory
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3001
ENV EXECUTION_MODE=linux

EXPOSE 3001

VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3001/api/system/status').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist-server/server/index.js"]
