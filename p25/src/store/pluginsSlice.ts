import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Plugin } from '../types'

interface PluginsState {
  available: Plugin[]
  scanned: boolean
  scanning: boolean
}

const initialState: PluginsState = {
  available: [],
  scanned: false,
  scanning: false,
}

export const scanPlugins = createAsyncThunk(
  'plugins/scan',
  async () => {
    if (window.electronAPI?.scanPlugins) {
      const result = await window.electronAPI.scanPlugins()
      return result.plugins
    }
    return [
      { id: '1', name: 'Synth One', vendor: 'P25 Audio', category: 'instrument' },
      { id: '2', name: 'Reverb Pro', vendor: 'P25 Audio', category: 'effect' },
      { id: '3', name: 'EQ Master', vendor: 'P25 Audio', category: 'effect' },
      { id: '4', name: 'Compressor X', vendor: 'P25 Audio', category: 'effect' },
      { id: '5', name: 'Drum Machine', vendor: 'P25 Audio', category: 'instrument' },
    ]
  }
)

const pluginsSlice = createSlice({
  name: 'plugins',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(scanPlugins.pending, (state) => {
        state.scanning = true
      })
      .addCase(scanPlugins.fulfilled, (state, action: PayloadAction<Plugin[]>) => {
        state.available = action.payload
        state.scanned = true
        state.scanning = false
      })
      .addCase(scanPlugins.rejected, (state) => {
        state.scanning = false
      })
  },
})

export default pluginsSlice.reducer
