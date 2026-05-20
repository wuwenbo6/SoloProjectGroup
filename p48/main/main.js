const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');

let mainWindow;
let registrationWorker;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.webContents.openDevTools();
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

ipcMain.handle('open-file-dialog', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters
    });
    return result;
});

ipcMain.handle('save-file-dialog', async (event, filters) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: filters
    });
    return result;
});

ipcMain.handle('start-registration', async (event, sourceCloud, targetCloud, params) => {
    return new Promise((resolve, reject) => {
        if (registrationWorker) {
            registrationWorker.terminate();
        }

        registrationWorker = new Worker(path.join(__dirname, '../worker/registration.js'));

        registrationWorker.on('message', (message) => {
            if (message.type === 'progress') {
                mainWindow.webContents.send('registration-progress', message.data);
            } else if (message.type === 'complete') {
                resolve(message.data);
            } else if (message.type === 'error') {
                reject(new Error(message.error));
            }
        });

        registrationWorker.on('error', (error) => {
            reject(error);
        });

        registrationWorker.postMessage({
            type: 'register',
            sourceCloud,
            targetCloud,
            params
        });
    });
});

ipcMain.handle('cancel-registration', async () => {
    if (registrationWorker) {
        registrationWorker.terminate();
        registrationWorker = null;
    }
});

ipcMain.handle('open-multiple-files-dialog', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: filters
    });
    return result;
});

ipcMain.handle('start-temporal-registration', async (event, frameClouds, params) => {
    return new Promise((resolve, reject) => {
        if (registrationWorker) {
            registrationWorker.terminate();
        }

        registrationWorker = new Worker(path.join(__dirname, '../worker/registration.js'));

        registrationWorker.on('message', (message) => {
            if (message.type === 'temporalProgress') {
                mainWindow.webContents.send('temporal-registration-progress', message.data);
            } else if (message.type === 'temporalComplete') {
                resolve(message.data);
            } else if (message.type === 'error') {
                reject(new Error(message.error));
            }
        });

        registrationWorker.on('error', (error) => {
            reject(error);
        });

        registrationWorker.postMessage({
            type: 'registerTemporal',
            frameClouds,
            params
        });
    });
});

ipcMain.handle('evaluate-quality', async (event, sourceCloud, targetCloud, params) => {
    return new Promise((resolve, reject) => {
        if (registrationWorker) {
            registrationWorker.terminate();
        }

        registrationWorker = new Worker(path.join(__dirname, '../worker/registration.js'));

        registrationWorker.on('message', (message) => {
            if (message.type === 'qualityComplete') {
                resolve(message.data);
            } else if (message.type === 'error') {
                reject(new Error(message.error));
            }
        });

        registrationWorker.on('error', (error) => {
            reject(error);
        });

        registrationWorker.postMessage({
            type: 'evaluateQuality',
            sourceCloud,
            targetCloud,
            params
        });
    });
});
