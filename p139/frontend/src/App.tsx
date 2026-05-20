import React, { useState } from 'react';
import { BlochSphere } from './components/BlochSphere';
import { GateToolbox } from './components/GateToolbox';
import { CircuitCanvas } from './components/CircuitCanvas';
import { ResultsPanel } from './components/ResultsPanel';
import { NoisePanel } from './components/NoisePanel';
import { useCircuitStore } from './store/useCircuitStore';
import api from './services/api';

function App() {
  const {
    numQubits,
    gates,
    results,
    isRunning,
    noiseSettings,
    setNumQubits,
    addGate,
    removeGate,
    clearCircuit,
    runCircuit,
    exportToQASM,
  } = useCircuitStore();

  const [ecResult, setEcResult] = useState<any>(null);
  const [showEcDemo, setShowEcDemo] = useState(false);

  const runEcDemo = async () => {
    try {
      const response = await api.post('/error-correction/steane-code/demonstrate', null, {
        params: { noise_rate: noiseSettings.depolarizing_rate || 0.05, shots: 1024 },
      });
      setEcResult(response.data);
      setShowEcDemo(true);
    } catch (error) {
      console.error('Error running EC demo:', error);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
        color: '#fff',
      }}
    >
      <header
        style={{
          padding: '20px 40px',
          borderBottom: '1px solid #2a2a4a',
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: '1600px',
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>⚛️</span>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              Quantum Circuit Simulator
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: '#888' }}>Qubits:</label>
              <select
                value={numQubits}
                onChange={(e) => setNumQubits(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#16213e',
                  border: '1px solid #2a2a4a',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {[1, 2, 3, 4, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportToQASM}
              disabled={gates.length === 0}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                background: gates.length === 0 ? '#333' : '#533483',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                cursor: gates.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📄 Export QASM
            </button>

            <button
              onClick={runEcDemo}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                background: '#0f3460',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              🛡️ Steane Code Demo
            </button>

            <button
              onClick={clearCircuit}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                background: '#16213e',
                border: '1px solid #2a2a4a',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0f3460';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#16213e';
              }}
            >
              Clear
            </button>

            <button
              onClick={runCircuit}
              disabled={isRunning || gates.length === 0}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                background: isRunning || gates.length === 0 ? '#555' : '#e94560',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: isRunning || gates.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {isRunning ? 'Running...' : 'Run Circuit'}
            </button>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '24px 40px',
        }}
      >
        {showEcDemo && ecResult && (
          <div
            style={{
              marginBottom: '24px',
              padding: '20px',
              background: '#0f3460',
              borderRadius: '8px',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowEcDemo(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>
              🛡️ Steane Code Error Correction Demo
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '12px', background: '#1a1a2e', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
                  Without Noise (Ideal)
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  Fidelity: 100%
                </div>
              </div>
              <div style={{ padding: '12px', background: '#1a1a2e', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
                  With Noise (No Correction)
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e94560' }}>
                  Fidelity: {(ecResult.with_noise_no_ec.fidelity * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ padding: '12px', background: '#1a1a2e', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
                  With Steane Code
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00ff88' }}>
                  7-qubit encoded state
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '24px' }}>
          <div>
            <GateToolbox onDragStart={() => {}} />
            <NoisePanel />

            <div
              style={{
                background: '#1a1a2e',
                padding: '16px',
                borderRadius: '8px',
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px' }}>
                Circuit Stats
              </h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#16213e',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ color: '#888' }}>Gates:</span>
                  <span style={{ fontWeight: 'bold', color: '#e94560' }}>
                    {gates.length}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#16213e',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ color: '#888' }}>Qubits:</span>
                  <span style={{ fontWeight: 'bold', color: '#e94560' }}>
                    {numQubits}
                  </span>
                </div>
                {noiseSettings.enabled && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#533483',
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ color: '#fff' }}>🔊 Noise:</span>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <CircuitCanvas
              numQubits={numQubits}
              gates={gates}
              onAddGate={addGate}
              onRemoveGate={removeGate}
            />

            {results && results.bloch_spheres && (
              <div style={{ marginTop: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 16px 0',
                    color: '#fff',
                    fontSize: '16px',
                  }}
                >
                  Bloch Spheres
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(results.bloch_spheres.length, 3)}, 1fr)`,
                    gap: '16px',
                  }}
                >
                  {results.bloch_spheres.map((coords, idx) => (
                    <BlochSphere key={idx} coordinates={coords} qubitIndex={idx} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <ResultsPanel results={results} isRunning={isRunning} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
