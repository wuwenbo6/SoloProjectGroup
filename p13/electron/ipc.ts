import { ipcMain, BrowserWindow, dialog } from 'electron'
import { midiManager } from './midi'
import { 
  getScripts, saveScript, deleteScript, getScriptById,
  getPresets, savePreset, deletePreset,
  getMappings, saveMapping, deleteMapping, toggleMapping,
  addMidiLog, getMidiLogs, clearMidiLogs, exportLogs
} from './database'
import { initScriptEngine, getScriptEngine } from './script-engine'
import { MidiMessage, LogEntry, MidiMapping } from '../src/types/electron'
import { v4 as uuidv4 } from 'uuid'

let messageHandlerCleanup: (() => void) | null = null

export function initIpcHandlers(mainWindow: BrowserWindow) {
  initScriptEngine((msg: MidiMessage) => {
    midiManager.sendMessage(msg)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'midi-out',
        message: `Sent: ${msg.type} ch${msg.channel}`,
        data: msg
      })
    }
  })

  const onMessage = (message: MidiMessage) => {
    addMidiLog({ type: 'midi-in', message: `Received: ${message.type} ch${message.channel}`, data: message })
    
    processMidiMappings(message)
    
    const scriptEngine = getScriptEngine()
    scriptEngine.processMidiMessage(message)
    
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('midi-message', message)
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'midi-in',
        message: `Received: ${message.type} ch${message.channel}`,
        data: message
      })
    }
  }

  midiManager.on('message', onMessage)

  messageHandlerCleanup = () => {
    midiManager.off('message', onMessage)
  }

  ipcMain.handle('get-midi-devices', () => {
    return {
      inputs: midiManager.getInputs(),
      outputs: midiManager.getOutputs()
    }
  })

  ipcMain.handle('connect-midi-input', (_, deviceId: string) => {
    const success = midiManager.connectInput(deviceId)
    if (success && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'info',
        message: `Connected MIDI input: ${deviceId}`
      })
    }
    return success
  })

  ipcMain.handle('connect-midi-output', (_, deviceId: string) => {
    const success = midiManager.connectOutput(deviceId)
    if (success && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'info',
        message: `Connected MIDI output: ${deviceId}`
      })
    }
    return success
  })

  ipcMain.handle('disconnect-midi-input', () => {
    midiManager.disconnectInput()
  })

  ipcMain.handle('disconnect-midi-output', () => {
    midiManager.disconnectOutput()
  })

  ipcMain.handle('send-midi-message', (_, message: MidiMessage) => {
    midiManager.sendMessage(message)
  })

  ipcMain.handle('save-script', (_, script) => saveScript(script))
  ipcMain.handle('get-scripts', () => getScripts())
  ipcMain.handle('delete-script', (_, id: string) => deleteScript(id))

  ipcMain.handle('export-script', async (_, id: string) => {
    const script = getScriptById(id)
    if (!script) return null
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Script',
      defaultPath: `${script.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    
    if (!result.canceled && result.filePath) {
      require('fs').writeFileSync(result.filePath, JSON.stringify(script, null, 2))
    }
    return script
  })

  ipcMain.handle('import-script', async (_, scriptData: any) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Script',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const content = require('fs').readFileSync(result.filePaths[0], 'utf8')
      const script = JSON.parse(content)
      script.id = uuidv4()
      return saveScript(script)
    }
    throw new Error('No file selected')
  })

  ipcMain.handle('save-preset', (_, preset) => savePreset(preset))
  ipcMain.handle('get-presets', () => getPresets())
  ipcMain.handle('delete-preset', (_, id: string) => deletePreset(id))

  ipcMain.handle('execute-script', (_, code: string, message: MidiMessage) => {
    const scriptEngine = getScriptEngine()
    scriptEngine.processMidiMessage(message)
  })

  ipcMain.handle('start-script-engine', (_, code: string) => {
    const scriptEngine = getScriptEngine()
    scriptEngine.start(code)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'script',
        message: 'Script engine started'
      })
    }
  })

  ipcMain.handle('stop-script-engine', () => {
    const scriptEngine = getScriptEngine()
    scriptEngine.stop()
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'script',
        message: 'Script engine stopped'
      })
    }
  })

  ipcMain.handle('set-breakpoint', (_, line: number, condition?: string) => {
    const scriptEngine = getScriptEngine()
    scriptEngine.setBreakpoint(line, condition)
  })

  ipcMain.handle('remove-breakpoint', (_, line: number) => {
    const scriptEngine = getScriptEngine()
    scriptEngine.removeBreakpoint(line)
  })

  ipcMain.handle('get-breakpoints', () => {
    const scriptEngine = getScriptEngine()
    return scriptEngine.getBreakpoints()
  })

  ipcMain.handle('resume-execution', () => {
    const scriptEngine = getScriptEngine()
    scriptEngine.resume()
  })

  ipcMain.handle('step-over', () => {
    const scriptEngine = getScriptEngine()
    scriptEngine.stepOver()
  })

  ipcMain.handle('step-into', () => {
    const scriptEngine = getScriptEngine()
    scriptEngine.stepInto()
  })

  ipcMain.handle('step-out', () => {
    const scriptEngine = getScriptEngine()
    scriptEngine.stepOut()
  })

  ipcMain.handle('get-variables', () => {
    const scriptEngine = getScriptEngine()
    return scriptEngine.getVariables()
  })

  ipcMain.handle('evaluate-expression', (_, expression: string) => {
    const scriptEngine = getScriptEngine()
    return scriptEngine.evaluate(expression)
  })

  ipcMain.handle('get-midi-logs', (_, filters) => getMidiLogs(filters))
  ipcMain.handle('clear-midi-logs', () => clearMidiLogs())
  
  ipcMain.handle('export-logs', async (_, format: 'json' | 'csv', filters?: any) => {
    const data = exportLogs(format, filters)
    const ext = format === 'json' ? 'json' : 'csv'
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `Export Logs as ${format.toUpperCase()}`,
      defaultPath: `midi-logs.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    
    if (!result.canceled && result.filePath) {
      require('fs').writeFileSync(result.filePath, data)
    }
    return result.filePath
  })

  ipcMain.handle('save-mapping', (_, mapping) => saveMapping(mapping))
  ipcMain.handle('get-mappings', () => getMappings())
  ipcMain.handle('delete-mapping', (_, id: string) => deleteMapping(id))
  ipcMain.handle('toggle-mapping', (_, id: string, enabled: boolean) => toggleMapping(id, enabled))

  ipcMain.on('add-log', (_, log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    addMidiLog(log)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        id: uuidv4(),
        timestamp: Date.now(),
        ...log
      })
    }
  })
}

function processMidiMappings(message: MidiMessage) {
  const mappings = getMappings().filter(m => m.enabled)
  
  for (const mapping of mappings) {
    let matches = false
    
    if (mapping.sourceType === message.type) {
      if (mapping.sourceChannel !== undefined && mapping.sourceChannel !== message.channel) {
        continue
      }
      
      if (mapping.sourceType === 'note' && mapping.sourceValue !== undefined) {
        matches = message.note === mapping.sourceValue
      } else if (mapping.sourceType === 'cc' && mapping.sourceValue !== undefined) {
        matches = message.controller === mapping.sourceValue
      } else if (mapping.sourceType === 'pitch') {
        matches = true
      } else {
        matches = true
      }
    }
    
    if (matches) {
      let targetMessage: MidiMessage = { ...message, type: mapping.targetType }
      
      if (mapping.targetChannel !== undefined) {
        targetMessage.channel = mapping.targetChannel
      }
      
      if (mapping.targetType === 'note' && mapping.targetValue !== undefined) {
        targetMessage.note = mapping.targetValue
      } else if (mapping.targetType === 'cc' && mapping.targetValue !== undefined) {
        targetMessage.controller = mapping.targetValue
      }
      
      if (mapping.transform) {
        try {
          const fn = new Function('msg', `return ${mapping.transform}`)
          targetMessage = fn(targetMessage) || targetMessage
        } catch (e) {
          console.error('Transform error:', e)
        }
      }
      
      midiManager.sendMessage(targetMessage)
    }
  }
}

export function cleanupIpcHandlers() {
  if (messageHandlerCleanup) {
    messageHandlerCleanup()
    messageHandlerCleanup = null
  }
  try {
    const scriptEngine = getScriptEngine()
    scriptEngine.destroy()
  } catch (e) {}
}
