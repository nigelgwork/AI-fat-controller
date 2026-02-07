import { serverApi } from './server-api';
import { wsClient } from './websocket';

export const api = serverApi;

export function initApi(): void {
  wsClient.connect();
}
