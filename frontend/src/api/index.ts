import { serverApi } from './server-api';
import { wsClient } from './websocket';

// If running in Electron, use IPC. Otherwise, use HTTP/WS.
export const api: typeof serverApi = (window as any).electronAPI ?? serverApi;

// Initialize WebSocket when not in Electron
export function initApi(): void {
  if (!(window as any).electronAPI) {
    wsClient.connect();
  }
}

// Check if running in Electron
export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}
