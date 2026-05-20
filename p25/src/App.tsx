import React, { useEffect, useState } from 'react'
import { Timeline, Mixer2, Plug, Music, Settings2 } from 'lucide-react'
import { useAppDispatch, useAppSelector } from './store'
import { incrementPlayhead } from './store/transportSlice'
import { updateLevels } from './store/tracksSlice'
import { createChain, setCurrentChainId } from './store/pluginChainSlice'
import Toolbar from './components/Toolbar'
import Timeline from './components/Timeline'
import Mixer from './components/Mixer'
import PluginBrowser from './components/PluginBrowser'
import MidiEditor from './components/MidiEditor'
import PluginChain from './components/PluginChain'
import PerformanceMonitor from './components/PerformanceMonitor'

type Panel = 'timeline' | 'mixer' | 'plugins' | 'midi' | 'chain'

const App: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isPlaying } = useAppSelector((state) => state.transport)
  const [activePanel, setActivePanel] = useState<Panel>('timeline')
  const tracks = useAppSelector((state) => state.tracks)

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      dispatch(incrementPlayhead(0.05))
      dispatch(updateLevels())
    }, 50)

    return () => clearInterval(interval)
  }, [dispatch, isPlaying])

  const panels: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: 'timeline', label: 'ARRANGE', icon: <Timeline size={14} /> },
    { id: 'mixer', label: 'MIXER', icon: <Mixer2 size={14} /> },
    { id: 'chain', label: 'PLUGIN CHAIN', icon: <Settings2 size={14} /> },
    { id: 'plugins', label: 'PLUGINS', icon: <Plug size={14} /> },
    { id: 'midi', label: 'MIDI', icon: <Music size={14} /> },
  ]

  const handleSelectTrack = (trackId: string) => {
    dispatch(setCurrentChainId(trackId))
    dispatch(createChain({ trackId, name: tracks.find(t => t.id === trackId)?.name || 'Track' }))
    setActivePanel('chain')
  }

  const renderPanel = () => {
    switch (activePanel) {
      case 'timeline':
        return <Timeline onSelectTrack={handleSelectTrack} />
      case 'mixer':
        return <Mixer onSelectTrack={handleSelectTrack} />
      case 'chain':
        return <PluginChain />
      case 'plugins':
        return <PluginBrowser />
      case 'midi':
        return <MidiEditor />
      default:
        return <Timeline onSelectTrack={handleSelectTrack} />
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-daw-bg text-gray-200 font-mono">
      <Toolbar />

      <div className="flex">
        <div className="flex bg-daw-bg-light border-b border-r border-daw-bg-lighter">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanel(panel.id)}
              className={`px-4 py-2 flex items-center gap-2 text-xs font-medium transition-colors ${
                activePanel === panel.id
                  ? 'bg-daw-accent text-daw-bg'
                  : 'hover:bg-daw-bg-lighter text-gray-400'
              }`}
            >
              {panel.icon}
              {panel.label}
            </button>
          ))}
        </div>
        <div className="flex-1 bg-daw-bg-light border-b border-daw-bg-lighter h-9" />
      </div>

      <div className="flex-1 flex overflow-hidden">{renderPanel()}</div>

      <PerformanceMonitor />

      <div className="h-6 bg-daw-bg-light border-t border-daw-bg-lighter flex items-center px-4 text-xs text-gray-500">
        <span>P25 DAW v0.1.0</span>
        <div className="flex-1" />
        <span>44.1 kHz / 24bit</span>
        <div className="w-px h-4 bg-daw-bg-lighter mx-3" />
        <span>Buffer: 128 samples</span>
      </div>
    </div>
  )
}

export default App
