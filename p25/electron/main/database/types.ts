export interface PluginParameter {
  id: number
  name: string
  value: number
  normalized: number
  min?: number
  max?: number
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
  id: string
  name: string
  trackId: string
  plugins: PluginInstance[]
  createdAt: number
  updatedAt: number
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

export interface PluginInfo {
  id: string
  name: string
  vendor: string
  category: string
  path: string
}
