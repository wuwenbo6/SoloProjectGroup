import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import CodeEditor from './components/CodeEditor'
import MidiMappingManager from './components/MidiMappingManager'
import { MidiDevice, Script, Preset, LogEntry } from './types/electron'

const DEFAULT_SCRIPT = `// MIDI Message Handler
// Available variables:
// - message: { type: 'noteon' | 'noteoff' | 'cc' | 'pitch', ... }
// - sendMidi(message): function to send MIDI messages
// - log(...args): function to log messages
// - state: persistent object to store data

log('Received:', message.type);

// Example: Transpose notes by 2 semitones
if (message.type === 'noteon' || message.type === 'noteoff') {
  sendMidi({
    ...message,
    note: message.note + 2
  });
}

// Example: CC to Note conversion
if (message.type === 'cc' && message.controller === 1) {
  if (message.value > 64) {
    sendMidi({
      type: 'noteon',
      note: 60,
      velocity: 100,
      channel: message.channel
    });
  }
}`

type TabType = 'editor' | 'mappings'

function App() {
  const [midiInputs, setMidiInputs] = useState<MidiDevice[]>([])
  const [midiOutputs, setMidiOutputs] = useState<MidiDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<string>('')
  const [selectedOutput, setSelectedOutput] = useState<string>('')
  
  const [scripts, setScripts] = useState<Script[]>([])
  const [currentScript, setCurrentScript] = useState<Script | null>(null)
  const [scriptName, setScriptName] = useState('')
  const [scriptCode, setScriptCode] = useState(DEFAULT_SCRIPT)
  const [isScriptRunning, setIsScriptRunning] = useState(false)
  
  const [presets, setPresets] = useState<Preset[]>([])
  const [activePreset, setActivePreset] = useState<string>('')
  
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<TabType>('editor')

  useEffect(() => {
    loadMidiDevices()
    loadScripts()
    loadPresets()
    loadLogs()
    
    const cleanupMidi = window.api.onMidiMessage((msg) => {
      console.log('MIDI message:', msg)
    })
    
    const cleanupLog = window.api.onLog((log) => {
      setLogs(prev => [...prev.slice(-1000), log])
    })
    
    return () => {
      cleanupMidi()
      cleanupLog()
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(loadMidiDevices, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadMidiDevices = async () => {
    const { inputs, outputs } = await window.api.getMidiDevices()
    setMidiInputs(inputs)
    setMidiOutputs(outputs)
  }

  const loadScripts = async () => {
    const loaded = await window.api.getScripts()
    setScripts(loaded)
  }

  const loadPresets = async () => {
    const loaded = await window.api.getPresets()
    setPresets(loaded)
  }

  const loadLogs = async () => {
    const loaded = await window.api.getMidiLogs()
    setLogs(loaded)
  }

  const handleInputChange = async (deviceId: string) => {
    setSelectedInput(deviceId)
    if (deviceId) {
      await window.api.connectMidiInput(deviceId)
    } else {
      await window.api.disconnectMidiInput()
    }
  }

  const handleOutputChange = async (deviceId: string) => {
    setSelectedOutput(deviceId)
    if (deviceId) {
      await window.api.connectMidiOutput(deviceId)
    } else {
      await window.api.disconnectMidiOutput()
    }
  }

  const selectScript = (script: Script) => {
    setCurrentScript(script)
    setScriptName(script.name)
    setScriptCode(script.code)
  }

  const createNewScript = () => {
    setCurrentScript(null)
    setScriptName('Untitled Script')
    setScriptCode(DEFAULT_SCRIPT)
  }

  const saveCurrentScript = async () => {
    const script = await window.api.saveScript({
      id: currentScript?.id || uuidv4(),
      name: scriptName,
      code: scriptCode
    })
    setCurrentScript(script)
    await loadScripts()
  }

  const deleteScript = async (id: string) => {
    await window.api.deleteScript(id)
    if (currentScript?.id === id) {
      createNewScript()
    }
    await loadScripts()
  }

  const exportCurrentScript = async () => {
    if (!currentScript) return
    await window.api.exportScript(currentScript.id)
  }

  const importScript = async () => {
    try {
      await window.api.importScript(null)
      await loadScripts()
    } catch (e) {
      console.error('Import cancelled or failed')
    }
  }

  const toggleScript = async () => {
    if (isScriptRunning) {
      await window.api.stopScriptEngine()
      setIsScriptRunning(false)
    } else {
      try {
        await window.api.startScriptEngine(scriptCode)
        setIsScriptRunning(true)
      } catch (error) {
        console.error('Failed to start script:', error)
      }
    }
  }

  const savePreset = async () => {
    if (!currentScript) return
    
    const presetName = prompt('Enter preset name:', `Preset ${presets.length + 1}`)
    if (!presetName) return

    await window.api.savePreset({
      id: uuidv4(),
      name: presetName,
      scriptId: currentScript.id,
      inputDeviceId: selectedInput,
      outputDeviceId: selectedOutput
    })
    await loadPresets()
  }

  const applyPreset = async (preset: Preset) => {
    setActivePreset(preset.id)
    
    const script = scripts.find(s => s.id === preset.scriptId)
    if (script) {
      selectScript(script)
    }
    
    if (preset.inputDeviceId) {
      await handleInputChange(preset.inputDeviceId)
    }
    if (preset.outputDeviceId) {
      await handleOutputChange(preset.outputDeviceId)
    }
  }

  const deletePreset = async (id: string) => {
    await window.api.deletePreset(id)
    if (activePreset === id) {
      setActivePreset('')
    }
    await loadPresets()
  }

  const clearLogs = async () => {
    await window.api.clearMidiLogs()
    setLogs([])
  }

  const exportLogs = async (format: 'json' | 'csv') => {
    await window.api.exportLogs(format)
  }

  const filteredLogs = logFilter === 'all' 
    ? logs 
    : logs.filter(log => log.type === logFilter)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="device-section">
          <h3>MIDI Input</h3>
          <select
            className="device-select"
            value={selectedInput}
            onChange={(e) => handleInputChange(e.target.value)}
          >
            <option value="">Select device...</option>
            {midiInputs.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        <div className="device-section">
          <h3>MIDI Output</h3>
          <select
            className="device-select"
            value={selectedOutput}
            onChange={(e) => handleOutputChange(e.target.value)}
          >
            <option value="">Select device...</option>
            {midiOutputs.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        <div className="scripts-section">
          <h3>Scripts</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="btn btn-primary" onClick={createNewScript}>
              + New
            </button>
            <button className="btn btn-primary" onClick={importScript} title="Import Script">
              ↓
            </button>
            {currentScript && (
              <button className="btn btn-primary" onClick={exportCurrentScript} title="Export Script">
                ↑
              </button>
            )}
          </div>
          <div className="script-list">
            {scripts.map((script) => (
              <div
                key={script.id}
                className={`script-item ${currentScript?.id === script.id ? 'active' : ''}`}
                onClick={() => selectScript(script)}
              >
                <span>{script.name}</span>
                <button
                  className="script-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteScript(script.id)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="presets-section">
          <h3>Presets</h3>
          <button className="btn btn-primary" onClick={savePreset}>
            + Save Preset
          </button>
          <div className="preset-list">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`preset-item ${activePreset === preset.id ? 'active' : ''}`}
                onClick={() => applyPreset(preset)}
              >
                <span>{preset.name}</span>
                <button
                  className="script-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePreset(preset.id)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="tab-bar">
          <button 
            className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Script Editor
          </button>
          <button 
            className={`tab-btn ${activeTab === 'mappings' ? 'active' : ''}`}
            onClick={() => setActiveTab('mappings')}
          >
            MIDI Mappings
          </button>
        </div>

        {activeTab === 'editor' && (
          <div className="editor-section">
            <div className="editor-header">
              <input
                type="text"
                className="script-name-input"
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
                placeholder="Script name..."
              />
              <button className="btn btn-primary" onClick={saveCurrentScript}>
                Save
              </button>
              <button
                className={`btn ${isScriptRunning ? 'btn-danger' : 'btn-success'}`}
                onClick={toggleScript}
              >
                {isScriptRunning ? 'Stop' : 'Run'}
              </button>
            </div>
            <div className="editor-container">
              <CodeEditor value={scriptCode} onChange={setScriptCode} />
            </div>
          </div>
        )}

        {activeTab === 'mappings' && (
          <MidiMappingManager />
        )}

        <div className="log-section">
          <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Console Log ({filteredLogs.length})</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  background: '#1a1a2e',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '12px'
                }}
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="midi-in">MIDI In</option>
                <option value="midi-out">MIDI Out</option>
                <option value="script">Script</option>
                <option value="error">Error</option>
              </select>
              <button
                onClick={() => exportLogs('json')}
                style={{
                  padding: '4px 8px',
                  background: '#4a9eff',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Export JSON
              </button>
              <button
                onClick={() => exportLogs('csv')}
                style={{
                  padding: '4px 8px',
                  background: '#4a9eff',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Export CSV
              </button>
              <button
                onClick={clearLogs}
                style={{
                  padding: '4px 8px',
                  background: '#f44336',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="log-content">
            {filteredLogs.slice(-200).map((log) => (
              <div key={log.id} className="log-entry">
                <span className="log-time">{formatTime(log.timestamp)}</span>
                <span className={`log-type-${log.type}`}>
                  [{log.type.toUpperCase()}]
                </span>
                <span>{log.message}</span>
                {log.data && (
                  <span style={{ color: '#888', marginLeft: '10px' }}>
                    {JSON.stringify(log.data)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
