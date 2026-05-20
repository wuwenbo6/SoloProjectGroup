import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Project, RppProject } from '../types'

const initialState: Project = {
  id: 'project-1',
  name: 'Untitled Project',
  sampleRate: 44100,
  bpm: 120,
  timeSignature: [4, 4],
  duration: 60,
}

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setName: (state, action: PayloadAction<string>) => {
      state.name = action.payload
    },
    setBpm: (state, action: PayloadAction<number>) => {
      state.bpm = action.payload
    },
    setTimeSignature: (
      state,
      action: PayloadAction<[number, number]>
    ) => {
      state.timeSignature = action.payload
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload
    },
    importRppProject: (state, action: PayloadAction<RppProject>) => {
      state.name = action.payload.name
      state.bpm = action.payload.bpm
      state.sampleRate = action.payload.sampleRate
      state.timeSignature = action.payload.timeSignature
      state.duration = Math.max(state.duration, action.payload.duration)
    },
  },
})

export const {
  setName,
  setBpm,
  setTimeSignature,
  setDuration,
  importRppProject: importRppProjectSettings,
} = projectSlice.actions

export default projectSlice.reducer
