import React, { useEffect } from 'react'
import { Search, RefreshCw, Music, Guitar } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store'
import { scanPlugins } from '../store/pluginsSlice'

const PluginBrowser: React.FC = () => {
  const dispatch = useAppDispatch()
  const { available: plugins, scanning, scanned } = useAppSelector((state) => state.plugins)

  useEffect(() => {
    if (!scanned && !scanning) {
      dispatch(scanPlugins())
    }
  }, [dispatch, scanned, scanning])

  const instruments = plugins.filter((p) => p.category === 'instrument')
  const effects = plugins.filter((p) => p.category === 'effect')

  return (
    <div className="flex-1 flex flex-col bg-daw-bg overflow-hidden">
      <div className="h-10 bg-daw-bg-light border-b border-daw-bg-lighter flex items-center px-4 justify-between">
        <span className="font-display text-lg text-daw-accent">PLUGINS</span>
        <button
          onClick={() => dispatch(scanPlugins())}
          disabled={scanning}
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-daw-bg-lighter transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search plugins..."
            className="w-full bg-daw-bg-light border border-daw-bg-lighter rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-daw-accent transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Music size={14} />
            Instruments
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {instruments.map((plugin) => (
              <div
                key={plugin.id}
                className="bg-daw-bg-light rounded-lg p-3 cursor-pointer hover:bg-daw-bg-lighter transition-colors border border-transparent hover:border-daw-accent/30"
              >
                <div className="w-10 h-10 rounded-lg bg-daw-accent/20 flex items-center justify-center mb-2">
                  <Guitar size={20} className="text-daw-accent" />
                </div>
                <h4 className="text-sm font-medium truncate">{plugin.name}</h4>
                <p className="text-xs text-gray-500">{plugin.vendor}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Effects
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {effects.map((plugin) => (
              <div
                key={plugin.id}
                className="bg-daw-bg-light rounded-lg p-3 cursor-pointer hover:bg-daw-bg-lighter transition-colors border border-transparent hover:border-daw-accent/30"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-2">
                  <div className="w-5 h-5 bg-blue-500 rounded" />
                </div>
                <h4 className="text-sm font-medium truncate">{plugin.name}</h4>
                <p className="text-xs text-gray-500">{plugin.vendor}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PluginBrowser
