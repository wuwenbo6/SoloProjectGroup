export interface MidiNote {
  id: string
  noteNumber: number
  velocity: number
  startTime: number
  duration: number
}

export interface Clip {
  id: string
  trackId: string
  name: string
  startTime: number
  endTime: number
  type: 'audio' | 'midi'
  waveformData?: number[]
  midiNotes?: MidiNote[]
}

export interface Plugin {
  id: string
  name: string
  vendor: string
  category: string
  path?: string
}

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
  latency: number
}

export interface PluginChain {
  id?: string
  name: string
  trackId: string
  plugins: PluginInstance[]
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

export interface Track {
  id: string
  name: string
  type: 'audio' | 'midi' | 'instrument' | 'master'
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  armed: boolean
  color: string
  clips: Clip[]
  plugins: PluginInstance[]
  inputLevel: number
  outputLevel: number
  latency: number
  manualOffset: number
  pdcEnabled: boolean
}

export interface AutomationPoint {
  id: string
  time: number
  value: number
  curve: 'linear' | 'smooth' | 'step'
}

export interface AutomationTrack {
  id: string
  trackId: string
  parameter: string
  points: AutomationPoint[]
  visible: boolean
}

export interface Project {
  id: string
  name: string
  filePath?: string
  sampleRate: number
  bpm: number
  timeSignature: [number, number]
  duration: number
}

export interface TransportState {
  isPlaying: boolean
  isRecording: boolean
  playheadPosition: number
  loopStart: number
  loopEnd: number
  isLooping: boolean
}

export interface AppState {
  project: Project
  transport: TransportState
  tracks: Track[]
  plugins: {
    available: Plugin[]
    scanned: boolean
  }
  ui: {
    zoomLevel: number
    scrollPosition: number
    selectedTrackId?: string
    selectedClipId?: string
    activePanel: 'timeline' | 'mixer' | 'plugins' | 'midi'
  }
}

export interface RppNode {
  tag: string
  attributes: string[]
  children: RppNode[]
}

export interface RppTrack {
  name: string
  trackNumber: number
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  color: string
  plugins: RppPlugin[]
  items: RppItem[]
  automation: RppAutomation[]
}

export interface RppPlugin {
  name: string
  vendor: string
  bypassed: boolean
  position: number
  parameters: { [key: string]: number }
  latency: number
}

export interface RppItem {
  name: string
  startTime: number
  endTime: number
  type: 'audio' | 'midi'
  filePath?: string
  notes: RppMidiNote[]
}

export interface RppMidiNote {
  noteNumber: number
  startTime: number
  endTime: number
  velocity: number
}

export interface RppAutomation {
  parameter: string
  points: RppAutomationPoint[]
}

export interface RppAutomationPoint {
  time: number
  value: number
  curve: number
}

export interface RppProject {
  name: string
  bpm: number
  sampleRate: number
  timeSignature: [number, number]
  tracks: RppTrack[]
  duration: number
}
