import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { PluginParameter, PluginInstance, PluginChain, Preset, ChainPreset } from '../types'

interface PluginChainState {
  chains: Record<string, PluginChain & { id: string }>
  presets: Preset[]
  chainPresets: ChainPreset[]
  currentChainId: string | null
  loading: boolean
  error: string | null
}

const initialState: PluginChainState = {
  chains: {},
  presets: [],
  chainPresets: [],
  currentChainId: null,
  loading: false,
  error: null,
}

export const loadPresets = createAsyncThunk(
  'pluginChain/loadPresets',
  async () => {
    if (window.presetAPI) {
      return window.presetAPI.getAll()
    }
    return []
  }
)

export const loadChainPresets = createAsyncThunk(
  'pluginChain/loadChainPresets',
  async () => {
    if (window.chainPresetAPI) {
      return window.chainPresetAPI.getAll()
    }
    return []
  }
)

export const savePreset = createAsyncThunk(
  'pluginChain/savePreset',
  async (preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (window.presetAPI) {
      return window.presetAPI.create(preset)
    }
    return null
  }
)

export const saveChainPreset = createAsyncThunk(
  'pluginChain/saveChainPreset',
  async (preset: Omit<ChainPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (window.chainPresetAPI) {
      return window.chainPresetAPI.create(preset)
    }
    return null
  }
)

export const deletePreset = createAsyncThunk(
  'pluginChain/deletePreset',
  async (id: string) => {
    if (window.presetAPI) {
      await window.presetAPI.delete(id)
    }
    return id
  }
)

export const deleteChainPreset = createAsyncThunk(
  'pluginChain/deleteChainPreset',
  async (id: string) => {
    if (window.chainPresetAPI) {
      await window.chainPresetAPI.delete(id)
    }
    return id
  }
)

export const loadTrackChain = createAsyncThunk(
  'pluginChain/loadTrackChain',
  async (trackId: string) => {
    if (window.pluginChainAPI) {
      return window.pluginChainAPI.getByTrackId(trackId)
    }
    return null
  }
)

export const saveTrackChain = createAsyncThunk(
  'pluginChain/saveTrackChain',
  async (chain: PluginChain) => {
    if (window.pluginChainAPI) {
      return window.pluginChainAPI.save(chain)
    }
    return null
  }
)

const pluginChainSlice = createSlice({
  name: 'pluginChain',
  initialState,
  reducers: {
    addPluginToChain: (
      state,
      action: PayloadAction<{ chainId: string; plugin: Omit<PluginInstance, 'position'> }>
    ) => {
      const chain = state.chains[action.payload.chainId]
      if (chain) {
        const position = chain.plugins.length
        chain.plugins.push({ ...action.payload.plugin, position })
      }
    },

    removePluginFromChain: (
      state,
      action: PayloadAction<{ chainId: string; pluginInstanceId: string }>
    ) => {
      const chain = state.chains[action.payload.chainId]
      if (chain) {
        chain.plugins = chain.plugins.filter(
          (p) => p.id !== action.payload.pluginInstanceId
        )
      }
    },

    reorderPluginInChain: (
      state,
      action: PayloadAction<{ chainId: string; pluginInstanceId: string; newPosition: number }>
    ) => {
      const chain = state.chains[action.payload.chainId]
      if (chain) {
        const plugin = chain.plugins.find(
          (p) => p.id === action.payload.pluginInstanceId
        )
        if (plugin) {
          plugin.position = action.payload.newPosition
          chain.plugins.sort((a, b) => a.position - b.position)
        }
      }
    },

    togglePluginBypass: (
      state,
      action: PayloadAction<{ chainId: string; pluginInstanceId: string }>
    ) => {
      const chain = state.chains[action.payload.chainId]
      if (chain) {
        const plugin = chain.plugins.find(
          (p) => p.id === action.payload.pluginInstanceId
        )
        if (plugin) {
          plugin.bypassed = !plugin.bypassed
        }
      }
    },

    updatePluginParameter: (
      state,
      action: PayloadAction<{
        chainId: string
        pluginInstanceId: string
        paramId: number
        value: number
      }>
    ) => {
      const chain = state.chains[action.payload.chainId]
      if (chain) {
        const plugin = chain.plugins.find(
          (p) => p.id === action.payload.pluginInstanceId
        )
        if (plugin) {
          const param = plugin.parameters.find(
            (p) => p.id === action.payload.paramId
          )
          if (param) {
            param.value = action.payload.value
            param.normalized = action.payload.value
          }
        }
      }
    },

    setCurrentChainId: (state, action: PayloadAction<string | null>) => {
      state.currentChainId = action.payload
    },

    createChain: (
      state,
      action: PayloadAction<{ trackId: string; name: string }>
    ) => {
      const chainId = `chain_${Date.now()}`
      state.chains[chainId] = {
        id: chainId,
        trackId: action.payload.trackId,
        name: action.payload.name,
        plugins: [],
      }
      state.currentChainId = chainId
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPresets.fulfilled, (state, action) => {
        state.presets = action.payload || []
        state.loading = false
      })
      .addCase(loadChainPresets.fulfilled, (state, action) => {
        state.chainPresets = action.payload || []
        state.loading = false
      })
      .addCase(savePreset.fulfilled, (state, action) => {
        if (action.payload) {
          state.presets.push(action.payload)
        }
      })
      .addCase(saveChainPreset.fulfilled, (state, action) => {
        if (action.payload) {
          state.chainPresets.push(action.payload)
        }
      })
      .addCase(deletePreset.fulfilled, (state, action) => {
        state.presets = state.presets.filter((p) => p.id !== action.payload)
      })
      .addCase(deleteChainPreset.fulfilled, (state, action) => {
        state.chainPresets = state.chainPresets.filter((p) => p.id !== action.payload)
      })
      .addCase(loadTrackChain.fulfilled, (state, action) => {
        if (action.payload) {
          state.chains[action.payload.id] = action.payload
        }
        state.loading = false
      })
      .addCase(saveTrackChain.fulfilled, (state, action) => {
        if (action.payload) {
          state.chains[action.payload.id] = action.payload
        }
      })
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.loading = true
        }
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false
          state.error = action.error.message || 'An error occurred'
        }
      )
  },
})

export const {
  addPluginToChain,
  removePluginFromChain,
  reorderPluginInChain,
  togglePluginBypass,
  updatePluginParameter,
  setCurrentChainId,
  createChain,
} = pluginChainSlice.actions

export default pluginChainSlice.reducer
