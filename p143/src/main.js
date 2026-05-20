const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const NFCReader = require('./nfc/reader');
const AccessControl = require('./access/control');
const Database = require('./db/database');
const Server = require('./server');

let mainWindow;
let nfcReader;
let accessControl;
let db;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('src/public/index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  createWindow();

  db = new Database();
  await db.init();

  accessControl = new AccessControl(db);
  nfcReader = new NFCReader(accessControl);
  nfcReader.start();

  server = new Server(db, accessControl);
  server.start(3000);

  nfcReader.on('card-detected', (cardData) => {
    mainWindow.webContents.send('card-detected', cardData);
  });

  nfcReader.on('access-granted', (data) => {
    mainWindow.webContents.send('access-granted', data);
    server.broadcast('access-granted', data);
  });

  nfcReader.on('access-denied', (data) => {
    mainWindow.webContents.send('access-denied', data);
    server.broadcast('access-denied', data);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (nfcReader) nfcReader.stop();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-cards', async () => {
  return db.getAllCards();
});

ipcMain.handle('add-card', async (event, card) => {
  return db.addCard(card);
});

ipcMain.handle('delete-card', async (event, id) => {
  const result = await accessControl.removeCard(id);
  if (result) {
    server.broadcast('card-deleted', { id });
  }
  return result;
});

ipcMain.handle('get-logs', async (event, limit = 100) => {
  return db.getLogs(limit);
});

ipcMain.handle('simulate-card', async (event, cardData) => {
  nfcReader.simulateCard(cardData);
});
