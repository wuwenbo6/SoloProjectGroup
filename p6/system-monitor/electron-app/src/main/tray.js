const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

class SystemTray {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
    this.currentCpuUsage = 0;
    this.platform = process.platform;
  }

  getIconPath() {
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'assets', 'tray-icon.png'),
      path.join(app.getAppPath(), 'assets', 'tray-icon.png'),
      path.join(__dirname, 'tray-icon.png')
    ];
    
    for (const iconPath of possiblePaths) {
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
    }
    
    return null;
  }

  createTray() {
    try {
      const iconPath = this.getIconPath();
      
      if (iconPath) {
        let icon = nativeImage.createFromPath(iconPath);
        
        if (this.platform === 'linux') {
          icon = icon.resize({ width: 22, height: 22 });
        } else if (this.platform === 'darwin') {
          icon = icon.resize({ width: 18, height: 18 });
          if (icon.setTemplateImage) {
            icon.setTemplateImage(true);
          }
        }
        
        this.tray = new Tray(icon);
      } else {
        console.warn('Tray icon not found, using empty icon');
        const emptyIcon = nativeImage.createEmpty();
        this.tray = new Tray(emptyIcon);
      }
      
      this.updateContextMenu();
      
      this.tray.setToolTip(`系统资源监控 - CPU: ${this.currentCpuUsage.toFixed(1)}%`);
      
      this.tray.on('click', () => {
        this.toggleWindow();
      });
    } catch (e) {
      console.warn('Failed to create tray icon:', e.message);
      this.tray = null;
    }
  }

  updateContextMenu() {
    if (!this.tray) return;
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `CPU: ${this.currentCpuUsage.toFixed(1)}%`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '打开监控面板',
        click: () => {
          this.showWindow();
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          process.exit(0);
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
  }

  updateCpuUsage(cpuUsage) {
    this.currentCpuUsage = cpuUsage;
    if (this.tray) {
      try {
        this.tray.setToolTip(`系统资源监控 - CPU: ${cpuUsage.toFixed(1)}%`);
        this.updateContextMenu();
      } catch (e) {
        console.warn('Failed to update tray:', e.message);
      }
    }
  }

  showWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  toggleWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.showWindow();
      }
    }
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
    }
  }
}

module.exports = SystemTray;
