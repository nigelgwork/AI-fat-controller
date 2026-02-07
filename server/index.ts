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
import controllerRoutes from './routes/controller';
import conversationsRoutes from './routes/conversations';
import claudeSessionsRoutes from './routes/claude-sessions';
import ntfyRoutes from './routes/ntfy';
import mcpRoutes from './routes/mcp';
import tokenHistoryRoutes from './routes/token-history';
import activityRoutes from './routes/activity';
import executionSessionsRoutes from './routes/execution-sessions';
import systemRoutes from './routes/system';

const log = createLogger('Server');
const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  // Initialize database
  log.info('Initializing database...');
  initDatabase();

  // Auto-configure on first run — detect environment and set defaults
  if (!getSetting('hasCompletedSetup')) {
    // Detect environment (WSL, Docker, native Linux)
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
  app.use('/api/controller', controllerRoutes);
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/claude-sessions', claudeSessionsRoutes);
  app.use('/api/ntfy', ntfyRoutes);
  app.use('/api/mcp', mcpRoutes);
  app.use('/api/token-history', tokenHistoryRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/sessions', executionSessionsRoutes);
  app.use('/api/system', systemRoutes);

  // Serve frontend in production
  // In Docker: __dirname is /app/dist-server/server, frontend is at /app/dist
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });

  // Error handler
  app.use(errorHandler);

  // Start server
  server.listen(PORT, '0.0.0.0', () => {
    log.info(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown
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
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
