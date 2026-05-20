const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { PythonShell } = require('python-shell');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) {
      pythonProcess.kill();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'FITS Files', extensions: ['fits', 'fit', 'fts'] },
      { name: 'RAW Files', extensions: ['raw', 'cr2', 'nef', 'arw', 'dng'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'FITS Files', extensions: ['fits', 'fit', 'fts'] },
      { name: 'RAW Files', extensions: ['raw', 'cr2', 'nef', 'arw', 'dng'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.handle('save-file', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'TIFF Image', extensions: ['tiff', 'tif'] },
      { name: 'PNG Image', extensions: ['png'] }
    ]
  });
  return result.filePath;
});

ipcMain.handle('run-python-script', async (event, scriptName, args) => {
  return new Promise((resolve, reject) => {
    const options = {
      mode: 'json',
      pythonPath: 'python3',
      scriptPath: path.join(__dirname, '../python'),
      args: [JSON.stringify(args)]
    };

    PythonShell.run(`${scriptName}.py`, options, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[results.length - 1]);
      }
    });
  });
});

ipcMain.on('process-images', async (event, params) => {
  const options = {
    mode: 'json',
    pythonPath: 'python3',
    scriptPath: path.join(__dirname, '../python'),
    args: [JSON.stringify(params)]
  };

  pythonProcess = new PythonShell('processor.py', options);

  pythonProcess.on('message', (message) => {
    event.reply('processing-update', message);
  });

  pythonProcess.on('error', (err) => {
    event.reply('processing-error', { error: err.message });
  });

  pythonProcess.end((err) => {
    if (err) {
      event.reply('processing-error', { error: err.message });
    }
  });
});

ipcMain.on('stop-processing', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});
