import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';

// Set DATA_DIR before importing server so SQLite goes to userData
const userDataPath = app.getPath('userData');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(userDataPath, 'data');

// Set APP_VERSION for the /version endpoint
process.env.APP_VERSION = app.getVersion();

let mainWindow: BrowserWindow | null = null;
let serverInstance: { server: import('http').Server; port: number } | null = null;

async function startEmbeddedServer(): Promise<number> {
  // Use app.getAppPath() which resolves to the asar in packaged mode.
  // Electron's Node patches handle reading JS/JSON/SQL files from asar transparently.
  // Only native modules (better-sqlite3) need asarUnpack — handled in package.json.
  const appRoot = app.isPackaged
    ? app.getAppPath()
    : path.join(__dirname, '..');

  const { startServer } = require(path.join(appRoot, 'dist-server', 'server', 'index'));
  const staticDir = path.join(appRoot, 'dist');

  const result = await startServer({
    port: 0, // OS-assigned dynamic port
    host: '127.0.0.1',
    staticDir,
  });

  serverInstance = { server: result.server, port: result.port };
  return result.port;
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    titleBarStyle: 'default',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Show window once content is ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // In dev mode, load from Vite dev server; in prod, load from embedded Express
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
function registerIpcHandlers() {
  ipcMain.handle('dialog:browseForProject', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('app:minimize', () => {
    mainWindow?.minimize();
  });
}

// App lifecycle
app.whenReady().then(async () => {
  registerIpcHandlers();

  try {
    const port = await startEmbeddedServer();
    createWindow(port);
  } catch (err) {
    dialog.showErrorBox(
      'AI Phat Controller - Startup Error',
      `Failed to start embedded server:\n\n${err instanceof Error ? err.stack || err.message : String(err)}`
    );
    app.quit();
  }

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0 && serverInstance) {
      createWindow(serverInstance.port);
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay in dock
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Gracefully close the embedded server
  if (serverInstance) {
    serverInstance.server.close();
    serverInstance = null;
  }
});
