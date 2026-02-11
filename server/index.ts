import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import path from 'path';
import { initDatabase, closeDatabase } from './db/database';
import { initWebSocket } from './websocket';
import { errorHandler } from './middleware/error-handler';
import { createLogger } from './utils/logger';
import { getSetting, setSetting } from './services/settings';
import { detectModes } from './services/mode-detection';

// Import route modules
import modeRoutes from './routes/mode';
import claudeRoutes from './routes/claude';
import settingsRoutes from './routes/settings';
import projectsRoutes from './routes/projects';
import agentsRoutes from './routes/agents';
import tasksRoutes from './routes/tasks';
// controller route removed — Controller page was deleted, service had expensive 5s processing loop
import conversationsRoutes from './routes/conversations';
import claudeSessionsRoutes from './routes/claude-sessions';
import ntfyRoutes from './routes/ntfy';
import mcpRoutes from './routes/mcp';
import tokenHistoryRoutes from './routes/token-history';
import activityRoutes from './routes/activity';
import executionSessionsRoutes from './routes/execution-sessions';
import systemRoutes from './routes/system';
import terminalsRoutes from './routes/terminals';
import skillsRoutes from './routes/skills';
import filesystemRoutes from './routes/filesystem';

const log = createLogger('Server');

/**
 * Create and configure the Express app + HTTP server without listening.
 * Used by both CLI mode and Electron.
 */
export async function createApp(options?: { staticDir?: string }): Promise<{ app: express.Express; server: import('http').Server }> {
  // Initialize database
  log.info('Initializing database...');
  initDatabase();

  // Auto-configure on first run — detect environment and set defaults
  if (!getSetting('hasCompletedSetup')) {
    // Detect environment (WSL, native Linux)
    const modeStatus = await detectModes();
    const executionMode = modeStatus.wsl.detected ? 'wsl' : 'linux';

    setSetting('executionMode', executionMode);
    setSetting('defaultMode', 'auto');
    setSetting('hasCompletedSetup', true);
    log.info(`Auto-configured: mode=${executionMode}`);
    if (modeStatus.wsl.detected) {
      log.info(`Detected ${modeStatus.wsl.version || 'WSL'}`);
    }
    if (modeStatus.linux.available) {
      log.info(`Claude Code: ${modeStatus.linux.claudePath}${modeStatus.linux.version ? ' (' + modeStatus.linux.version + ')' : ''}`);
    }
  }

  // Create Express app
  const app = express();
  const server = createServer(app);

  // Initialize WebSocket
  initWebSocket(server);

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.use('/api/mode', modeRoutes);
  app.use('/api/claude', claudeRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/agents', agentsRoutes);
  app.use('/api/tasks', tasksRoutes);
  // /api/controller removed — Controller feature was removed
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/claude-sessions', claudeSessionsRoutes);
  app.use('/api/ntfy', ntfyRoutes);
  app.use('/api/mcp', mcpRoutes);
  app.use('/api/token-history', tokenHistoryRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/sessions', executionSessionsRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/terminals', terminalsRoutes);
  app.use('/api/skills', skillsRoutes);
  app.use('/api/filesystem', filesystemRoutes);

  // Serve frontend in production
  const distPath = options?.staticDir || path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });

  // Error handler
  app.use(errorHandler);

  return { app, server };
}

/**
 * Start the server listening on the given port/host.
 * Used by CLI mode and can be used by Electron for embedded server.
 */
export async function startServer(options?: { port?: number; host?: string; staticDir?: string }) {
  const port = options?.port ?? parseInt(process.env.PORT || '3001', 10);
  const host = options?.host ?? '0.0.0.0';

  const { app, server } = await createApp({ staticDir: options?.staticDir });

  return new Promise<{ app: express.Express; server: ReturnType<typeof createServer>; port: number }>((resolve) => {
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      log.info(`Server running on http://${host}:${actualPort}`);
      resolve({ app, server, port: actualPort });
    });
  });
}

// Graceful shutdown helper
export function setupGracefulShutdown(server: ReturnType<typeof createServer>) {
  const shutdown = () => {
    log.info('Shutting down...');
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled Rejection', reason);
  });

  return shutdown;
}

// Auto-start in CLI mode (when run directly, not imported by Electron)
if (require.main === module) {
  startServer().then(({ server }) => {
    setupGracefulShutdown(server);
  }).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
