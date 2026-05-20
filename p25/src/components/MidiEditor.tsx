import React, { useMemo } from 'react'
import { useAppSelector } from '../store'

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const MidiEditor: React.FC = () => {
  const tracks = useAppSelector((state) => state.tracks)
  const { bpm } = useAppSelector((state) => state.project)
  const { zoomLevel } = useAppSelector((state) => state.ui)

  const instrumentTrack = tracks.find((t) => t.type === 'instrument')
  const midiClip = instrumentTrack?.clips.find((c) => c.type === 'midi')

  const pixelsPerBeat = (zoomLevel / 100) * 30
  const beatsPerSecond = bpm / 60
  const pixelsPerSecond = pixelsPerBeat * beatsPerSecond

  const pianoKeys = useMemo(() => {
    const keys = []
    for (let octave = 1; octave >= 0; octave--) {
      for (let i = 11; i >= 0; i--) {
        const noteNumber = octave * 12 + i
        const isBlack = [1, 3, 6, 8, 10].includes(i)
        keys.push({ noteNumber, name: `${noteNames[i]}${octave}`, isBlack })
      }
    }
    return keys
  }, [])

  return (
    <div className="flex-1 flex flex-col bg-daw-bg overflow-hidden">
      <div className="h-10 bg-daw-bg-light border-b border-daw-bg-lighter flex items-center px-4">
        <span className="font-display text-lg text-daw-accent">PIANO ROLL</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-16 flex-shrink-0 bg-daw-bg-light border-r border-daw-bg-lighter overflow-y-auto">
          {pianoKeys.map((key) => (
            <div
              key={key.noteNumber}
              className={`h-6 flex items-center justify-end pr-2 text-xs ${
                key.isBlack ? 'bg-gray-800 text-gray-400' : 'bg-daw-bg text-gray-300'
              } border-b border-daw-bg-lighter`}
            >
              {key.name}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto relative">
          <div style={{ width: 60 * pixelsPerSecond }}>
            {pianoKeys.map((key, rowIndex) => (
              <div
                key={key.noteNumber}
                className={`h-6 border-b border-daw-bg-lighter relative ${
                  key.isBlack ? 'bg-gray-800/30' : ''
                }`}
              >
                {Array.from({ length: 60 }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="absolute top-0 h-full border-r border-daw-bg-lighter/30"
                    style={{ left: colIndex * pixelsPerSecond }}
                  />
                ))}
              </div>
            ))}

            {midiClip?.midiNotes?.map((note, index) => {
              const keyIndex = pianoKeys.findIndex((k) => k.noteNumber === note.noteNumber)
              if (keyIndex === -1) return null
              return (
                <div
                  key={index}
                  className="absolute h-5 rounded bg-daw-accent/80 border border-daw-accent flex items-center px-1"
                  style={{
                    top: keyIndex * 24 + 2,
                    left: note.startTime * pixelsPerSecond,
                    width: note.duration * pixelsPerSecond * 2,
                  }}
                >
                  <div
                    className="w-1 h-3 rounded-full"
                    style={{ backgroundColor: `hsl(${note.velocity}, 80%, 60%)` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MidiEditor
