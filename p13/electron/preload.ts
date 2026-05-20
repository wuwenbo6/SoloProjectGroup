import { contextBridge, ipcRenderer } from 'electron'
import { MidiDevice, MidiMessage, Script, Preset, LogEntry, MidiMapping, Breakpoint } from '../src/types/electron'

contextBridge.exposeInMainWorld('api', {
  getMidiDevices: () => ipcRenderer.invoke('get-midi-devices'),
  connectMidiInput: (deviceId: string) => ipcRenderer.invoke('connect-midi-input', deviceId),
  connectMidiOutput: (deviceId: string) => ipcRenderer.invoke('connect-midi-output', deviceId),
  disconnectMidiInput: () => ipcRenderer.invoke('disconnect-midi-input'),
  disconnectMidiOutput: () => ipcRenderer.invoke('disconnect-midi-output'),
  sendMidiMessage: (message: MidiMessage) => ipcRenderer.invoke('send-midi-message', message),
  
  onMidiMessage: (callback: (message: MidiMessage) => void) => {
    const handler = (_: any, msg: MidiMessage) => callback(msg)
    ipcRenderer.on('midi-message', handler)
    return () => ipcRenderer.removeListener('midi-message', handler)
  },

  saveScript: (script: Omit<Script, 'createdAt' | 'updatedAt'>) => 
    ipcRenderer.invoke('save-script', script),
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  deleteScript: (id: string) => ipcRenderer.invoke('delete-script', id),
  exportScript: (id: string) => ipcRenderer.invoke('export-script', id),
  importScript: (scriptData: any) => ipcRenderer.invoke('import-script', scriptData),

  savePreset: (preset: Omit<Preset, 'createdAt'>) => 
    ipcRenderer.invoke('save-preset', preset),
  getPresets: () => ipcRenderer.invoke('get-presets'),
  deletePreset: (id: string) => ipcRenderer.invoke('delete-preset', id),

  executeScript: (code: string, message: MidiMessage) => 
    ipcRenderer.invoke('execute-script', code, message),
  startScriptEngine: (code: string) => ipcRenderer.invoke('start-script-engine', code),
  stopScriptEngine: () => ipcRenderer.invoke('stop-script-engine'),

  setBreakpoint: (line: number, condition?: string) => 
    ipcRenderer.invoke('set-breakpoint', line, condition),
  removeBreakpoint: (line: number) => ipcRenderer.invoke('remove-breakpoint', line),
  getBreakpoints: () => ipcRenderer.invoke('get-breakpoints'),
  resumeExecution: () => ipcRenderer.invoke('resume-execution'),
  stepOver: () => ipcRenderer.invoke('step-over'),
  stepInto: () => ipcRenderer.invoke('step-into'),
  stepOut: () => ipcRenderer.invoke('step-out'),
  getVariables: () => ipcRenderer.invoke('get-variables'),
  evaluateExpression: (expression: string) => ipcRenderer.invoke('evaluate-expression', expression),

  getMidiLogs: (filters?: any) => ipcRenderer.invoke('get-midi-logs', filters),
  clearMidiLogs: () => ipcRenderer.invoke('clear-midi-logs'),
  exportLogs: (format: 'json' | 'csv', filters?: any) => 
    ipcRenderer.invoke('export-logs', format, filters),

  saveMapping: (mapping: Omit<MidiMapping, 'createdAt'>) => 
    ipcRenderer.invoke('save-mapping', mapping),
  getMappings: () => ipcRenderer.invoke('get-mappings'),
  deleteMapping: (id: string) => ipcRenderer.invoke('delete-mapping', id),
  toggleMapping: (id: string, enabled: boolean) => 
    ipcRenderer.invoke('toggle-mapping', id, enabled),

  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => 
    ipcRenderer.send('add-log', log),
  
  onLog: (callback: (log: LogEntry) => void) => {
    const handler = (_: any, log: LogEntry) => callback(log)
    ipcRenderer.on('log-entry', handler)
    return () => ipcRenderer.removeListener('log-entry', handler)
  }
})
