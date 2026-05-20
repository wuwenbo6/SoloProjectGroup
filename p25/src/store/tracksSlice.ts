import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Track, Clip, RppProject, RppTrack, RppItem, RppPlugin, RppAutomation } from '../types'

const initialTracks: Track[] = [
  {
    id: 'track-1',
    name: 'Drums',
    type: 'audio',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    color: '#4ecdc4',
    clips: [
      {
        id: 'clip-1',
        trackId: 'track-1',
        name: 'Drum Loop',
        startTime: 0,
        endTime: 8,
        type: 'audio',
        waveformData: Array.from({ length: 100 }, () => Math.random() * 0.8 + 0.2),
      },
    ],
    plugins: [],
    inputLevel: 0,
    outputLevel: 0.3,
    latency: 0,
    manualOffset: 0,
    pdcEnabled: true,
  },
  {
    id: 'track-2',
    name: 'Bass',
    type: 'audio',
    volume: 0.75,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    color: '#45b7d1',
    clips: [
      {
        id: 'clip-2',
        trackId: 'track-2',
        name: 'Bass Line',
        startTime: 2,
        endTime: 10,
        type: 'audio',
        waveformData: Array.from({ length: 100 }, () => Math.random() * 0.6 + 0.3),
      },
    ],
    plugins: [],
    inputLevel: 0,
    outputLevel: 0.25,
    latency: 0,
    manualOffset: 0,
    pdcEnabled: true,
  },
  {
    id: 'track-3',
    name: 'Synth Lead',
    type: 'instrument',
    volume: 0.7,
    pan: 0.2,
    muted: false,
    solo: false,
    armed: true,
    color: '#96ceb4',
    clips: [
      {
        id: 'clip-3',
        trackId: 'track-3',
        name: 'Lead Melody',
        startTime: 4,
        endTime: 12,
        type: 'midi',
        midiNotes: [
          { id: 'n1', noteNumber: 60, velocity: 100, startTime: 4, duration: 0.5 },
          { id: 'n2', noteNumber: 62, velocity: 90, startTime: 4.5, duration: 0.5 },
          { id: 'n3', noteNumber: 64, velocity: 95, startTime: 5, duration: 1 },
        ],
      },
    ],
    plugins: [],
    inputLevel: 0,
    outputLevel: 0.2,
    latency: 0,
    manualOffset: 0,
    pdcEnabled: true,
  },
  {
    id: 'track-4',
    name: 'Pads',
    type: 'audio',
    volume: 0.6,
    pan: -0.1,
    muted: false,
    solo: false,
    armed: false,
    color: '#ffeaa7',
    clips: [],
    plugins: [],
    inputLevel: 0,
    outputLevel: 0.15,
    latency: 0,
    manualOffset: 0,
    pdcEnabled: true,
  },
  {
    id: 'master',
    name: 'Master',
    type: 'master',
    volume: 0.9,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    color: '#dfe6e9',
    clips: [],
    plugins: [],
    inputLevel: 0,
    outputLevel: 0.4,
    latency: 0,
    manualOffset: 0,
    pdcEnabled: true,
  },
]

const tracksSlice = createSlice({
  name: 'tracks',
  initialState: initialTracks,
  reducers: {
    setVolume: (state, action: PayloadAction<{ trackId: string; volume: number }>) => {
      const track = state.find((t) => t.id === action.payload.trackId)
      if (track) {
        track.volume = action.payload.volume
      }
    },
    setPan: (state, action: PayloadAction<{ trackId: string; pan: number }>) => {
      const track = state.find((t) => t.id === action.payload.trackId)
      if (track) {
        track.pan = action.payload.pan
      }
    },
    toggleMute: (state, action: PayloadAction<string>) => {
      const track = state.find((t) => t.id === action.payload)
      if (track) {
        track.muted = !track.muted
      }
    },
    toggleSolo: (state, action: PayloadAction<string>) => {
      const track = state.find((t) => t.id === action.payload)
      if (track) {
        track.solo = !track.solo
      }
    },
    toggleArm: (state, action: PayloadAction<string>) => {
      const track = state.find((t) => t.id === action.payload)
      if (track) {
        track.armed = !track.armed
      }
    },
    addTrack: (state, action: PayloadAction<Track>) => {
      state.push(action.payload)
    },
    removeTrack: (state, action: PayloadAction<string>) => {
      return state.filter((t) => t.id !== action.payload)
    },
    addClip: (state, action: PayloadAction<{ trackId: string; clip: Clip }>) => {
      const track = state.find((t) => t.id === action.payload.trackId)
      if (track) {
        track.clips.push(action.payload.clip)
      }
    },
    updateLevels: (state) => {
      state.forEach((track) => {
        if (track.id !== 'master') {
          track.outputLevel = Math.min(1, track.outputLevel + (Math.random() - 0.5) * 0.1)
        }
      })
    },
    setPluginLatency: (
      state,
      action: PayloadAction<{
        trackId: string
        pluginId: string
        latency: number
      }>
    ) => {
      const track = state.find((t) => t.id === action.payload.trackId)
      if (track) {
        const plugin = track.plugins.find(
          (p) => p.id === action.payload.pluginId
        )
        if (plugin) {
          plugin.latency = action.payload.latency
        }
      }
    },
    recalculateTrackLatency: (state, action: PayloadAction<string>) => {
      const track = state.find((t) => t.id === action.payload)
      if (track) {
        track.latency = track.plugins.reduce((total, plugin) => {
          if (!plugin.bypassed) {
            return total + (plugin.latency || 0)
          }
          return total
        }, 0)
      }
    },
    recalculateAllLatencies: (state) => {
      state.forEach((track) => {
        if (track.id !== 'master') {
          track.latency = track.plugins.reduce((total, plugin) => {
            if (!plugin.bypassed) {
              return total + (plugin.latency || 0)
            }
            return total
          }, 0)
        }
      })
    },
    setManualOffset: (
      state,
      action: PayloadAction<{ trackId: string; offset: number }>
    ) => {
      const track = state.find((t) => t.id === action.payload.trackId)
      if (track) {
        track.manualOffset = action.payload.offset
      }
    },
    togglePDC: (state, action: PayloadAction<string>) => {
      const track = state.find((t) => t.id === action.payload)
      if (track) {
        track.pdcEnabled = !track.pdcEnabled
      }
    },
    importRppProject: (state, action: PayloadAction<RppProject>) => {
      const newTracks = convertRppToTracks(action.payload)
      const masterIndex = state.findIndex((t) => t.id === 'master')
      if (masterIndex >= 0) {
        state.splice(0, masterIndex)
        state.splice(0, state.length, ...newTracks, state[masterIndex])
      } else {
        state.splice(0, state.length, ...newTracks)
      }
    },
  },
})

function convertRppToTracks(project: RppProject): Track[] {
  return project.tracks.map((rppTrack, index) => ({
    id: `imported-track-${index}-${Date.now()}`,
    name: rppTrack.name,
    type: rppTrack.items.some((item) => item.type === 'midi') ? 'instrument' : 'audio',
    volume: rppTrack.volume,
    pan: rppTrack.pan,
    muted: rppTrack.muted,
    solo: rppTrack.solo,
    armed: false,
    color: rppTrack.color,
    clips: rppTrack.items.map((item, clipIndex) => convertRppItem(item, clipIndex)),
    plugins: rppTrack.plugins.map((plugin, pluginIndex) => convertRppPlugin(plugin, pluginIndex)),
    inputLevel: 0,
    outputLevel: 0.3,
    latency: rppTrack.plugins.reduce((sum, p) => sum + p.latency, 0),
    manualOffset: 0,
    pdcEnabled: true,
  }))
}

function convertRppItem(item: RppItem, index: number): Clip {
  return {
    id: `imported-clip-${index}-${Date.now()}`,
    trackId: '',
    name: item.name,
    startTime: item.startTime,
    endTime: item.endTime,
    type: item.type,
    waveformData:
      item.type === 'audio'
        ? Array.from({ length: 100 }, () => Math.random() * 0.7 + 0.2)
        : undefined,
    midiNotes:
      item.type === 'midi'
        ? item.notes.map((note, noteIdx) => ({
            id: `imported-note-${noteIdx}-${Date.now()}`,
            noteNumber: note.noteNumber,
            velocity: note.velocity,
            startTime: note.startTime,
            duration: note.endTime - note.startTime,
          }))
        : undefined,
  }
}

function convertRppPlugin(plugin: RppPlugin, index: number): any {
  const paramEntries = Object.entries(plugin.parameters)
  return {
    id: `imported-plugin-${index}-${Date.now()}`,
    pluginId: plugin.name.toLowerCase().replace(/\s+/g, '-'),
    name: plugin.name,
    bypassed: plugin.bypassed,
    parameters: paramEntries.slice(0, 8).map(([name, value], paramIdx) => ({
      id: paramIdx,
      name,
      value,
      normalized: Math.min(1, Math.max(0, value / 100)),
    })),
    position: plugin.position,
    latency: plugin.latency,
  }
}

export const {
  setVolume,
  setPan,
  toggleMute,
  toggleSolo,
  toggleArm,
  addTrack,
  removeTrack,
  addClip,
  updateLevels,
  setPluginLatency,
  recalculateTrackLatency,
  recalculateAllLatencies,
  setManualOffset,
  togglePDC,
  importRppProject,
} = tracksSlice.actions

export function getMaxLatency(state: Track[]): number {
  return Math.max(
    ...state
      .filter((t) => t.id !== 'master' && t.pdcEnabled)
      .map((t) => t.latency + t.manualOffset),
    0
  )
}

export function getTrackCompensation(
  track: Track,
  maxLatency: number
): number {
  if (!track.pdcEnabled || track.id === 'master') {
    return 0
  }
  return maxLatency - (track.latency + track.manualOffset)
}

export function samplesToMs(samples: number, sampleRate: number): number {
  return (samples / sampleRate) * 1000
}

export default tracksSlice.reducer
