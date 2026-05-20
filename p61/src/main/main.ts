import { app, BrowserWindow, powerMonitor } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let modulesInitialized = false;

function optimizeAppPerformance(): void {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('force-color-profile', 'srgb');
  
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', '1');
  }

  app.disableHardwareAcceleration();
}

function lazyInitializeModules(): void {
  if (!modulesInitialized) {
    registerIpcHandlers();
    modulesInitialized = true;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableWebSQL: false,
      spellcheck: false,
      sandbox: true,
      backgroundThrottling: true
    },
    show: false,
    frame: true,
    backgroundColor: '#f5f5f5'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    setTimeout(() => lazyInitializeModules(), 100);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.setVisualZoomLevelLimits(1, 1);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

optimizeAppPerformance();

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  powerMonitor.on('suspend', () => {
    if (mainWindow) {
      mainWindow.webContents.setBackgroundThrottling(true);
    }
  });

  powerMonitor.on('resume', () => {
    if (mainWindow) {
      mainWindow.webContents.setBackgroundThrottling(false);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('browser-window-blur', () => {
  if (mainWindow) {
    mainWindow.webContents.setBackgroundThrottling(true);
  }
});

app.on('browser-window-focus', () => {
  if (mainWindow) {
    mainWindow.webContents.setBackgroundThrottling(false);
  }
});
