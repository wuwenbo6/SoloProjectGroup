import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UiState {
  zoomLevel: number
  scrollPosition: number
  selectedTrackId?: string
  selectedClipId?: string
  activePanel: 'timeline' | 'mixer' | 'plugins' | 'midi'
}

const initialState: UiState = {
  zoomLevel: 100,
  scrollPosition: 0,
  selectedTrackId: undefined,
  selectedClipId: undefined,
  activePanel: 'timeline',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.zoomLevel = Math.max(20, Math.min(500, action.payload))
    },
    setScrollPosition: (state, action: PayloadAction<number>) => {
      state.scrollPosition = Math.max(0, action.payload)
    },
    setSelectedTrack: (state, action: PayloadAction<string | undefined>) => {
      state.selectedTrackId = action.payload
    },
    setSelectedClip: (state, action: PayloadAction<string | undefined>) => {
      state.selectedClipId = action.payload
    },
    setActivePanel: (
      state,
      action: PayloadAction<'timeline' | 'mixer' | 'plugins' | 'midi'>
    ) => {
      state.activePanel = action.payload
    },
  },
})

export const {
  setZoomLevel,
  setScrollPosition,
  setSelectedTrack,
  setSelectedClip,
  setActivePanel,
} = uiSlice.actions

export default uiSlice.reducer
