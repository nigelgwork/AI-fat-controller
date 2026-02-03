import { BrowserWindow } from 'electron';

/**
 * Safely broadcast a message to all renderer windows.
 * Checks that windows exist and are not destroyed before sending.
 */
export function safeBroadcast(channel: string, ...args: unknown[]): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      try {
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send(channel, ...args);
        }
      } catch (err) {
        // Window may have been destroyed between check and send
        console.warn(`[SafeIPC] Failed to send to window: ${err}`);
      }
    }
  } catch (err) {
    console.error(`[SafeIPC] Failed to broadcast ${channel}:`, err);
  }
}

/**
 * Safely send a message to a specific window.
 * Returns true if sent successfully, false otherwise.
 */
export function safeSend(win: BrowserWindow | null, channel: string, ...args: unknown[]): boolean {
  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, ...args);
      return true;
    }
  } catch (err) {
    console.warn(`[SafeIPC] Failed to send ${channel}:`, err);
  }
  return false;
}
