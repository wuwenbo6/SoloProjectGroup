import React, { useCallback, useMemo } from 'react'
import { Volume2, VolumeX, Headphones, Mic, Zap } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store'
import {
  setVolume,
  setPan,
  toggleMute,
  toggleSolo,
  toggleArm,
  getMaxLatency,
  getTrackCompensation,
  samplesToMs,
} from '../store/tracksSlice'

interface MixerProps {
  onSelectTrack?: (trackId: string) => void
}

const VUMeter: React.FC<{ level: number }> = ({ level }) => {
  const height = level * 100
  const getColor = () => {
    if (level < 0.7) return 'bg-daw-accent'
    if (level < 0.9) return 'bg-yellow-500'
    return 'bg-daw-warning'
  }

  return (
    <div className="w-4 h-32 bg-daw-bg rounded relative overflow-hidden">
      <div
        className={`absolute bottom-0 w-full ${getColor()} transition-all duration-75`}
        style={{ height: `${height}%` }}
      />
      <div className="absolute inset-0 flex flex-col justify-between py-1">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="w-full h-px bg-daw-bg-lighter/50" />
        ))}
      </div>
    </div>
  )
}

const PanKnob: React.FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange,
}) => {
  const rotation = value * 150

  return (
    <div className="relative w-10 h-10">
      <div
        className="w-10 h-10 rounded-full bg-daw-bg border-2 border-daw-bg-lighter relative cursor-pointer hover:border-daw-accent transition-colors"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-daw-accent rounded-full" />
      </div>
      <input
        type="range"
        min="-1"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  )
}

const Mixer: React.FC<MixerProps> = ({ onSelectTrack }) => {
  const dispatch = useAppDispatch()
  const tracks = useAppSelector((state) => state.tracks)

  const handleVolumeChange = useCallback(
    (trackId: string, volume: number) => {
      dispatch(setVolume({ trackId, volume }))
    },
    [dispatch]
  )

  const handlePanChange = useCallback(
    (trackId: string, pan: number) => {
      dispatch(setPan({ trackId, pan }))
    },
    [dispatch]
  )

  const audioTracks = tracks.filter((t) => t.type !== 'master')
  const masterTrack = tracks.find((t) => t.type === 'master')
  const maxLatency = getMaxLatency(tracks)
  const sampleRate = useAppSelector((state) => state.project.sampleRate)

  const getTrackLatencyInfo = useCallback(
    (track: any) => {
      const compensation = getTrackCompensation(track, maxLatency)
      const totalLatency = track.latency + track.manualOffset
      return {
        hasLatency: totalLatency > 0,
        latencyMs: samplesToMs(totalLatency, sampleRate),
        compensationMs: samplesToMs(compensation, sampleRate),
        pdcEnabled: track.pdcEnabled,
      }
    },
    [maxLatency, sampleRate]
  )

  return (
    <div className="flex-1 flex flex-col bg-daw-bg overflow-hidden">
      <div className="h-10 bg-daw-bg-light border-b border-daw-bg-lighter flex items-center px-4">
        <span className="font-display text-lg text-daw-accent">MIXER</span>
      </div>

      <div className="flex-1 flex overflow-x-auto">
        {audioTracks.map((track) => (
          <div
            key={track.id}
            className="w-24 flex-shrink-0 border-r border-daw-bg-lighter flex flex-col items-center p-3 cursor-pointer hover:bg-daw-bg-lighter/30 transition-colors"
            onClick={() => onSelectTrack?.(track.id)}
          >
            <div
              className="w-full h-8 rounded flex items-center justify-center mb-3"
              style={{ backgroundColor: `${track.color}30`, color: track.color }}
            >
              <span className="text-xs font-medium truncate px-2">{track.name}</span>
            </div>

            {(() => {
              const latencyInfo = getTrackLatencyInfo(track)
              if (!latencyInfo.hasLatency && !latencyInfo.pdcEnabled) return null

              return (
                <div className="w-full mb-3 p-1 bg-daw-bg rounded border border-daw-bg-lighter">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1">
                      <Zap size={10} className={latencyInfo.pdcEnabled ? 'text-daw-accent' : 'text-gray-500'} />
                      {latencyInfo.pdcEnabled ? 'PDC' : ''}
                    </span>
                    {latencyInfo.hasLatency && (
                      <span className="text-yellow-500">
                        {latencyInfo.latencyMs.toFixed(1)}ms
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            <div className="flex gap-1 mb-3">
              <button
                onClick={() => dispatch(toggleMute(track.id))}
                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                  track.muted ? 'bg-daw-warning text-white' : 'bg-daw-bg-lighter hover:bg-daw-bg-lighter/80'
                }`}
                title="Mute"
              >
                {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button
                onClick={() => dispatch(toggleSolo(track.id))}
                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                  track.solo ? 'bg-yellow-500 text-daw-bg' : 'bg-daw-bg-lighter hover:bg-daw-bg-lighter/80'
                }`}
                title="Solo"
              >
                <Headphones size={12} />
              </button>
              <button
                onClick={() => dispatch(toggleArm(track.id))}
                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                  track.armed ? 'bg-daw-warning text-white animate-pulse' : 'bg-daw-bg-lighter hover:bg-daw-bg-lighter/80'
                }`}
                title="Arm"
              >
                <Mic size={12} />
              </button>
            </div>

            <div className="mb-3">
              <PanKnob value={track.pan} onChange={(v) => handlePanChange(track.id, v)} />
              <div className="text-center text-xs text-gray-500 mt-1">
                {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-end mb-3">
              <div className="flex gap-1 mb-2">
                <VUMeter level={track.outputLevel} />
                <VUMeter level={track.outputLevel * 0.9} />
              </div>
              <div className="w-full">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                  className="w-24 h-1 -rotate-90 origin-center"
                  style={{ transform: 'rotate(-90deg) translateX(-50%) translateY(-12px)' }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {Math.round(track.volume * 100)}%
              </div>
            </div>
          </div>
        ))}

        {masterTrack && (
          <div className="w-32 flex-shrink-0 border-l-2 border-daw-accent flex flex-col items-center p-3 bg-daw-bg-light/50">
            <div className="w-full h-8 rounded bg-daw-accent flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-daw-bg">MASTER</span>
            </div>

            <div className="h-16" />

            <div className="flex-1 flex flex-col items-center justify-end mb-3">
              <div className="flex gap-2 mb-2">
                <VUMeter level={masterTrack.outputLevel} />
                <VUMeter level={masterTrack.outputLevel * 0.95} />
              </div>
              <div className="w-full">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterTrack.volume}
                  onChange={(e) => handleVolumeChange(masterTrack.id, parseFloat(e.target.value))}
                  className="w-28 h-1 -rotate-90 origin-center"
                  style={{ transform: 'rotate(-90deg) translateX(-50%) translateY(-14px)' }}
                />
              </div>
              <div className="text-sm font-medium text-daw-accent mt-2">
                {Math.round(masterTrack.volume * 100)}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Mixer
