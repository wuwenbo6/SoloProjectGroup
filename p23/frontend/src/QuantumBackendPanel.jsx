import { useState, useEffect } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'
import QASMExporter from './qasmExporter'
import './QuantumBackendPanel.css'

function QuantumBackendPanel({ gates, numQubits }) {
  const [backends, setBackends] = useState([])
  const [selectedBackend, setSelectedBackend] = useState('local')
  const [shots, setShots] = useState(1024)
  const [qasmPreview, setQasmPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [currentJob, setCurrentJob] = useState(null)
  const [jobResult, setJobResult] = useState(null)
  const [jobHistory, setJobHistory] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [pollingInterval, setPollingInterval] = useState(null)

  useEffect(() => {
    loadBackends()
    loadJobHistory()
    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [])

  useEffect(() => {
    const qasm = QASMExporter.generateQASM(gates, numQubits, 'my_circuit')
    setQasmPreview(qasm)
  }, [gates, numQubits])

  const loadBackends = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/backends')
      setBackends(response.data)
    } catch (e) {
      console.error('Failed to load backends:', e)
    }
  }

  const loadJobHistory = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/jobs')
      setJobHistory(response.data)
    } catch (e) {
      console.error('Failed to load jobs:', e)
    }
  }

  const handleDownloadQASM = (version = '2.0') => {
    const qasm = version === '2.0' 
      ? QASMExporter.generateQASM(gates, numQubits)
      : QASMExporter.generateQASM3(gates, numQubits)
    const filename = `circuit_${numQubits}q_${gates.length}g.qasm`
    QASMExporter.downloadQASM(qasm, filename)
  }

  const executeCircuit = async () => {
    if (gates.length === 0) {
      alert('请先添加量子门')
      return
    }

    setIsExecuting(true)
    setJobResult(null)

    try {
      const response = await axios.post('http://localhost:8000/api/execute', {
        num_qubits: numQubits,
        gates: gates,
        backend: selectedBackend,
        shots: shots
      })

      setCurrentJob(response.data)
      setJobHistory(prev => [response.data, ...prev.slice(0, 9)])

      if (response.data.status === 'running') {
        const interval = setInterval(async () => {
          try {
            const result = await axios.get(`http://localhost:8000/api/jobs/${response.data.job_id}`)
            if (result.data.status === 'completed' || result.data.status === 'error') {
              clearInterval(interval)
              setPollingInterval(null)
              setJobResult(result.data)
              setIsExecuting(false)
            }
          } catch (e) {
            clearInterval(interval)
            setPollingInterval(null)
            setIsExecuting(false)
          }
        }, 500)
        setPollingInterval(interval)
      } else {
        setJobResult(response.data)
        setIsExecuting(false)
      }
    } catch (e) {
      console.error('Execution failed:', e)
      setIsExecuting(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qasmPreview)
    alert('QASM已复制到剪贴板')
  }

  const getBackendTypeColor = (type) => {
    switch (type) {
      case 'local': return '#4caf50'
      case 'simulator': return '#2196f3'
      case 'cloud': return '#9c27b0'
      case 'hardware': return '#ff5722'
      default: return '#666'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#4caf50'
      case 'running': return '#ff9800'
      case 'completed': return '#4caf50'
      case 'error': return '#f44336'
      case 'requires_api_key': return '#ff9800'
      default: return '#999'
    }
  }

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60}m`
  }

  const getPlotData = () => {
    if (!jobResult?.counts || Object.keys(jobResult.counts).length === 0) {
      return []
    }
    
    const sortedKeys = Object.keys(jobResult.counts).sort()
    return [{
      x: sortedKeys,
      y: sortedKeys.map(k => jobResult.counts[k] / shots),
      type: 'bar',
      marker: { color: 'rgba(156, 39, 176, 0.8)' },
      name: 'Probability'
    }]
  }

  const selectedBackendInfo = backends.find(b => b.id === selectedBackend)
  const estimatedRuntime = selectedBackendInfo 
    ? QASMExporter.estimateRuntime(numQubits, gates.length, selectedBackendInfo.type)
    : 0

  return (
    <div className="backend-panel">
      <h2>⚡ 量子后端执行</h2>
      <p className="subtitle">导出QASM并在真实量子硬件或模拟器上执行</p>

      <div className="panel-grid">
        <div className="control-section">
          <h3>📋 QASM 导出</h3>
          
          <div className="qasm-preview">
            <div className="preview-header">
              <span>OpenQASM 2.0</span>
              <div className="preview-actions">
                <button onClick={copyToClipboard} className="small-btn">复制</button>
                <button onClick={() => handleDownloadQASM('2.0')} className="small-btn primary">下载</button>
              </div>
            </div>
            <pre className="qasm-code">{qasmPreview}</pre>
          </div>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-label">量子比特</span>
              <span className="stat-value">{numQubits}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">门数量</span>
              <span className="stat-value">{gates.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">线路深度</span>
              <span className="stat-value">{Math.max(1, gates.length)}</span>
            </div>
          </div>
        </div>

        <div className="control-section">
          <h3>🔧 执行配置</h3>

          <div className="form-group">
            <label>选择后端:</label>
            <select 
              value={selectedBackend}
              onChange={(e) => setSelectedBackend(e.target.value)}
              className="backend-select"
            >
              {backends.map(backend => (
                <option key={backend.id} value={backend.id}>
                  {backend.name} ({backend.qubits} qubits)
                </option>
              ))}
            </select>
          </div>

          {selectedBackendInfo && (
            <div className="backend-details" style={{ borderLeftColor: getBackendTypeColor(selectedBackendInfo.type) }}>
              <div className="detail-row">
                <span className="detail-label">类型:</span>
                <span className="detail-value">{selectedBackendInfo.type.toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">供应商:</span>
                <span className="detail-value">{selectedBackendInfo.provider}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">状态:</span>
                <span className="detail-value" style={{ color: getStatusColor(selectedBackendInfo.status) }}>
                  {selectedBackendInfo.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">预计时间:</span>
                <span className="detail-value">{formatTime(estimatedRuntime)}</span>
              </div>
            </div>
          )}

          <div className="form-group">
          <div className="shots-control">
            <label>执行次数 (Shots):</label>
            <input
              type="range"
              min="1"
              max="8192"
              value={shots}
              onChange={(e) => setShots(parseInt(e.target.value))}
            />
            <span className="shots-value">{shots}</span>
          </div>
        </div>

        <button
          onClick={executeCircuit}
          disabled={isExecuting || gates.length === 0}
          className={`execute-btn ${isExecuting ? 'executing' : ''}`}
        >
          {isExecuting ? '⏳ 执行中...' : '🚀 执行电路'}
        </button>
      </div>
    </div>

    {currentJob && (
      <div className="job-status-section">
        <h3>📊 执行结果</h3>
        
        <div className="job-info">
          <div className="job-header">
            <span className="job-id">Job: {currentJob.job_id.slice(0, 8)}...</span>
            <span className={`job-status status-${jobResult?.status || currentJob.status}`}>
              {jobResult?.status || currentJob.status}
            </span>
          </div>
          <div className="job-meta">
            <span>后端: {currentJob.backend}</span>
            <span>Shots: {currentJob.shots}</span>
            {jobResult?.execution_time && (
              <span>耗时: {jobResult.execution_time.toFixed(3)}s</span>
            )}
          </div>
        </div>

        {jobResult?.counts && Object.keys(jobResult.counts).length > 0 && (
          <div className="result-plot">
            <Plot
              data={getPlotData()}
              layout={{
                width: 500,
                height: 300,
                title: '测量结果分布',
                xaxis: { title: '量子态' },
                yaxis: { title: '概率' },
                margin: { t: 40, b: 80 }
              }}
            />
          </div>
        )}

        {jobResult?.error && (
          <div className="error-message">
            ❌ {jobResult.error}
          </div>
        )}
      </div>
    )}

    {jobHistory.length > 0 && (
      <div className="history-section">
        <h3>📜 执行历史</h3>
        <div className="history-list">
          {jobHistory.slice(0, 5).map((job, i) => (
            <div key={i} className="history-item">
              <span className="history-id">{job.job_id.slice(0, 12)}...</span>
              <span className="history-backend">{job.backend}</span>
              <span className={`history-status status-${job.status}`}>
                {job.status}
              </span>
              <span className="history-shots">{job.shots} shots</span>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="backend-list-section">
      <h3>🔌 可用后端</h3>
      <div className="backend-grid">
        {backends.map(backend => (
        <div 
          key={backend.id} 
          className={`backend-card ${backend.id === selectedBackend ? 'selected' : ''}`}
          onClick={() => setSelectedBackend(backend.id)}
        >
          <div className="card-header" style={{ backgroundColor: getBackendTypeColor(backend.type) }}>
            {backend.type.toUpperCase()}
          </div>
          <div className="card-body">
            <h4>{backend.name}</h4>
            <p>{backend.qubits} qubits • {backend.provider}</p>
          </div>
          <div className="card-status" style={{ color: getStatusColor(backend.status) }}>
            {backend.status}
          </div>
        </div>
      ))}
    </div>
  </div>
  )
}

export default QuantumBackendPanel
