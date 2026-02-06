import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from './utils/logger';

const log = createLogger('WebSocket');

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    log.info('Client connected');

    ws.on('close', () => {
      log.info('Client disconnected');
    });

    ws.on('error', (err) => {
      log.error('WebSocket error:', err);
    });
  });

  log.info('WebSocket server initialized');
  return wss;
}

export function broadcast(channel: string, ...args: unknown[]): void {
  if (!wss) return;

  const message = JSON.stringify({
    channel,
    data: args.length === 1 ? args[0] : args,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        log.error('Failed to send to client:', err);
      }
    }
  });
}

export function getWSS(): WebSocketServer | null {
  return wss;
}
