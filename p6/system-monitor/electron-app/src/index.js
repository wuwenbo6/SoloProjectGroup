const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const SystemCollector = require('./main/collector');
const SystemTray = require('./main/tray');
const db = require('../../data-service/src/db');
const reporter = require('../../data-service/src/reporter');

let mainWindow;
let systemTray;
let collector;
let collectionInterval;
let refreshInterval = 1000;
let processFilter = null;
let retentionDays = 7;

let alertConfig = {
  cpuThreshold: 90,
  memoryThreshold: 90,
  diskThreshold: 90,
  notificationType: 'both',
  enabled: true
};

let lastAlertTime = {
  cpu: 0,
  memory: 0,
  disk: 0
};
const ALERT_COOLDOWN = 30000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '..', 'assets', 'app-icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function sendAlert(type, value, threshold) {
  const now = Date.now();
  if (now - lastAlertTime[type] < ALERT_COOLDOWN) return;
  lastAlertTime[type] = now;

  const typeNames = {
    cpu: 'CPU 使用率',
    memory: '内存使用率',
    disk: '磁盘使用率'
  };

  const title = `⚠️ ${typeNames[type]}告警`;
  const message = `${typeNames[type]}已达 ${value.toFixed(1)}%，超过阈值 ${threshold}%`;

  if (alertConfig.notificationType === 'dialog' || alertConfig.notificationType === 'both') {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title,
      message,
      buttons: ['确定']
    });
  }

  if (alertConfig.notificationType === 'notification' || alertConfig.notificationType === 'both') {
    if (Notification.isSupported()) {
      new Notification({ title, body: message }).show();
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('alert-triggered', { type, value, threshold, timestamp: now });
  }
}

function checkAlerts(data) {
  if (!alertConfig.enabled) return;

  if (data.cpuUsage >= alertConfig.cpuThreshold) {
    sendAlert('cpu', data.cpuUsage, alertConfig.cpuThreshold);
  }

  if (data.memoryUsage >= alertConfig.memoryThreshold) {
    sendAlert('memory', data.memoryUsage, alertConfig.memoryThreshold);
  }

  if (data.diskUsage >= alertConfig.diskThreshold) {
    sendAlert('disk', data.diskUsage, alertConfig.diskThreshold);
  }
}

async function startCollection() {
  if (collectionInterval) {
    clearInterval(collectionInterval);
  }

  collectionInterval = setInterval(async () => {
    try {
      const data = await collector.collectAll(processFilter);
      
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.webContents.send('metrics-update', data);
      }

      checkAlerts(data);

      db.insertSystemMetrics(data);
      if (data.processes.length > 0) {
        db.insertProcessMetrics(data.processes);
      }

      if (systemTray) {
        systemTray.updateCpuUsage(data.cpuUsage);
      }
    } catch (error) {
      console.error('Collection error:', error);
    }
  }, refreshInterval);
}

function killProcess(pid) {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      command = `taskkill /F /PID ${pid}`;
    } else {
      command = `kill -9 ${pid}`;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ success: true, stdout, stderr });
      }
    });
  });
}

function setupIpcHandlers() {
  ipcMain.on('set-refresh-interval', (event, interval) => {
    refreshInterval = interval;
    startCollection();
  });

  ipcMain.on('set-process-filter', (event, filter) => {
    processFilter = filter;
  });

  ipcMain.on('set-retention-days', (event, days) => {
    retentionDays = days;
  });

  ipcMain.handle('cleanup-old-data', async () => {
    return db.cleanupOldData(retentionDays);
  });

  ipcMain.handle('query-history', async (event, startTime, endTime) => {
    return db.querySystemMetrics(startTime, endTime);
  });

  ipcMain.handle('export-report', async (event, type, startTime, endTime, processName) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      defaultPath: `monitor-report-${Date.now()}.csv`
    });

    if (!filePath) return null;

    if (type === 'system') {
      return await reporter.generateSystemReport(startTime, endTime, filePath);
    } else {
      return await reporter.generateProcessReport(startTime, endTime, processName, filePath);
    }
  });

  ipcMain.handle('set-alert-config', async (event, config) => {
    alertConfig = { ...alertConfig, ...config };
    return { success: true, config: alertConfig };
  });

  ipcMain.handle('get-alert-config', async () => {
    return alertConfig;
  });

  ipcMain.handle('get-process-detail', async (event, pid) => {
    try {
      return await collector.getProcessDetail(pid);
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('kill-process', async (event, pid) => {
    try {
      const result = await killProcess(pid);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('search-processes', async (event, searchTerm) => {
    try {
      return await collector.searchProcesses(searchTerm);
    } catch (error) {
      return { error: error.message };
    }
  });
}

app.whenReady().then(async () => {
  collector = new SystemCollector();
  createWindow();
  systemTray = new SystemTray(mainWindow);
  
  try {
    systemTray.createTray();
  } catch (e) {
    console.warn('Tray creation failed (no icon found), continuing without tray');
  }
  
  setupIpcHandlers();
  startCollection();

  setInterval(() => {
    db.cleanupOldData(retentionDays);
  }, 24 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (collectionInterval) {
    clearInterval(collectionInterval);
  }
  if (systemTray) {
    systemTray.destroy();
  }
});
