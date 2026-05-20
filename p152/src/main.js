const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

let mainWindow;
let pythonProcess;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('src/index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'equations.db');
  db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_equation TEXT NOT NULL,
      balanced_equation TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function startPythonBackend() {
  const pythonScript = path.join(__dirname, '../backend/balancer.py');
  
  pythonProcess = spawn('python3', [pythonScript], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    try {
      const result = JSON.parse(data.toString());
      if (mainWindow) {
        mainWindow.webContents.send('python-response', result);
      }
    } catch (e) {
      console.log('Python output:', data.toString());
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('Python error:', data.toString());
  });
}

app.whenReady().then(() => {
  createWindow();
  initDatabase();
  startPythonBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (db) {
    db.close();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('balance-equation', async (event, requestData) => {
  return new Promise((resolve) => {
    const requestId = Date.now().toString();
    const request = JSON.stringify({
      id: requestId,
      ...requestData
    }) + '\n';
    
    const responseHandler = (data) => {
      try {
        const result = JSON.parse(data.toString());
        if (result.id === requestId) {
          pythonProcess.stdout.removeListener('data', responseHandler);
          resolve(result);
        }
      } catch (e) {}
    };
    
    pythonProcess.stdout.on('data', responseHandler);
    pythonProcess.stdin.write(request);
  });
});

ipcMain.handle('save-history', async (event, original, balanced) => {
  const stmt = db.prepare('INSERT INTO history (original_equation, balanced_equation) VALUES (?, ?)');
  const result = stmt.run(original, balanced);
  return result.lastInsertRowid;
});

ipcMain.handle('get-history', async () => {
  const stmt = db.prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 50');
  return stmt.all();
});

ipcMain.handle('delete-history', async (event, id) => {
  const stmt = db.prepare('DELETE FROM history WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
});
