import { useState, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import axios from 'axios'
import QuantumState from './quantumSimulator'
import SteaneCodePanel from './SteaneCodePanel'
import QuantumBackendPanel from './QuantumBackendPanel'
import './App.css'

const API_BASE = 'http://localhost:8000'
const MAX_UI_QUBITS = 12

function App() {
  const [activeTab, setActiveTab] = useState('simulator')
  const [numQubits, setNumQubits] = useState(3)
  const [quantumState, setQuantumState] = useState(null)
  const [probabilities, setProbabilities] = useState([])
  const [statevector, setStatevector] = useState([])
  const [gates, setGates] = useState([])
  const [measurement, setMeasurement] = useState(null)
  const [circuitName, setCircuitName] = useState('')
  const [savedCircuits, setSavedCircuits] = useState([])
  const [selectedQubit, setSelectedQubit] = useState(0)
  const [targetQubit, setTargetQubit] = useState(1)
  const [error, setError] = useState(null)
  const [probThreshold, setProbThreshold] = useState(0.001)
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  useEffect(() => {
    try {
      const qs = new QuantumState(numQubits)
      setQuantumState(qs)
      setGates([])
      setMeasurement(null)
      setError(null)
      updateProbabilities(qs)
      loadCircuits()
    } catch (e) {
      setError(`Failed to initialize quantum state: ${e.message}`)
      console.error(e)
    }
  }, [numQubits])

  const updateProbabilities = (qs) => {
    if (qs) {
      const probs = Array.from(qs.getProbabilities())
      const state = Array.from(qs.getStatevector())
      setProbabilities(probs)
      setStatevector(state)
    }
  }

  const applyGate = useCallback((gateType, qubit, target = null) => {
    if (!quantumState) return
    try {
      switch (gateType) {
        case 'H':
          quantumState.applyHadamard(qubit)
          break
        case 'X':
          quantumState.applyX(qubit)
          break
        case 'Y':
          quantumState.applyY(qubit)
          break
        case 'Z':
          quantumState.applyZ(qubit)
          break
        case 'CNOT':
          quantumState.applyCNOT(qubit, target)
          break
        default:
          return
      }
      setGates([...gates, { type: gateType, qubit, target }])
      updateProbabilities(quantumState)
    } catch (e) {
      console.error('Error applying gate:', e)
    }
  }, [quantumState, gates])

  const measure = useCallback(() => {
    if (!quantumState) return
    const result = Array.from(quantumState.measureAll())
    setMeasurement(result)
    updateProbabilities(quantumState)
  }, [quantumState])

  const reset = useCallback(() => {
    if (!quantumState) return
    quantumState.reset()
    setGates([])
    setMeasurement(null)
    updateProbabilities(quantumState)
  }, [quantumState])

  const saveCircuit = async () => {
    if (!circuitName) return
    try {
      await axios.post(`${API_BASE}/api/circuits`, {
        name: circuitName,
        num_qubits: numQubits,
        gates: gates
      })
      loadCircuits()
      setCircuitName('')
    } catch (e) {
      console.error('Error saving circuit:', e)
    }
  }

  const loadCircuits = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/circuits`)
      setSavedCircuits(response.data)
    } catch (e) {
      console.error('Error loading circuits:', e)
    }
  }

  const loadCircuit = async (id) => {
    try {
      const response = await axios.get(`${API_BASE}/api/circuits/${id}`)
      const circuit = response.data
      setNumQubits(circuit.num_qubits)
      setTimeout(() => {
        if (quantumState) {
          quantumState.reset()
          circuit.gates.forEach(gate => {
            if (gate.type === 'CNOT') {
              quantumState.applyCNOT(gate.qubit, gate.target)
            } else if (gate.type === 'H') {
              quantumState.applyHadamard(gate.qubit)
            } else if (gate.type === 'X') {
              quantumState.applyX(gate.qubit)
            } else if (gate.type === 'Y') {
              quantumState.applyY(gate.qubit)
            } else if (gate.type === 'Z') {
              quantumState.applyZ(gate.qubit)
            }
          })
          setGates(circuit.gates)
          updateProbabilities(quantumState)
        }
      }, 100)
    } catch (e) {
      console.error('Error loading circuit:', e)
    }
  }

  const deleteCircuit = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/circuits/${id}`)
      loadCircuits()
    } catch (e) {
      console.error('Error deleting circuit:', e)
    }
  }

  const formatBinary = (index, n) => {
    return index.toString(2).padStart(n, '0')
  }

  const significantStates = probabilities
    .map((prob, index) => ({ prob, index }))
    .filter(item => item.prob >= probThreshold)
    .sort((a, b) => b.prob - a.prob)

  const totalPages = Math.ceil(significantStates.length / itemsPerPage)
  const paginatedStates = significantStates.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  )

  const chartX = paginatedStates.map(s => formatBinary(s.index, numQubits))
  const chartY = paginatedStates.map(s => s.prob)

  return (
    <div className="app">
      <header className="header">
        <h1>⚛️ 量子电路模拟器</h1>
        <p>支持最多 {MAX_UI_QUBITS} 个量子比特 | 内存安全版本</p>
      </header>

      <div className="tab-container">
        <button 
          className={`tab-button ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          🔬 量子电路模拟器
        </button>
        <button 
          className={`tab-button ${activeTab === 'error-correction' ? 'active' : ''}`}
          onClick={() => setActiveTab('error-correction')}
        >
          🔷 Steane码纠错演示
        </button>
        <button 
          className={`tab-button ${activeTab === 'backend' ? 'active' : ''}`}
          onClick={() => setActiveTab('backend')}
        >
          ⚡ 量子后端执行
        </button>
      </div>
      
      {error && (
        <div className="error-banner">
          <strong>错误:</strong> {error}
        </div>
      )}

      {activeTab === 'simulator' ? (
      <div className="main-content">
        <div className="controls">
          <div className="control-section">
            <h3>量子比特设置</h3>
            <label>
              量子比特数:
              <input
                type="number"
                min="1"
                max={MAX_UI_QUBITS}
                value={numQubits}
                onChange={(e) => setNumQubits(Math.min(MAX_UI_QUBITS, Math.max(1, parseInt(e.target.value) || 1)))}
              />
            </label>
            <p className="memory-info">
              内存占用: {((1 << numQubits) * 16 / 1024).toFixed(1)} KB
            </p>
          </div>

          <div className="control-section">
            <h3>量子门操作</h3>
            <div className="gate-controls">
              <label>
                目标量子比特:
                <select value={selectedQubit} onChange={(e) => setSelectedQubit(parseInt(e.target.value))}>
                  {Array.from({ length: numQubits }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </label>
              <div className="gate-buttons">
                <button onClick={() => applyGate('H', selectedQubit)} className="gate-btn">H</button>
                <button onClick={() => applyGate('X', selectedQubit)} className="gate-btn">X</button>
                <button onClick={() => applyGate('Y', selectedQubit)} className="gate-btn">Y</button>
                <button onClick={() => applyGate('Z', selectedQubit)} className="gate-btn">Z</button>
              </div>
            </div>
            
            {numQubits > 1 && (
              <div className="cnot-controls">
                <h4>CNOT 门</h4>
                <label>
                  控制比特:
                  <select value={selectedQubit} onChange={(e) => setSelectedQubit(parseInt(e.target.value))}>
                    {Array.from({ length: numQubits }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </label>
                <label>
                  目标比特:
                  <select value={targetQubit} onChange={(e) => setTargetQubit(parseInt(e.target.value))}>
                    {Array.from({ length: numQubits }, (_, i) => i !== selectedQubit && (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => applyGate('CNOT', selectedQubit, targetQubit)} className="gate-btn cnot">
                  CNOT
                </button>
              </div>
            )}
          </div>

          <div className="control-section">
            <h3>测量操作</h3>
            <button onClick={measure} className="action-btn measure">测量所有量子比特</button>
            <button onClick={reset} className="action-btn reset">重置电路</button>
            
            {measurement && (
              <div className="measurement-result">
                <h4>测量结果:</h4>
                <div className="result-bits">
                  {measurement.slice().reverse().map((bit, i) => (
                    <span key={i} className={`bit bit-${bit}`}>{bit}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="visualization">
          <div className="circuit-display">
            <h3>量子电路</h3>
            <div className="circuit-lines">
              {Array.from({ length: numQubits }, (_, q) => (
                <div key={q} className="circuit-line">
                  <span className="qubit-label">q{q}</span>
                  <div className="qubit-line">
                    {gates.map((gate, i) => (
                      <div key={i} className={`gate-slot ${gate.qubit === q || gate.target === q ? 'active' : ''}`}>
                        {gate.qubit === q && <span className="gate-symbol">{gate.type}</span>}
                        {gate.target === q && <span className="gate-symbol target">⊕</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="probability-chart">
            <h3>概率幅分布</h3>
            <div className="chart-controls">
              <div className="control-group">
                <label>显示阈值: {(probThreshold * 100).toFixed(1)}%</label>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.0005"
                  value={probThreshold}
                  onChange={(e) => {
                    setProbThreshold(parseFloat(e.target.value))
                    setCurrentPage(0)
                  }}
                />
              </div>
              <div className="control-group">
                <label>每页显示:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value))
                    setCurrentPage(0)
                  }}
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
            
            <div className="chart-stats">
              <span>显示 {significantStates.length} 个显著态 / 共 {probabilities.length} 个基态</span>
              <span>内存节省: {((1 - significantStates.length / Math.max(1, probabilities.length)) * 100).toFixed(1)}%</span>
            </div>
            
            <Plot
              data={[
                {
                  x: chartX,
                  y: chartY,
                  type: 'bar',
                  marker: { color: 'rgba(100, 149, 237, 0.8)' }
                }
              ]}
              layout={{
                width: 600,
                height: 400,
                xaxis: { title: '量子态 (按概率排序)', tickangle: -45 },
                yaxis: { title: '概率', range: [0, Math.max(0.01, ...chartY) * 1.1] },
                margin: { t: 20, b: 100 }
              }}
            />
            
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  ◀ 上一页
                </button>
                <span className="page-info">
                  第 {currentPage + 1} / {totalPages} 页
                </span>
                <button
                  className="page-btn"
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  下一页 ▶
                </button>
              </div>
            )}
          </div>

          {statevector.length > 0 && (
            <div className="statevector-display">
              <h3>状态向量</h3>
              <div className="statevector-grid">
                {statevector.slice(0, Math.min(16, statevector.length)).map((val, i) => (
                  <div key={i} className="state-item">
                    <span className="state-label">|{formatBinary(i, numQubits)}⟩:</span>
                    <span className="state-value">
                      {val.real.toFixed(4)}{val.imag >= 0 ? '+' : ''}{val.imag.toFixed(4)}i
                    </span>
                  </div>
                ))}
                {statevector.length > 16 && <div className="state-more">... 共 {statevector.length} 个状态</div>}
              </div>
            </div>
          )}
        </div>

        <div className="circuit-storage">
          <h3>电路存储</h3>
          <div className="save-controls">
            <input
              type="text"
              placeholder="电路名称"
              value={circuitName}
              onChange={(e) => setCircuitName(e.target.value)}
            />
            <button onClick={saveCircuit} className="action-btn save">保存电路</button>
          </div>
          
          <div className="saved-circuits-list">
            <h4>已保存的电路:</h4>
            {savedCircuits.length === 0 ? (
              <p className="no-circuits">暂无保存的电路</p>
            ) : (
              <ul>
                {savedCircuits.map((circuit) => (
                  <li key={circuit._id} className="circuit-item">
                    <span className="circuit-name">{circuit.name}</span>
                    <span className="circuit-info">({circuit.num_qubits} qubits, {circuit.gates.length} gates)</span>
                    <button onClick={() => loadCircuit(circuit._id)} className="small-btn load">加载</button>
                    <button onClick={() => deleteCircuit(circuit._id)} className="small-btn delete">删除</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      ) : activeTab === 'error-correction' ? (
        <SteaneCodePanel />
      ) : (
        <QuantumBackendPanel gates={gates} numQubits={numQubits} />
      )}
    </div>
  )
}

export default App
