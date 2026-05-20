import React, { useCallback, useState } from 'react'
import { Play, Square, Circle, SkipBack, Pause, Music, ZoomIn, ZoomOut, Import } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store'
import { play, stop, pause, toggleRecord, setPlayhead } from '../store/transportSlice'
import { setBpm } from '../store/projectSlice'
import { setZoomLevel } from '../store/uiSlice'
import RppImport from './RppImport'

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`
}

const Toolbar: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isPlaying, isRecording, playheadPosition } = useAppSelector((state) => state.transport)
  const { bpm } = useAppSelector((state) => state.project)
  const { zoomLevel } = useAppSelector((state) => state.ui)
  const [showImport, setShowImport] = useState(false)

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      dispatch(pause())
    } else {
      dispatch(play())
    }
  }, [dispatch, isPlaying])

  const handleStop = useCallback(() => {
    dispatch(stop())
  }, [dispatch])

  const handleRecord = useCallback(() => {
    dispatch(toggleRecord())
  }, [dispatch])

  const handleSkipBack = useCallback(() => {
    dispatch(setPlayhead(0))
  }, [dispatch])

  const handleBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newBpm = parseFloat(e.target.value)
      if (!isNaN(newBpm) && newBpm > 0) {
        dispatch(setBpm(newBpm))
      }
    },
    [dispatch]
  )

  const handleZoomIn = useCallback(() => {
    dispatch(setZoomLevel(zoomLevel + 20))
  }, [dispatch, zoomLevel])

  const handleZoomOut = useCallback(() => {
    dispatch(setZoomLevel(zoomLevel - 20))
  }, [dispatch, zoomLevel])

  return (
    <div className="h-14 bg-daw-bg-light border-b border-daw-bg-lighter flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-daw-bg rounded-lg p-1">
          <button
            onClick={handleSkipBack}
            className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-daw-bg-lighter transition-colors"
            title="Skip to Start"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={handlePlay}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-daw-accent text-daw-bg shadow-lg shadow-daw-accent/30'
                : 'hover:bg-daw-bg-lighter'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={handleStop}
            className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-daw-bg-lighter transition-colors"
            title="Stop"
          >
            <Square size={18} />
          </button>
          <button
            onClick={handleRecord}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-daw-warning text-white animate-pulse shadow-lg shadow-daw-warning/30'
                : 'hover:bg-daw-bg-lighter'
            }`}
            title="Record"
          >
            <Circle size={18} fill={isRecording ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="h-8 w-px bg-daw-bg-lighter" />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Music size={16} className="text-daw-accent" />
          <span className="text-xs text-gray-400">BPM</span>
          <input
            type="number"
            value={bpm}
            onChange={handleBpmChange}
            className="w-16 bg-daw-bg border border-daw-bg-lighter rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-daw-accent transition-colors"
            min={20}
            max={300}
            step={1}
          />
        </div>
      </div>

      <div className="h-8 w-px bg-daw-bg-lighter" />

      <div className="flex items-center gap-2 bg-daw-bg rounded-lg px-4 py-2">
        <span className="text-2xl font-display text-daw-accent tracking-wider">
          {formatTime(playheadPosition)}
        </span>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setShowImport(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-daw-bg border border-daw-bg-lighter text-sm text-gray-300 hover:bg-daw-bg-lighter hover:text-white transition-colors"
        title="Import REAPER Project"
      >
        <Import size={14} />
        <span>Import RPP</span>
      </button>

      <div className="h-8 w-px bg-daw-bg-lighter" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Zoom</span>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-daw-bg-lighter transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <div className="w-20 h-1 bg-daw-bg rounded-full relative">
          <div
            className="absolute h-full bg-daw-accent rounded-full transition-all"
            style={{ width: `${((zoomLevel - 20) / 480) * 100}%` }}
          />
        </div>
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-daw-bg-lighter transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </div>

    {showImport && <RppImport onClose={() => setShowImport(false)} />}
  )
}

export default Toolbar
