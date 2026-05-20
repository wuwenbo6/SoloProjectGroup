const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('../database/db');

let mainWindow;
let pythonProcess;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
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

function startPythonBackend() {
  const pythonScript = path.join(__dirname, '../../python/main.py');
  
  pythonProcess = spawn('python3', [pythonScript], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });

  return pythonProcess;
}

app.whenReady().then(async () => {
  db = new Database();
  try {
    await db.init();
  } catch (err) {
    console.error('Database init error:', err);
  }
  startPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

ipcMain.handle('select-image-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }]
  });
  return result.filePaths;
});

ipcMain.handle('process-images', async (event, params) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../../python/main.py');
    const process = spawn('python3', [pythonScript, 'process', JSON.stringify(params)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      } else {
        reject(new Error(error || `Exit code ${code}`));
      }
    });
  });
});

ipcMain.handle('generate-chords', async (event, params) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../../python/main.py');
    const process = spawn('python3', [pythonScript, 'generate_chords', JSON.stringify(params)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      } else {
        reject(new Error(error || `Exit code ${code}`));
      }
    });
  });
});

ipcMain.handle('export-musicxml', async (event, params) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../../python/main.py');
    const process = spawn('python3', [pythonScript, 'export_musicxml', JSON.stringify(params)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      } else {
        reject(new Error(error || `Exit code ${code}`));
      }
    });
  });
});

ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'MusicXML', extensions: ['musicxml', 'xml'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'score.musicxml'
  });
  return result.filePath;
});

ipcMain.handle('save-score', async (event, scoreData) => {
  return db.saveScore(scoreData);
});

ipcMain.handle('get-scores', async () => {
  return db.getScores();
});

ipcMain.handle('get-score', async (event, id) => {
  return db.getScore(id);
});

ipcMain.handle('delete-score', async (event, id) => {
  return db.deleteScore(id);
});

ipcMain.handle('save-play-record', async (event, record) => {
  return db.savePlayRecord(record);
});

ipcMain.handle('get-play-records', async (event, scoreId) => {
  return db.getPlayRecords(scoreId);
});
