import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { audioBridge } from './audio-bridge'
import { initDatabase, presetDB, chainPresetDB, pluginChainDB } from './database'
import { readFxbFile, writeFxbFile, fxbToParameters, parametersToFxb } from './fxb'

let mainWindow: BrowserWindow | null = null

function setupPresetIpcHandlers() {
  ipcMain.handle('preset:create', async (_event, preset) => {
    return presetDB.create(preset)
  })

  ipcMain.handle('preset:getById', async (_event, id) => {
    return presetDB.getById(id)
  })

  ipcMain.handle('preset:getByPluginId', async (_event, pluginId) => {
    return presetDB.getByPluginId(pluginId)
  })

  ipcMain.handle('preset:getAll', async () => {
    return presetDB.getAll()
  })

  ipcMain.handle('preset:update', async (_event, id, updates) => {
    await presetDB.update(id, updates)
    return { success: true }
  })

  ipcMain.handle('preset:delete', async (_event, id) => {
    await presetDB.delete(id)
    return { success: true }
  })

  ipcMain.handle('preset:getCategories', async () => {
    return presetDB.getCategories()
  })
}

function setupChainPresetIpcHandlers() {
  ipcMain.handle('chainPreset:create', async (_event, preset) => {
    return chainPresetDB.create(preset)
  })

  ipcMain.handle('chainPreset:getById', async (_event, id) => {
    return chainPresetDB.getById(id)
  })

  ipcMain.handle('chainPreset:getAll', async () => {
    return chainPresetDB.getAll()
  })

  ipcMain.handle('chainPreset:update', async (_event, id, updates) => {
    await chainPresetDB.update(id, updates)
    return { success: true }
  })

  ipcMain.handle('chainPreset:delete', async (_event, id) => {
    await chainPresetDB.delete(id)
    return { success: true }
  })

  ipcMain.handle('chainPreset:getCategories', async () => {
    return chainPresetDB.getCategories()
  })
}

function setupPluginChainIpcHandlers() {
  ipcMain.handle('pluginChain:save', async (_event, chain) => {
    return pluginChainDB.save(chain)
  })

  ipcMain.handle('pluginChain:getByTrackId', async (_event, trackId) => {
    return pluginChainDB.getByTrackId(trackId)
  })

  ipcMain.handle('pluginChain:delete', async (_event, id) => {
    await pluginChainDB.delete(id)
    return { success: true }
  })
}

function setupFxbIpcHandlers() {
  ipcMain.handle('fxb:import', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'VST Bank Files', extensions: ['fxb'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    try {
      const fxb = await readFxbFile(result.filePaths[0])
      const parameters = fxbToParameters(fxb)
      return {
        filePath: result.filePaths[0],
        name: fxb.header.name || fxb.header.programName,
        parameters,
        numPrograms: fxb.header.numPrograms,
      }
    } catch (error) {
      console.error('Error importing FXB:', error)
      throw error
    }
  })

  ipcMain.handle('fxb:export', async (_event, parameters, name) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'VST Bank Files', extensions: ['fxb'] }],
      defaultPath: `${name}.fxb`,
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    try {
      const fxb = parametersToFxb(parameters, name)
      await writeFxbFile(result.filePath, fxb)
      return { success: true, filePath: result.filePath }
    } catch (error) {
      console.error('Error exporting FXB:', error)
      throw error
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0d0d1a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  initDatabase()
  setupPresetIpcHandlers()
  setupChainPresetIpcHandlers()
  setupPluginChainIpcHandlers()
  setupFxbIpcHandlers()
  audioBridge.setMainWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  audioBridge.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
