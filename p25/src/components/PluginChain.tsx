import React, { useState, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Trash2, Power, GripVertical, Settings, Save, Upload, Clock, Zap } from 'lucide-react'
import { RootState } from '../store'
import {
  addPluginToChain,
  removePluginFromChain,
  reorderPluginInChain,
  togglePluginBypass,
  updatePluginParameter,
  savePreset,
  saveTrackChain,
  saveChainPreset,
} from '../store/pluginChainSlice'
import { setPluginLatency, setManualOffset, togglePDC, getMaxLatency, getTrackCompensation, samplesToMs } from '../store/tracksSlice'
import type { PluginParameter } from '../types'

interface PluginSlotProps {
  chainId: string
  plugin: {
    id: string
    pluginId: string
    name: string
    bypassed: boolean
    parameters: PluginParameter[]
    position: number
    latency: number
  }
  onRemove: () => void
  onToggleBypass: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onLatencyChange: (latency: number) => void
}

const PluginSlot: React.FC<PluginSlotProps> = ({
  chainId,
  plugin,
  onRemove,
  onToggleBypass,
  onDragStart,
  onDragOver,
  onDrop,
  onLatencyChange,
}) => {
  const dispatch = useDispatch()
  const [showParams, setShowParams] = useState(false)
  const [showLatency, setShowLatency] = useState(false)

  return (
    <div
      className={`relative group rounded-lg border-2 transition-all ${
        plugin.bypassed
          ? 'border-gray-700 bg-gray-800/50 opacity-60'
          : 'border-daw-accent/50 bg-daw-bg-light'
      }`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center p-3 gap-3">
        <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-white">
          <GripVertical size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{plugin.name}</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Slot {plugin.position + 1}</span>
            {plugin.latency > 0 && (
              <span className="flex items-center gap-1 text-xs text-yellow-500">
                <Clock size={10} />
                {plugin.latency} samples
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleBypass}
            className={`p-1.5 rounded transition-colors ${
              plugin.bypassed
                ? 'bg-gray-600 text-gray-400'
                : 'bg-daw-accent/20 text-daw-accent hover:bg-daw-accent/30'
            }`}
            title={plugin.bypassed ? 'Enable' : 'Bypass'}
          >
            <Power size={14} />
          </button>

          <button
            onClick={() => setShowLatency(!showLatency)}
            className={`p-1.5 rounded transition-colors ${
              plugin.latency > 0
                ? 'bg-yellow-900/30 text-yellow-500 hover:bg-yellow-900/50'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Latency"
          >
            <Clock size={14} />
          </button>

          <button
            onClick={() => setShowParams(!showParams)}
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Parameters"
          >
            <Settings size={14} />
          </button>

          <button
            onClick={onRemove}
            className="p-1.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showLatency && (
        <div className="border-t border-gray-700 p-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-24">Plugin Latency</span>
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              value={plugin.latency}
              onChange={(e) => onLatencyChange(parseInt(e.target.value) || 0)}
              className="flex-1 bg-daw-bg border border-gray-700 rounded px-2 py-1 text-sm text-white"
            />
            <span className="text-xs text-gray-500 w-16">samples</span>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Set to match the reported latency of the actual plugin
          </p>
        </div>
      )}

      {showParams && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {plugin.parameters.map((param) => (
            <div key={param.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-20 truncate">
                {param.name}
              </span>
              <input
                type="range"
                min={param.min ?? 0}
                max={param.max ?? 1}
                step="0.01"
                value={param.normalized ?? param.value}
                onChange={(e) => {
                  dispatch(
                    updatePluginParameter({
                      chainId,
                      pluginInstanceId: plugin.id,
                      paramId: param.id,
                      value: parseFloat(e.target.value),
                    })
                  )
                }}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-12 text-right">
                {((param.normalized ?? param.value) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const PluginChain: React.FC = () => {
  const dispatch = useDispatch()
  const { chains, currentChainId, presets } = useSelector(
    (state: RootState) => state.pluginChain
  )
  const tracks = useSelector((state: RootState) => state.tracks)
  const availablePlugins = useSelector(
    (state: RootState) => state.plugins.available
  )
  const { sampleRate } = useSelector((state: RootState) => state.project)

  const currentChain = currentChainId ? chains[currentChainId] : null
  const currentTrack = currentChainId
    ? tracks.find((t) => t.id === currentChain.trackId)
    : null

  const [draggedPluginId, setDraggedPluginId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetCategory, setPresetCategory] = useState('')
  const [showPDC, setShowPDC] = useState(false)

  const { maxLatency, trackLatency, compensationMs, totalTrackLatency } = useMemo(() => {
    const maxLat = getMaxLatency(tracks)
    const trackLat = currentTrack?.latency || 0
    const compensation = currentTrack ? getTrackCompensation(currentTrack, maxLat) : 0
    const totalLat = (currentTrack?.latency || 0) + (currentTrack?.manualOffset || 0)

    return {
      maxLatency: maxLat,
      trackLatency: trackLat,
      compensationMs: samplesToMs(compensation, sampleRate),
      totalTrackLatency: samplesToMs(totalLat, sampleRate),
    }
  }, [tracks, currentTrack, sampleRate])

  const handleAddPlugin = useCallback(
    (plugin: { id: string; name: string }) => {
      if (!currentChainId) return

      const defaultParams: PluginParameter[] = [
        { id: 0, name: 'Mix', value: 0.5, normalized: 0.5, min: 0, max: 1 },
        { id: 1, name: 'Gain', value: 0.7, normalized: 0.7, min: 0, max: 1 },
      ]

      dispatch(
        addPluginToChain({
          chainId: currentChainId,
          plugin: {
            id: `plugin_${Date.now()}`,
            pluginId: plugin.id,
            name: plugin.name,
            bypassed: false,
            parameters: defaultParams,
            position: 0,
            latency: 0,
          },
        })
      )
    },
    [dispatch, currentChainId]
  )

  const handleRemovePlugin = useCallback(
    (pluginInstanceId: string) => {
      if (!currentChainId) return
      dispatch(removePluginFromChain({ chainId: currentChainId, pluginInstanceId }))
    },
    [dispatch, currentChainId]
  )

  const handleToggleBypass = useCallback(
    (pluginInstanceId: string) => {
      if (!currentChainId) return
      dispatch(togglePluginBypass({ chainId: currentChainId, pluginInstanceId }))
    },
    [dispatch, currentChainId]
  )

  const handleLatencyChange = useCallback(
    (pluginInstanceId: string, latency: number) => {
      if (!currentChainId) return
      dispatch(
        setPluginLatency({
          trackId: currentChain.trackId,
          pluginId: pluginInstanceId,
          latency,
        })
      )
    },
    [dispatch, currentChain, currentChainId]
  )

  const handleManualOffsetChange = useCallback(
    (offset: number) => {
      if (!currentChain) return
      dispatch(setManualOffset({ trackId: currentChain.trackId, offset }))
    },
    [dispatch, currentChain]
  )

  const handleTogglePDC = useCallback(() => {
    if (!currentChain) return
    dispatch(togglePDC(currentChain.trackId))
  }, [dispatch, currentChain])

  const handleDragStart = (pluginId: string) => {
    setDraggedPluginId(pluginId)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = (targetIndex: number) => {
    if (!draggedPluginId || !currentChainId) return

    const currentIndex = currentChain?.plugins.findIndex(
      (p) => p.id === draggedPluginId
    )

    if (currentIndex != null && currentIndex !== targetIndex) {
      dispatch(
        reorderPluginInChain({
          chainId: currentChainId,
          pluginInstanceId: draggedPluginId,
          newPosition: targetIndex,
        })
      )
    }

    setDraggedPluginId(null)
    setDragOverIndex(null)
  }

  const handleSavePreset = async () => {
    if (!currentChain || !presetName) return

    if (currentChain.plugins.length === 1) {
      const plugin = currentChain.plugins[0]
      await dispatch(
        savePreset({
          name: presetName,
          pluginId: plugin.pluginId,
          category: presetCategory || undefined,
          parameters: plugin.parameters,
        })
      )
    } else {
      await dispatch(
        saveChainPreset({
          name: presetName,
          category: presetCategory || undefined,
          plugins: currentChain.plugins.map((p) => ({
            pluginId: p.pluginId,
            name: p.name,
            parameters: p.parameters,
            position: p.position,
          })),
        })
      )
    }

    setShowSaveModal(false)
    setPresetName('')
    setPresetCategory('')
  }

  const handleImportFxb = async () => {
    if (window.fxbAPI) {
      const result = await window.fxbAPI.importPreset()
      if (result && currentChainId) {
        const plugin = {
          id: `fxb_${Date.now()}`,
          pluginId: 'fxb_import',
          name: result.name,
          bypassed: false,
          parameters: result.parameters,
        }
        dispatch(addPluginToChain({ chainId: currentChainId, plugin }))
      }
    }
  }

  const handleExportFxb = async () => {
    if (window.fxbAPI && currentChain?.plugins.length) {
      const plugin = currentChain.plugins[0]
      await window.fxbAPI.exportPreset(plugin.parameters, plugin.name)
    }
  }

  const handleSaveChain = async () => {
    if (currentChain) {
      await dispatch(saveTrackChain(currentChain))
    }
  }

  if (!currentChain) {
    return (
      <div className="flex-1 flex items-center justify-center bg-daw-bg">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Select a track to manage plugins</p>
          <p className="text-sm text-gray-600">
            Click on a track in the mixer or timeline
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-daw-bg p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display text-daw-accent">
            {currentChain.name}
          </h2>
          <p className="text-sm text-gray-500">
            {currentChain.plugins.length} plugin{currentChain.plugins.length !== 1 ? 's' : ''}
            in chain
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImportFxb}
            className="flex items-center gap-2 px-3 py-1.5 bg-daw-bg-light border border-daw-accent/30 text-daw-accent rounded text-sm hover:bg-daw-bg-lighter transition-colors"
          >
            <Upload size={14} />
            Import FXB
          </button>

          {currentChain.plugins.length === 1 && (
            <button
              onClick={handleExportFxb}
              className="flex items-center gap-2 px-3 py-1.5 bg-daw-bg-light border border-daw-accent/30 text-daw-accent rounded text-sm hover:bg-daw-bg-lighter transition-colors"
            >
              <Save size={14} />
              Export FXB
            </button>
          )}

          {currentChain.plugins.length > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-daw-accent text-daw-bg rounded text-sm font-medium hover:bg-cyan-400 transition-colors"
            >
              <Save size={14} />
              Save Preset
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 mb-4">
        {currentChain.plugins.length === 0 ? (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-8">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No plugins in chain</p>
              <p className="text-sm text-gray-600">
                Add a plugin from the list below
              </p>
            </div>
          </div>
        ) : (
          currentChain.plugins
            .sort((a, b) => a.position - b.position)
            .map((plugin, index) => (
              <div
                key={plugin.id}
                className={`transition-all ${
                  dragOverIndex === index && draggedPluginId !== plugin.id
                    ? 'border-t-2 border-daw-accent pt-2'
                    : ''
                }`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
              >
                <PluginSlot
                  chainId={currentChainId!}
                  plugin={plugin}
                  onRemove={() => handleRemovePlugin(plugin.id)}
                  onToggleBypass={() => handleToggleBypass(plugin.id)}
                  onDragStart={() => handleDragStart(plugin.id)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onLatencyChange={(latency) => handleLatencyChange(plugin.id, latency)}
                />
              </div>
            ))
        )}
      </div>

      <div className="border-t border-daw-bg-lighter pt-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">
            Plugin Delay Compensation
          </h3>
          <button
            onClick={() => setShowPDC(!showPDC)}
            className={`p-1.5 rounded transition-colors ${
              currentTrack?.pdcEnabled
                ? 'bg-daw-accent/20 text-daw-accent'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Zap size={14} />
          </button>
        </div>

        {showPDC && (
          <div className="space-y-4 bg-daw-bg-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">PDC Enabled</span>
              <button
                onClick={handleTogglePDC}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  currentTrack?.pdcEnabled
                    ? 'bg-daw-accent text-daw-bg'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {currentTrack?.pdcEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Track Latency</div>
                <div className="text-lg font-mono text-yellow-500">
                  {trackLatency} samples
                </div>
                <div className="text-xs text-gray-500">
                  {totalTrackLatency.toFixed(2)} ms
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Compensation Delay</div>
                <div className="text-lg font-mono text-daw-accent">
                  {maxLatency - trackLatency - (currentTrack?.manualOffset || 0)} samples
                </div>
                <div className="text-xs text-gray-500">
                  {compensationMs.toFixed(2)} ms
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Manual Offset</span>
                <span className="text-xs text-gray-500">
                  {currentTrack?.manualOffset || 0} samples
                </span>
              </div>
              <input
                type="range"
                min="-500"
                max="500"
                step="1"
                value={currentTrack?.manualOffset || 0}
                onChange={(e) => handleManualOffsetChange(parseInt(e.target.value) || 0)}
                className="w-full"
              />
            </div>

            <div className="p-2 bg-daw-bg rounded border border-daw-bg-lighter">
              <div className="text-xs text-gray-500 mb-2">Max Latency in Session: {maxLatency} samples</div>
              <div className="h-2 bg-gray-700 rounded overflow-hidden relative">
                <div
                  className="h-full bg-yellow-500 absolute left-0 top-0"
                  style={{ width: `${Math.min(100, (trackLatency / Math.max(1, maxLatency)) * 100)}%` }}
                />
                <div
                  className="h-full bg-daw-accent absolute top-0"
                  style={{
                    left: `${(trackLatency / Math.max(1, maxLatency)) * 100}%`,
                    width: `${Math.min(100 - (trackLatency / Math.max(1, maxLatency)) * 100, ((maxLatency - trackLatency - (currentTrack?.manualOffset || 0)) / Math.max(1, maxLatency)) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-600">
                <span>0</span>
                <span>Actual</span>
                <span>Compensated</span>
                <span>Max</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-daw-bg-lighter pt-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Add Plugin
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {availablePlugins.map((plugin) => (
            <button
              key={plugin.id}
              onClick={() => handleAddPlugin(plugin)}
              className="p-3 bg-daw-bg-light border border-daw-bg-lighter rounded-lg text-left hover:border-daw-accent/30 transition-all hover:bg-daw-bg-lighter"
            >
              <p className="text-sm font-medium truncate">{plugin.name}</p>
              <p className="text-xs text-gray-500">{plugin.category}</p>
            </button>
          ))}
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-daw-bg-light border border-daw-bg-lighter rounded-xl p-6 w-96">
            <h3 className="text-lg font-medium text-white mb-4">
              Save {currentChain.plugins.length === 1 ? 'Plugin' : 'Chain'} Preset
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name"
                  className="w-full bg-daw-bg border border-daw-bg-lighter rounded px-3 py-2 text-sm focus:outline-none focus:border-daw-accent"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={presetCategory}
                  onChange={(e) => setPresetCategory(e.target.value)}
                  placeholder="e.g., Vocals, Drums"
                  className="w-full bg-daw-bg border border-daw-bg-lighter rounded px-3 py-2 text-sm focus:outline-none focus:border-daw-accent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!presetName}
                className="px-4 py-2 bg-daw-accent text-daw-bg rounded font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PluginChain
