import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { getExecutor } from './services/executor';
import { settings, initSettings } from './services/settings';
import { registerIpcHandlers } from './ipc/handlers';
import { initAutoUpdater, checkForUpdates } from './services/auto-updater';
import { initMayorStore } from './services/mayor';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show AI Controller',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
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
        app.quit();
      },
    },
  ]);

  tray.setToolTip('AI Controller');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
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

    // Initialize Mayor store
    initMayorStore();

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
});
