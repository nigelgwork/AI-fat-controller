import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { getExecutor, cancelAllExecutions } from './services/executor';
import { settings, initSettings } from './services/settings';
import { registerIpcHandlers } from './ipc/handlers';
import { initAutoUpdater, checkForUpdates, stopAutoUpdater } from './services/auto-updater';
import { initControllerStore, getControllerState, pauseController, resumeController } from './services/controller';
import { initNtfyStore, startPolling as startNtfyPolling, stopPolling as stopNtfyPolling, getNtfyConfig } from './services/ntfy';
import { initBriefsStore } from './services/project-briefs';
import { initTokenHistoryStore } from './stores/token-history';
import { createLogger, configureLogger } from './utils/logger';

const log = createLogger('Main');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayUpdateInterval: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const bounds = settings.get('windowBounds') as { x?: number; y?: number; width?: number; height?: number; isMaximized?: boolean } | undefined;

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../resources/icon.ico'),
    show: false, // Show when ready
    titleBarStyle: 'default',
    backgroundColor: '#0F172A', // Match app background
  });

  // Show when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (bounds?.isMaximized) {
      mainWindow?.maximize();
    }
    if (!settings.get('startMinimized')) {
      mainWindow?.show();
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Save window bounds on close
  mainWindow.on('close', (event) => {
    if (settings.get('minimizeToTray') && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      settings.set('windowBounds', {
        ...bounds,
        isMaximized: mainWindow.isMaximized(),
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const controllerState = getControllerState();
  const statusLabel = controllerState.status === 'idle' ? 'Idle' :
    controllerState.status === 'running' ? 'Running' :
    controllerState.status === 'paused' ? 'Paused' :
    controllerState.status === 'waiting_approval' ? 'Waiting Approval' :
    'Waiting Input';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Phat Controller',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: `Status: ${statusLabel}`,
      enabled: false,
    },
    {
      label: controllerState.status === 'paused' ? 'Resume' : 'Pause',
      enabled: controllerState.status === 'running' || controllerState.status === 'paused',
      click: async () => {
        if (controllerState.status === 'paused') {
          await resumeController();
        } else {
          await pauseController();
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: [
        {
          label: 'Windows',
          type: 'radio',
          checked: settings.get('executionMode') === 'windows',
          click: () => settings.set('executionMode', 'windows'),
        },
        {
          label: 'WSL',
          type: 'radio',
          checked: settings.get('executionMode') === 'wsl',
          click: () => settings.set('executionMode', 'wsl'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        stopNtfyPolling();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Update tooltip with status
  tray.setToolTip(`Phat Controller - ${statusLabel}`);
}

function createTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, '../resources/icon.ico');
  let trayIcon: Electron.NativeImage;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  updateTrayMenu();

  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Update tray menu periodically (store reference for cleanup)
  if (trayUpdateInterval) {
    clearInterval(trayUpdateInterval);
  }
  trayUpdateInterval = setInterval(updateTrayMenu, 5000);
}

// Track quitting state
let isQuitting = false;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Initialize settings
    initSettings();

    // Initialize Controller store
    initControllerStore();

    // Initialize ntfy store
    initNtfyStore();

    // Initialize project briefs store
    initBriefsStore();

    // Initialize token history store
    initTokenHistoryStore();

    // Start ntfy polling if enabled
    const ntfyConfig = getNtfyConfig();
    if (ntfyConfig.enabled) {
      startNtfyPolling();
    }

    // Initialize executor based on settings
    await getExecutor();

    // Register IPC handlers
    registerIpcHandlers(ipcMain);

    // Create window and tray
    createWindow();
    createTray();

    // Initialize auto-updater in production
    if (!isDev && mainWindow) {
      initAutoUpdater(mainWindow);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;

  // Clean up all intervals to prevent memory leaks
  if (trayUpdateInterval) {
    clearInterval(trayUpdateInterval);
    trayUpdateInterval = null;
  }

  // Stop ntfy polling
  stopNtfyPolling();

  // Stop auto-updater
  stopAutoUpdater();

  // Kill any running Claude/executor processes
  cancelAllExecutions();
});

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception', error);
  // Don't crash the app, but log the error
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection', { promise, reason });
  // Don't crash the app, but log the error
});
