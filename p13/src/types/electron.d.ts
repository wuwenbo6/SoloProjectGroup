export interface MidiDevice {
  id: string
  name: string
  type: 'input' | 'output'
}

export interface MidiMessage {
  type: string
  note?: number
  velocity?: number
  controller?: number
  value?: number
  channel: number
  timestamp?: number
  raw?: number[]
}

export interface Script {
  id: string
  name: string
  code: string
  createdAt: number
  updatedAt: number
  description?: string
  tags?: string[]
}

export interface Preset {
  id: string
  name: string
  scriptId: string
  inputDeviceId: string
  outputDeviceId: string
  createdAt: number
}

export interface LogEntry {
  id: string
  timestamp: number
  type: 'info' | 'error' | 'midi-in' | 'midi-out' | 'script'
  message: string
  data?: any
}

export interface MidiMapping {
  id: string
  name: string
  enabled: boolean
  sourceType: 'note' | 'cc' | 'pitch'
  sourceChannel?: number
  sourceValue?: number
  targetType: 'note' | 'cc' | 'pitch'
  targetChannel?: number
  targetValue?: number
  transform?: string
  createdAt: number
}

export interface Breakpoint {
  line: number
  enabled: boolean
  condition?: string
}

export interface IpcApi {
  getMidiDevices: () => Promise<{ inputs: MidiDevice[]; outputs: MidiDevice[] }>
  connectMidiInput: (deviceId: string) => Promise<boolean>
  connectMidiOutput: (deviceId: string) => Promise<boolean>
  disconnectMidiInput: () => Promise<void>
  disconnectMidiOutput: () => Promise<void>
  sendMidiMessage: (message: MidiMessage) => Promise<void>
  onMidiMessage: (callback: (message: MidiMessage) => void) => () => void

  saveScript: (script: Omit<Script, 'createdAt' | 'updatedAt'>) => Promise<Script>
  getScripts: () => Promise<Script[]>
  deleteScript: (id: string) => Promise<void>
  exportScript: (id: string) => Promise<Script | null>
  importScript: (script: Script) => Promise<Script>

  savePreset: (preset: Omit<Preset, 'createdAt'>) => Promise<Preset>
  getPresets: () => Promise<Preset[]>
  deletePreset: (id: string) => Promise<void>

  executeScript: (code: string, message: MidiMessage) => Promise<any>
  startScriptEngine: (code: string) => Promise<void>
  stopScriptEngine: () => Promise<void>

  setBreakpoint: (line: number, condition?: string) => void
  removeBreakpoint: (line: number) => void
  getBreakpoints: () => Promise<Breakpoint[]>
  resumeExecution: () => void
  stepOver: () => void
  stepInto: () => void
  stepOut: () => void
  getVariables: () => Promise<Record<string, any>>
  evaluateExpression: (expression: string) => Promise<any>

  getMidiLogs: (filters?: { type?: string; channel?: number; start?: number; end?: number }) => Promise<LogEntry[]>
  clearMidiLogs: () => Promise<void>
  exportLogs: (format: 'json' | 'csv', filters?: any) => Promise<string>

  saveMapping: (mapping: Omit<MidiMapping, 'createdAt'>) => Promise<MidiMapping>
  getMappings: () => Promise<MidiMapping[]>
  deleteMapping: (id: string) => Promise<void>
  toggleMapping: (id: string, enabled: boolean) => Promise<void>

  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
  onLog: (callback: (log: LogEntry) => void) => () => void
}

declare global {
  interface Window {
    api: IpcApi
  }
}

export {}
