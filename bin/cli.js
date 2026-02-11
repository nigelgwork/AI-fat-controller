#!/usr/bin/env node
const { startServer, setupGracefulShutdown } = require('../dist-server/server/index.js');

startServer().then(({ server }) => {
  setupGracefulShutdown(server);
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
