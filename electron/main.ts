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
  // Import the compiled server
  const { startServer } = require('../dist-server/server/index');

  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, 'dist')
    : path.join(__dirname, '..', 'dist');

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

  const port = await startEmbeddedServer();
  createWindow(port);

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
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
