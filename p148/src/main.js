const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');
const wav = require('wav');

let mainWindow;
let sdrWorker;
let isRecording = false;
let wavWriter = null;
let isCsvLogging = false;
let csvWriter = null;
let csvStream = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    if (sdrWorker) {
      sdrWorker.postMessage({ type: 'stop' });
      sdrWorker.terminate();
    }
    if (wavWriter) {
      wavWriter.end();
    }
    mainWindow = null;
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

ipcMain.handle('start-sdr', async (event, config) => {
  try {
    if (sdrWorker) {
      sdrWorker.postMessage({ type: 'stop' });
      sdrWorker.terminate();
    }

    sdrWorker = new Worker(path.join(__dirname, 'workers', 'sdr-worker.js'));

    sdrWorker.on('message', (msg) => {
      if (msg.type === 'iq-data') {
        mainWindow.webContents.send('iq-data', msg.data);
      } else if (msg.type === 'audio-data') {
        mainWindow.webContents.send('audio-data', msg.data);
        if (isRecording && wavWriter) {
          const float32Array = new Float32Array(msg.data);
          const int16Array = new Int16Array(float32Array.length);
          for (let i = 0; i < float32Array.length; i++) {
            int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 32767;
          }
          const buffer = Buffer.from(int16Array.buffer);
          wavWriter.write(buffer);
        }
      } else if (msg.type === 'fft-data') {
        mainWindow.webContents.send('fft-data', msg.data);
        if (isCsvLogging && csvStream) {
          const timestamp = msg.timestamp || Date.now();
          const csvLine = timestamp + ',' + msg.data.join(',') + '\n';
          csvStream.write(csvLine);
        }
      } else if (msg.type === 'afc-update') {
        mainWindow.webContents.send('afc-update', msg.frequency);
      } else if (msg.type === 'rtty-char') {
        mainWindow.webContents.send('rtty-char', msg.char);
      } else if (msg.type === 'sstv-sync') {
        mainWindow.webContents.send('sstv-sync', msg.message);
      } else if (msg.type === 'sstv-line') {
        mainWindow.webContents.send('sstv-line', msg.data);
      } else if (msg.type === 'error') {
        mainWindow.webContents.send('sdr-error', msg.message);
      } else if (msg.type === 'ready') {
        mainWindow.webContents.send('sdr-ready');
      }
    });

    sdrWorker.postMessage({ type: 'start', config });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-sdr', async () => {
  if (sdrWorker) {
    sdrWorker.postMessage({ type: 'stop' });
    sdrWorker.terminate();
    sdrWorker = null;
  }
  if (isRecording) {
    if (wavWriter) {
      wavWriter.end();
      wavWriter = null;
    }
    isRecording = false;
  }
  return { success: true };
});

ipcMain.handle('update-config', async (event, config) => {
  if (sdrWorker) {
    sdrWorker.postMessage({ type: 'update-config', config });
  }
  return { success: true };
});

ipcMain.handle('start-recording', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
    defaultPath: `sdr-recording-${Date.now()}.wav`
  });

  if (!result.canceled && result.filePath) {
    wavWriter = new wav.FileWriter(result.filePath, {
      sampleRate: 48000,
      channels: 1,
      bitDepth: 16
    });
    isRecording = true;
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('stop-recording', async () => {
  isRecording = false;
  if (wavWriter) {
    wavWriter.end();
    wavWriter = null;
  }
  return { success: true };
});

ipcMain.handle('start-csv-logging', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'CSV File', extensions: ['csv'] }],
    defaultPath: `sdr-spectrum-${Date.now()}.csv`
  });

  if (!result.canceled && result.filePath) {
    const headers = 'timestamp,' + Array.from({ length: 512 }, (_, i) => `bin_${i}`).join(',') + '\n';
    csvStream = fs.createWriteStream(result.filePath);
    csvStream.write(headers);
    isCsvLogging = true;
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('stop-csv-logging', async () => {
  isCsvLogging = false;
  if (csvStream) {
    csvStream.end();
    csvStream = null;
  }
  return { success: true };
});

ipcMain.handle('reset-sstv', async () => {
  if (sdrWorker) {
    sdrWorker.postMessage({ type: 'reset-sstv' });
  }
  return { success: true };
});

ipcMain.handle('reset-rtty', async () => {
  if (sdrWorker) {
    sdrWorker.postMessage({ type: 'reset-rtty' });
  }
  return { success: true };
});
