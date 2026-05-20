import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import SteaneCode from './steaneCode'
import './SteaneCodePanel.css'

function SteaneCodePanel() {
  const [steaneCode] = useState(() => new SteaneCode())
  const [noiseProbability, setNoiseProbability] = useState(0.5)
  const [noiseQubit, setNoiseQubit] = useState(3)
  const [syndromes, setSyndromes] = useState({ x: [0, 0, 0], z: [0, 0, 0] })
  const [detectedErrors, setDetectedErrors] = useState({ x: -1, z: -1 })
  const [logicalState, setLogicalState] = useState({ zero: 1, one: 0 })
  const [step, setStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    updateLogicalState()
  }, [])

  const updateLogicalState = () => {
    const state = steaneCode.decodeLogicalState()
    setLogicalState(state)
  }

  const encode = (logicalValue) => {
    if (logicalValue === 0) {
      steaneCode.encodeLogicalZero()
    } else {
      steaneCode.encodeLogicalOne()
    }
    setStep(1)
    setDetectedErrors({ x: -1, z: -1 })
    updateLogicalState()
  }

  const applyNoise = (noiseType) => {
    if (noiseType === 'bitflip') {
      steaneCode.applyBitFlipNoise(noiseQubit, noiseProbability)
    } else {
      steaneCode.applyPhaseFlipNoise(noiseQubit, noiseProbability)
    }
    setStep(2)
    updateLogicalState()
  }

  const measureStabilizers = () => {
    const result = steaneCode.measureStabilizers()
    setSyndromes({ x: result.xSyndromes, z: result.zSyndromes })
    setStep(3)
  }

  const decode = () => {
    const errors = steaneCode.decodeError(syndromes.x, syndromes.z)
    setDetectedErrors(errors)
    setStep(4)
  }

  const correct = () => {
    steaneCode.applyCorrection(detectedErrors.xErrorQubit, detectedErrors.zErrorQubit)
    setStep(5)
    updateLogicalState()
  }

  const reset = () => {
    steaneCode.reset()
    setStep(0)
    setSyndromes({ x: [0, 0, 0], z: [0, 0, 0] })
    setDetectedErrors({ x: -1, z: -1 })
    updateLogicalState()
  }

  const runFullDemo = async () => {
    setIsAnimating(true)
    
    reset()
    await new Promise(r => setTimeout(r, 500))
    
    encode(0)
    await new Promise(r => setTimeout(r, 800))
    
    applyNoise('bitflip')
    await new Promise(r => setTimeout(r, 800))
    
    measureStabilizers()
    await new Promise(r => setTimeout(r, 800))
    
    decode()
    await new Promise(r => setTimeout(r, 800))
    
    correct()
    setIsAnimating(false)
  }

  const errorLocations = steaneCode.errorLocations
  const history = steaneCode.getNoiseHistory()

  const getQubitStatus = (qubit) => {
    if (errorLocations.x.includes(qubit) && errorLocations.z.includes(qubit)) {
      return 'both'
    } else if (errorLocations.x.includes(qubit)) {
      return 'x'
    } else if (errorLocations.z.includes(qubit)) {
      return 'z'
    }
    return 'normal'
  }

  const steps = [
    { name: '初始化', icon: '🔄', desc: '7量子比特初始化为|0⟩' },
    { name: '编码', icon: '🔐', desc: '编码为逻辑|0⟩_L' },
    { name: '加噪声', icon: '⚡', desc: '注入比特/相位翻转错误' },
    { name: '稳定子测量', icon: '📊', desc: '测量6个稳定子生成元' },
    { name: '解码', icon: '🔍', desc: '根据症状定位错误位置' },
    { name: '纠错', icon: '✅', desc: '应用对应Pauli门纠错' }
  ]

  return (
    <div className="steane-panel">
      <div className="steane-header">
        <h2>🔷 Steane码量子纠错演示</h2>
        <p className="subtitle">[[7,1,3]] CSS型量子纠错码 | 纠正单量子比特任意错误</p>
      </div>

      <div className="steane-main">
        <div className="steane-left">
          <div className="qubit-visualization">
            <h3>7量子比特状态</h3>
            <div className="qubit-row">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className={`qubit-box status-${getQubitStatus(i)}`}>
                  <span className="qubit-label">q{i}</span>
                  <div className="qubit-state">
                    {errorLocations.x.includes(i) && <span className="error-x">X</span>}
                    {errorLocations.z.includes(i) && <span className="error-z">Z</span>}
                    {!errorLocations.x.includes(i) && !errorLocations.z.includes(i) && (
                      <span className="no-error">○</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="error-legend">
              <span><span className="legend-dot normal"></span> 正常</span>
              <span><span className="legend-dot x-error"></span> X错误</span>
              <span><span className="legend-dot z-error"></span> Z错误</span>
              <span><span className="legend-dot both-error"></span> 双错误</span>
            </div>
          </div>

          <div className="stabilizer-display">
            <h3>稳定子生成元</h3>
            <div className="stabilizer-grid">
              {SteaneCode.getStabilizerGenerators().X.map((stabilizer, i) => (
                <div key={`x-${i}`} className={`stabilizer-row ${syndromes.x[i] === 1 ? 'syndrome-active' : ''}`}>
                  <span className="stabilizer-type">X{i+1}</span>
                  <span className="stabilizer-name">{stabilizer.name}</span>
                  <span className={`syndrome-value syndrome-${syndromes.x[i]}`}>
                    = {syndromes.x[i]}
                  </span>
                </div>
              ))}
              {SteaneCode.getStabilizerGenerators().Z.map((stabilizer, i) => (
                <div key={`z-${i}`} className={`stabilizer-row ${syndromes.z[i] === 1 ? 'syndrome-active' : ''}`}>
                  <span className="stabilizer-type">Z{i+1}</span>
                  <span className="stabilizer-name">{stabilizer.name}</span>
                  <span className={`syndrome-value syndrome-${syndromes.z[i]}`}>
                    = {syndromes.z[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="logical-state-display">
            <h3>逻辑量子比特状态</h3>
            <div className="state-bars">
              <div className="state-bar">
                <span className="state-label">|0⟩_L</span>
                <div className="bar-container">
                  <div className="bar-fill zero" style={{ width: `${logicalState.zero * 100}%` }}></div>
                </div>
                <span className="bar-value">{(logicalState.zero * 100).toFixed(1)}%</span>
              </div>
              <div className="state-bar">
                <span className="state-label">|1⟩_L</span>
                <div className="bar-container">
                  <div className="bar-fill one" style={{ width: `${logicalState.one * 100}%` }}></div>
                </div>
                <span className="bar-value">{(logicalState.one * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="steane-right">
          <div className="control-panel">
            <h3>纠错流程控制</h3>
            
            <div className="step-indicator">
              {steps.map((s, i) => (
                <div key={i} className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                  <span className="step-icon">{s.icon}</span>
                  <span className="step-name">{s.name}</span>
                </div>
              ))}
            </div>

            <div className="action-buttons">
              <div className="button-row">
                <button 
                  onClick={() => encode(0)} 
                  className="action-btn encode"
                  disabled={isAnimating}
                >
                  编码 |0⟩_L
                </button>
                <button 
                  onClick={() => encode(1)} 
                  className="action-btn encode"
                  disabled={isAnimating}
                >
                  编码 |1⟩_L
                </button>
              </div>

              <div className="noise-controls">
                <h4>噪声参数</h4>
                <div className="param-row">
                  <label>目标量子比特:</label>
                  <select 
                    value={noiseQubit} 
                    onChange={(e) => setNoiseQubit(parseInt(e.target.value))}
                    disabled={isAnimating}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map(q => (
                      <option key={q} value={q}>q{q}</option>
                    ))}
                  </select>
                </div>
                <div className="param-row">
                  <label>噪声概率:</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1"
                    value={noiseProbability}
                    onChange={(e) => setNoiseProbability(parseFloat(e.target.value))}
                    disabled={isAnimating}
                  />
                  <span className="prob-value">{(noiseProbability * 100).toFixed(0)}%</span>
                </div>
                <div className="button-row">
                  <button 
                    onClick={() => applyNoise('bitflip')} 
                    className="action-btn noise x-noise"
                    disabled={isAnimating || step < 1}
                  >
                    施加X噪声
                  </button>
                  <button 
                    onClick={() => applyNoise('phaseflip')} 
                    className="action-btn noise z-noise"
                    disabled={isAnimating || step < 1}
                  >
                    施加Z噪声
                  </button>
                </div>
              </div>

              <div className="correction-controls">
                <button 
                  onClick={measureStabilizers} 
                  className="action-btn measure"
                  disabled={isAnimating || step < 2}
                >
                  📊 测量稳定子
                </button>
                <button 
                  onClick={decode} 
                  className="action-btn decode"
                  disabled={isAnimating || step < 3}
                >
                  🔍 错误解码
                </button>
                <button 
                  onClick={correct} 
                  className="action-btn correct"
                  disabled={isAnimating || step < 4}
                >
                  ✅ 应用纠错
                </button>
              </div>

              <div className="bottom-buttons">
                <button onClick={runFullDemo} className="action-btn demo" disabled={isAnimating}>
                  🎬 完整演示
                </button>
                <button onClick={reset} className="action-btn reset">
                  🔄 重置
                </button>
              </div>
            </div>
          </div>

          {detectedErrors.x >= 0 || detectedErrors.z >= 0 ? (
            <div className="error-detection">
              <h4>🎯 检测结果</h4>
              <div className="detection-result">
                {detectedErrors.xErrorQubit >= 0 ? (
                  <p className="found-error">检测到 X 错误在量子比特 q{detectedErrors.xErrorQubit}</p>
                ) : (
                  <p className="no-error-found">未检测到 X 错误</p>
                )}
                {detectedErrors.zErrorQubit >= 0 ? (
                  <p className="found-error">检测到 Z 错误在量子比特 q{detectedErrors.zErrorQubit}</p>
                ) : (
                  <p className="no-error-found">未检测到 Z 错误</p>
                )}
              </div>
            </div>
          ) : step >= 4 && (
            <div className="error-detection success">
              <h4>✅ 无错误</h4>
              <p>量子状态保持完好，无需纠错</p>
            </div>
          )}
        </div>
      </div>

      <div className="history-panel">
        <h3>📜 操作历史</h3>
        <div className="history-list">
          {history.length === 0 ? (
            <p className="empty-history">开始演示以查看操作记录...</p>
          ) : (
            history.map((item, i) => (
              <div key={i} className={`history-item type-${item.type}`}>
                <span className="history-index">[{i + 1}]</span>
                <span className="history-message">{item.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="info-section">
        <button className="toggle-info" onClick={() => setShowInfo(!showInfo)}>
          {showInfo ? '收起说明 ▲' : '展开原理说明 ▼'}
        </button>
        {showInfo && (
          <div className="info-content">
            <pre>{SteaneCode.getCodeDescription()}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default SteaneCodePanel
