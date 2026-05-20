import { BrowserWindow, ipcMain } from 'electron'

export interface PluginParamChange {
  pluginId: string
  paramId: number
  value: number
  normalized: number
}

export interface AudioNoteEvent {
  pluginId: string
  channel: number
  note: number
  velocity: number
}

class AudioBridge {
  private mainWindow: BrowserWindow | null = null
  private pendingGuiUpdates: Map<string, PluginParamChange[]> = new Map()
  private isProcessing: boolean = false
  private updateBatchInterval: NodeJS.Timeout | null = null

  constructor() {
    this.setupIpcHandlers()
    this.startBatchProcessing()
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  private setupIpcHandlers() {
    ipcMain.handle('audio:setParameter', async (_event, pluginId: string, paramId: number, value: number) => {
      return this.handleParameterChange(pluginId, paramId, value)
    })

    ipcMain.handle('audio:noteOn', async (_event, event: AudioNoteEvent) => {
      return this.handleNoteOn(event)
    })

    ipcMain.handle('audio:noteOff', async (_event, event: AudioNoteEvent) => {
      return this.handleNoteOff(event)
    })

    ipcMain.handle('audio:loadPlugin', async (_event, pluginId: string) => {
      return this.loadPlugin(pluginId)
    })

    ipcMain.handle('audio:unloadPlugin', async (_event, pluginId: string) => {
      return this.unloadPlugin(pluginId)
    })
  }

  private startBatchProcessing() {
    this.updateBatchInterval = setInterval(() => {
      this.processPendingUpdates()
    }, 16)
  }

  private async handleParameterChange(pluginId: string, paramId: number, value: number) {
    try {
      const normalized = this.normalizeValue(value)

      const changes = this.pendingGuiUpdates.get(pluginId) || []
      changes.push({ pluginId, paramId, value, normalized })
      this.pendingGuiUpdates.set(pluginId, changes)

      return { success: true }
    } catch (error) {
      console.error('Error handling parameter change:', error)
      return { success: false, error: String(error) }
    }
  }

  private async handleNoteOn(event: AudioNoteEvent) {
    try {
      this.sendToRenderer('audio:noteOn', event)
      return { success: true }
    } catch (error) {
      console.error('Error handling note on:', error)
      return { success: false, error: String(error) }
    }
  }

  private async handleNoteOff(event: AudioNoteEvent) {
    try {
      this.sendToRenderer('audio:noteOff', event)
      return { success: true }
    } catch (error) {
      console.error('Error handling note off:', error)
      return { success: false, error: String(error) }
    }
  }

  private async loadPlugin(pluginId: string) {
    try {
      this.sendToRenderer('audio:pluginLoaded', { pluginId })
      return { success: true }
    } catch (error) {
      console.error('Error loading plugin:', error)
      return { success: false, error: String(error) }
    }
  }

  private async unloadPlugin(pluginId: string) {
    try {
      this.pendingGuiUpdates.delete(pluginId)
      this.sendToRenderer('audio:pluginUnloaded', { pluginId })
      return { success: true }
    } catch (error) {
      console.error('Error unloading plugin:', error)
      return { success: false, error: String(error) }
    }
  }

  private processPendingUpdates() {
    if (this.isProcessing || this.pendingGuiUpdates.size === 0) {
      return
    }

    this.isProcessing = true

    try {
      for (const [pluginId, changes] of this.pendingGuiUpdates.entries()) {
        if (changes.length > 0) {
          this.sendToRenderer('audio:paramsUpdated', {
            pluginId,
            changes: this.deduplicateChanges(changes),
          })
        }
      }
      this.pendingGuiUpdates.clear()
    } catch (error) {
      console.error('Error processing GUI updates:', error)
    }

    this.isProcessing = false
  }

  private deduplicateChanges(changes: PluginParamChange[]): PluginParamChange[] {
    const latest = new Map<number, PluginParamChange>()
    for (const change of changes) {
      latest.set(change.paramId, change)
    }
    return Array.from(latest.values())
  }

  private normalizeValue(value: number): number {
    return Math.max(0, Math.min(1, value))
  }

  private sendToRenderer(channel: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  destroy() {
    if (this.updateBatchInterval) {
      clearInterval(this.updateBatchInterval)
    }
  }
}

export const audioBridge = new AudioBridge()
