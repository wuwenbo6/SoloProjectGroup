import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { TransportState } from '../types'

const initialState: TransportState = {
  isPlaying: false,
  isRecording: false,
  playheadPosition: 0,
  loopStart: 0,
  loopEnd: 8,
  isLooping: false,
}

const transportSlice = createSlice({
  name: 'transport',
  initialState,
  reducers: {
    play: (state) => {
      state.isPlaying = true
    },
    stop: (state) => {
      state.isPlaying = false
      state.isRecording = false
      state.playheadPosition = 0
    },
    pause: (state) => {
      state.isPlaying = false
    },
    toggleRecord: (state) => {
      state.isRecording = !state.isRecording
      if (state.isRecording) {
        state.isPlaying = true
      }
    },
    setPlayhead: (state, action: PayloadAction<number>) => {
      state.playheadPosition = action.payload
    },
    incrementPlayhead: (state, action: PayloadAction<number>) => {
      if (state.isPlaying) {
        state.playheadPosition += action.payload
      }
    },
    toggleLoop: (state) => {
      state.isLooping = !state.isLooping
    },
    setLoopPoints: (
      state,
      action: PayloadAction<{ start: number; end: number }>
    ) => {
      state.loopStart = action.payload.start
      state.loopEnd = action.payload.end
    },
  },
})

export const {
  play,
  stop,
  pause,
  toggleRecord,
  setPlayhead,
  incrementPlayhead,
  toggleLoop,
  setLoopPoints,
} = transportSlice.actions

export default transportSlice.reducer
