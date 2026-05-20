import React, { useCallback, useRef, useEffect } from 'react'
import { Volume2, VolumeX, Headphones, Mic, Zap, Clock } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store'
import { setPlayhead } from '../store/transportSlice'
import {
  toggleMute,
  toggleSolo,
  toggleArm,
  setVolume,
  setPan,
  getMaxLatency,
  samplesToMs,
} from '../store/tracksSlice'
import { setSelectedTrack } from '../store/uiSlice'

interface TimelineProps {
  onSelectTrack?: (trackId: string) => void
}

const Timeline: React.FC<TimelineProps> = ({ onSelectTrack }) => {
  const dispatch = useAppDispatch()
  const tracks = useAppSelector((state) => state.tracks)
  const { playheadPosition, isPlaying } = useAppSelector((state) => state.transport)
  const { zoomLevel, selectedTrackId } = useAppSelector((state) => state.ui)
  const { bpm } = useAppSelector((state) => state.project)

  const timelineRef = useRef<HTMLDivElement>(null)
  const pixelsPerBeat = (zoomLevel / 100) * 50
  const beatsPerSecond = bpm / 60
  const pixelsPerSecond = pixelsPerBeat * beatsPerSecond

  const totalDuration = 60
  const totalWidth = totalDuration * pixelsPerSecond

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = x / pixelsPerSecond
      dispatch(setPlayhead(Math.max(0, Math.min(totalDuration, time))))
    },
    [dispatch, pixelsPerSecond]
  )

  const renderRuler = () => {
    const markers = []
    const beats = Math.ceil(totalDuration * beatsPerSecond)
    for (let i = 0; i <= beats; i++) {
      const isBar = i % 4 === 0
      const x = (i / beatsPerSecond) * pixelsPerSecond
      markers.push(
        <div
          key={i}
          className="absolute h-full"
          style={{
            left: x,
          }}
        >
          <div
            className={`absolute w-px ${isBar ? 'h-4 bg-gray-500' : 'h-2 bg-gray-700'}`}
          />
          {isBar && (
            <span className="absolute top-4 left-1 text-xs text-gray-500">
              {i / 4 + 1}
            </span>
          )}
        </div>
      )
    }
    return markers
  }

  const renderWaveform = (waveformData: number[], startTime: number, duration: number, color: string) => {
    const width = duration * pixelsPerSecond
    const barWidth = Math.max(2, width / waveformData.length)
    
    return (
      <div className="absolute inset-0 flex items-center">
        {waveformData.map((value, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              left: index * barWidth,
              width: barWidth - 1,
              height: `${Math.max(2, value * 100)}%`,
              backgroundColor: color,
              opacity: 0.6,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
        ))}
      </div>
    )
  }

  const maxLatency = getMaxLatency(tracks)
  const sampleRate = useAppSelector((state) => state.project.sampleRate)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-10 bg-daw-bg-light border-b border-daw-bg-lighter flex">
        <div className="w-48 flex-shrink-0 border-r border-daw-bg-lighter" />
        <div
          ref={timelineRef}
          className="flex-1 relative overflow-hidden cursor-crosshair"
          onClick={handleTimelineClick}
        >
          {renderRuler()}
          <div
            className="absolute top-0 h-full w-px bg-daw-warning z-20 pointer-events-none"
            style={{ left: playheadPosition * pixelsPerSecond }}
          >
            <div className="w-3 h-3 -ml-1.5 bg-daw-warning rounded-b" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-auto">
        <div className="w-48 flex-shrink-0 bg-daw-bg-light border-r border-daw-bg-lighter overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`h-20 border-b border-daw-bg-lighter p-2 cursor-pointer transition-colors ${
                selectedTrackId === track.id ? 'bg-daw-bg-lighter' : 'hover:bg-daw-bg-lighter/50'
              }`}
              onClick={() => {
                dispatch(setSelectedTrack(track.id))
                onSelectTrack?.(track.id)
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                <span className="text-sm font-medium truncate flex-1">{track.name}</span>
                {track.pdcEnabled && (
                  <Zap size={12} className="text-daw-accent" title="PDC Enabled" />
                )}
              </div>
              {(track.latency > 0 || track.manualOffset !== 0) && (
                <div className="flex items-center gap-1 text-[10px] text-yellow-500 mb-1">
                  <Clock size={10} />
                  <span>{samplesToMs(track.latency + track.manualOffset, sampleRate).toFixed(1)}ms</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch(toggleMute(track.id))
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    track.muted ? 'bg-daw-warning text-white' : 'hover:bg-daw-bg'
                  }`}
                  title="Mute"
                >
                  {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch(toggleSolo(track.id))
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    track.solo ? 'bg-yellow-500 text-daw-bg' : 'hover:bg-daw-bg'
                  }`}
                  title="Solo"
                >
                  <Headphones size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch(toggleArm(track.id))
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    track.armed ? 'bg-daw-warning text-white animate-pulse' : 'hover:bg-daw-bg'
                  }`}
                  title="Arm"
                >
                  <Mic size={12} />
                </button>
              </div>
              <div className="mt-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onChange={(e) =>
                    dispatch(setVolume({ trackId: track.id, volume: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          className="flex-1 relative overflow-auto"
          onClick={handleTimelineClick}
        >
          <div className="relative" style={{ width: totalWidth }}>
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-20 border-b border-daw-bg-lighter relative"
              >
                {track.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="absolute h-16 top-2 rounded border- overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                    style={{
                      left: clip.startTime * pixelsPerSecond,
                      width: (clip.endTime - clip.startTime) * pixelsPerSecond,
                      backgroundColor: `${track.color}20`,
                      borderColor: track.color,
                    }}
                  >
                    <div
                      className="h-6 px-2 flex items-center"
                      style={{ backgroundColor: track.color }}
                    >
                      <span className="text-xs text-daw-bg font-medium truncate">
                        {clip.name}
                      </span>
                    </div>
                    {clip.waveformData && (
                      <div className="h-10 relative">
                        {renderWaveform(
                          clip.waveformData,
                          clip.startTime,
                          clip.endTime - clip.startTime,
                          track.color
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <div
              className="absolute top-0 h-full w-px bg-daw-warning z-20 pointer-events-none"
              style={{ left: playheadPosition * pixelsPerSecond }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Timeline
