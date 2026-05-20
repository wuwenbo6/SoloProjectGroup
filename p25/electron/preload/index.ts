import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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

export interface PluginParameter {
  id: number
  name: string
  value: number
  normalized: number
  min?: number
  max?: number
}

export interface Preset {
  id: string
  name: string
  pluginId: string
  category?: string
  author?: string
  parameters: PluginParameter[]
  createdAt: number
  updatedAt: number
}

export interface PluginInstance {
  id: string
  pluginId: string
  name: string
  bypassed: boolean
  parameters: PluginParameter[]
  position: number
}

export interface PluginChain {
  id?: string
  name: string
  trackId: string
  plugins: PluginInstance[]
}

export interface ChainPreset {
  id: string
  name: string
  category?: string
  author?: string
  plugins: {
    pluginId: string
    name: string
    parameters: PluginParameter[]
    position: number
  }[]
  createdAt: number
  updatedAt: number
}

contextBridge.exposeInMainWorld('audioAPI', {
  setParameter: (pluginId: string, paramId: number, value: number) =>
    ipcRenderer.invoke('audio:setParameter', pluginId, paramId, value),

  noteOn: (event: AudioNoteEvent) =>
    ipcRenderer.invoke('audio:noteOn', event),

  noteOff: (event: AudioNoteEvent) =>
    ipcRenderer.invoke('audio:noteOff', event),

  loadPlugin: (pluginId: string) =>
    ipcRenderer.invoke('audio:loadPlugin', pluginId),

  unloadPlugin: (pluginId: string) =>
    ipcRenderer.invoke('audio:unloadPlugin', pluginId),

  onParamsUpdated: (callback: (event: { pluginId: string; changes: PluginParamChange[] }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { pluginId: string; changes: PluginParamChange[] }) => callback(data)
    ipcRenderer.on('audio:paramsUpdated', handler)
    return () => ipcRenderer.removeListener('audio:paramsUpdated', handler)
  },

  onNoteOn: (callback: (event: AudioNoteEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: AudioNoteEvent) => callback(data)
    ipcRenderer.on('audio:noteOn', handler)
    return () => ipcRenderer.removeListener('audio:noteOn', handler)
  },

  onNoteOff: (callback: (event: AudioNoteEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: AudioNoteEvent) => callback(data)
    ipcRenderer.on('audio:noteOff', handler)
    return () => ipcRenderer.removeListener('audio:noteOff', handler)
  },

  onPluginLoaded: (callback: (event: { pluginId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { pluginId: string }) => callback(data)
    ipcRenderer.on('audio:pluginLoaded', handler)
    return () => ipcRenderer.removeListener('audio:pluginLoaded', handler)
  },

  onPluginUnloaded: (callback: (event: { pluginId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { pluginId: string }) => callback(data)
    ipcRenderer.on('audio:pluginUnloaded', handler)
    return () => ipcRenderer.removeListener('audio:pluginUnloaded', handler)
  },
})

contextBridge.exposeInMainWorld('presetAPI', {
  create: (preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('preset:create', preset),

  getById: (id: string) =>
    ipcRenderer.invoke('preset:getById', id),

  getByPluginId: (pluginId: string) =>
    ipcRenderer.invoke('preset:getByPluginId', pluginId),

  getAll: () =>
    ipcRenderer.invoke('preset:getAll'),

  update: (id: string, updates: Partial<Pick<Preset, 'name' | 'category' | 'author' | 'parameters'>>) =>
    ipcRenderer.invoke('preset:update', id, updates),

  delete: (id: string) =>
    ipcRenderer.invoke('preset:delete', id),

  getCategories: () =>
    ipcRenderer.invoke('preset:getCategories'),
})

contextBridge.exposeInMainWorld('chainPresetAPI', {
  create: (preset: Omit<ChainPreset, 'id' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('chainPreset:create', preset),

  getById: (id: string) =>
    ipcRenderer.invoke('chainPreset:getById', id),

  getAll: () =>
    ipcRenderer.invoke('chainPreset:getAll'),

  update: (id: string, updates: Partial<Pick<ChainPreset, 'name' | 'category' | 'author' | 'plugins'>>) =>
    ipcRenderer.invoke('chainPreset:update', id, updates),

  delete: (id: string) =>
    ipcRenderer.invoke('chainPreset:delete', id),

  getCategories: () =>
    ipcRenderer.invoke('chainPreset:getCategories'),
})

contextBridge.exposeInMainWorld('pluginChainAPI', {
  save: (chain: PluginChain) =>
    ipcRenderer.invoke('pluginChain:save', chain),

  getByTrackId: (trackId: string) =>
    ipcRenderer.invoke('pluginChain:getByTrackId', trackId),

  delete: (id: string) =>
    ipcRenderer.invoke('pluginChain:delete', id),
})

contextBridge.exposeInMainWorld('fxbAPI', {
  importPreset: () =>
    ipcRenderer.invoke('fxb:import'),

  exportPreset: (parameters: PluginParameter[], name: string) =>
    ipcRenderer.invoke('fxb:export', parameters, name),
})

declare global {
  interface Window {
    audioAPI: {
      setParameter: (pluginId: string, paramId: number, value: number) => Promise<{ success: boolean; error?: string }>
      noteOn: (event: AudioNoteEvent) => Promise<{ success: boolean; error?: string }>
      noteOff: (event: AudioNoteEvent) => Promise<{ success: boolean; error?: string }>
      loadPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>
      unloadPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>
      onParamsUpdated: (callback: (event: { pluginId: string; changes: PluginParamChange[] }) => void) => () => void
      onNoteOn: (callback: (event: AudioNoteEvent) => void) => () => void
      onNoteOff: (callback: (event: AudioNoteEvent) => void) => () => void
      onPluginLoaded: (callback: (event: { pluginId: string }) => void) => () => void
      onPluginUnloaded: (callback: (event: { pluginId: string }) => void) => () => void
    }
    presetAPI: {
      create: (preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Preset>
      getById: (id: string) => Promise<Preset | null>
      getByPluginId: (pluginId: string) => Promise<Preset[]>
      getAll: () => Promise<Preset[]>
      update: (id: string, updates: Partial<Pick<Preset, 'name' | 'category' | 'author' | 'parameters'>>) => Promise<{ success: boolean }>
      delete: (id: string) => Promise<{ success: boolean }>
      getCategories: () => Promise<string[]>
    }
    chainPresetAPI: {
      create: (preset: Omit<ChainPreset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ChainPreset>
      getById: (id: string) => Promise<ChainPreset | null>
      getAll: () => Promise<ChainPreset[]>
      update: (id: string, updates: Partial<Pick<ChainPreset, 'name' | 'category' | 'author' | 'plugins'>>) => Promise<{ success: boolean }>
      delete: (id: string) => Promise<{ success: boolean }>
      getCategories: () => Promise<string[]>
    }
    pluginChainAPI: {
      save: (chain: PluginChain) => Promise<PluginChain & { id: string; createdAt: number; updatedAt: number }>
      getByTrackId: (trackId: string) => Promise<(PluginChain & { id: string; createdAt: number; updatedAt: number }) | null>
      delete: (id: string) => Promise<{ success: boolean }>
    }
    fxbAPI: {
      importPreset: () => Promise<{ filePath: string; name: string; parameters: PluginParameter[]; numPrograms: number } | null>
      exportPreset: (parameters: PluginParameter[], name: string) => Promise<{ success: boolean; filePath?: string }>
    }
  }
}
