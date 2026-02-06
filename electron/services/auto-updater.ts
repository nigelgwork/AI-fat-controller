import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, app } from 'electron';
import { settings } from './settings';
import { createLogger } from '../utils/logger';

const log = createLogger('AutoUpdater');

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
  error: string | null;
}

let mainWindow: BrowserWindow | null = null;
let updateCheckInterval: NodeJS.Timeout | null = null;

const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

let updateStatus: UpdateStatus = {
  checking: false,
  available: false,
  downloaded: false,
  downloading: false,
  progress: 0,
  version: null,
  releaseNotes: null,
  error: null,
};

/**
 * Initialize the auto-updater
 */
export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Configure auto-updater
  autoUpdater.autoDownload = true; // Auto-download updates
  autoUpdater.autoInstallOnAppQuit = true;

  // Set up event handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('[AutoUpdater] Checking for updates...');
    updateStatus = { ...updateStatus, checking: true, error: null };
    notifyRenderer('update:checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const version = typeof info.version === 'string' ? info.version : String(info.version);
    log.info(`[AutoUpdater] Update available: ${version}`);
    updateStatus = {
      ...updateStatus,
      checking: false,
      available: true,
      version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    };
    notifyRenderer('update:available', {
      version,
      releaseNotes: updateStatus.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[AutoUpdater] No update available');
    updateStatus = { ...updateStatus, checking: false, available: false };
    notifyRenderer('update:not-available');
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    const percent = Math.round(progress.percent);
    log.info(`[AutoUpdater] Download progress: ${percent}%`);
    updateStatus = {
      ...updateStatus,
      downloading: true,
      progress: percent,
    };
    notifyRenderer('update:progress', {
      percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    const version = typeof info.version === 'string' ? info.version : String(info.version);
    log.info(`[AutoUpdater] Update downloaded: ${version}`);
    updateStatus = {
      ...updateStatus,
      downloading: false,
      downloaded: true,
      progress: 100,
      version,
    };
    notifyRenderer('update:downloaded', { version });
  });

  autoUpdater.on('error', (error: Error) => {
    log.error('[AutoUpdater] Error:', error.message);
    updateStatus = {
      ...updateStatus,
      checking: false,
      downloading: false,
      error: error.message,
    };
    notifyRenderer('update:error', { error: error.message });
  });

  // Start periodic update checks
  startPeriodicUpdateCheck();
}

/**
 * Send update event to renderer process
 */
function notifyRenderer(channel: string, data?: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Start periodic update checks
 */
function startPeriodicUpdateCheck(): void {
  const lastCheck = settings.get('lastUpdateCheck') as string | undefined;
  const now = Date.now();

  if (lastCheck) {
    const lastCheckTime = new Date(lastCheck).getTime();
    const timeSinceCheck = now - lastCheckTime;

    if (timeSinceCheck < UPDATE_CHECK_INTERVAL) {
      const nextCheckDelay = UPDATE_CHECK_INTERVAL - timeSinceCheck;
      log.info(`[AutoUpdater] Next check in ${Math.round(nextCheckDelay / 1000 / 60)} minutes`);
      setTimeout(() => {
        performUpdateCheck();
        startUpdateCheckInterval();
      }, nextCheckDelay);
      return;
    }
  }

  // Check after a short delay to let app initialize
  setTimeout(() => {
    performUpdateCheck();
    startUpdateCheckInterval();
  }, 5000);
}

/**
 * Start the interval for update checks
 */
function startUpdateCheckInterval(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }

  updateCheckInterval = setInterval(() => {
    performUpdateCheck();
  }, UPDATE_CHECK_INTERVAL);
}

/**
 * Perform an update check
 */
async function performUpdateCheck(): Promise<void> {
  try {
    log.info('[AutoUpdater] Performing update check...');
    settings.set('lastUpdateCheck', new Date().toISOString());
    await autoUpdater.checkForUpdates();
  } catch (error) {
    log.error('[AutoUpdater] Update check failed:', error);
  }
}

/**
 * Manually check for updates
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  settings.set('lastUpdateCheck', new Date().toISOString());
  updateStatus = { ...updateStatus, checking: true, error: null };

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    updateStatus = {
      ...updateStatus,
      checking: false,
      error: error instanceof Error ? error.message : 'Failed to check for updates',
    };
  }

  return updateStatus;
}

/**
 * Download available update
 */
export async function downloadUpdate(): Promise<void> {
  if (!updateStatus.available) {
    throw new Error('No update available to download');
  }

  updateStatus.downloading = true;
  notifyRenderer('update:downloading');

  await autoUpdater.downloadUpdate();
}

/**
 * Install downloaded update and restart
 */
export function installUpdate(): void {
  if (!updateStatus.downloaded) {
    throw new Error('No update downloaded to install');
  }

  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get current update status
 */
export function getUpdateStatus(): UpdateStatus {
  return { ...updateStatus };
}

/**
 * Get current app version
 */
export function getCurrentVersion(): string {
  return app.getVersion();
}

/**
 * Stop the auto-updater (cleanup on app quit)
 */
export function stopAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  mainWindow = null;
}
