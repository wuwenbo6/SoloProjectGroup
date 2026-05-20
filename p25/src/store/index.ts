import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux'
import projectReducer from './projectSlice'
import transportReducer from './transportSlice'
import tracksReducer from './tracksSlice'
import pluginsReducer from './pluginsSlice'
import pluginChainReducer from './pluginChainSlice'
import uiReducer from './uiSlice'

export const store = configureStore({
  reducer: {
    project: projectReducer,
    transport: transportReducer,
    tracks: tracksReducer,
    plugins: pluginsReducer,
    pluginChain: pluginChainReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
