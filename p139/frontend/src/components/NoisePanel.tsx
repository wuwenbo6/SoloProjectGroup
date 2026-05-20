import React from 'react';
import { useCircuitStore } from '../store/useCircuitStore';

export const NoisePanel: React.FC = () => {
  const { noiseSettings, setNoiseSettings } = useCircuitStore();

  const handleChange = (key: keyof typeof noiseSettings, value: number | boolean) => {
    setNoiseSettings({
      ...noiseSettings,
      [key]: value,
    });
  };

  return (
    <div
      style={{
        background: '#1a1a2e',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>
          🔊 Noise Model
        </h3>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={noiseSettings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Enable
        </label>
      </div>

      <div style={{ opacity: noiseSettings.enabled ? 1 : 0.5 }}>
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label style={{ color: '#888', fontSize: '13px' }}>
              Depolarizing Rate
            </label>
            <span style={{ color: '#e94560', fontSize: '13px' }}>
              {(noiseSettings.depolarizing_rate * 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.3"
            step="0.001"
            value={noiseSettings.depolarizing_rate}
            onChange={(e) => handleChange('depolarizing_rate', parseFloat(e.target.value))}
            disabled={!noiseSettings.enabled}
            style={{ width: '100%', cursor: noiseSettings.enabled ? 'pointer' : 'not-allowed' }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Random Pauli errors on gate qubits
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label style={{ color: '#888', fontSize: '13px' }}>
              Amplitude Damping
            </label>
            <span style={{ color: '#e94560', fontSize: '13px' }}>
              {(noiseSettings.amplitude_damping * 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.001"
            value={noiseSettings.amplitude_damping}
            onChange={(e) => handleChange('amplitude_damping', parseFloat(e.target.value))}
            disabled={!noiseSettings.enabled}
            style={{ width: '100%', cursor: noiseSettings.enabled ? 'pointer' : 'not-allowed' }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Energy relaxation |1> → |0>
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label style={{ color: '#888', fontSize: '13px' }}>
              Readout Error
            </label>
            <span style={{ color: '#e94560', fontSize: '13px' }}>
              {(noiseSettings.readout_error * 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.001"
            value={noiseSettings.readout_error}
            onChange={(e) => handleChange('readout_error', parseFloat(e.target.value))}
            disabled={!noiseSettings.enabled}
            style={{ width: '100%', cursor: noiseSettings.enabled ? 'pointer' : 'not-allowed' }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Classical bit-flip during measurement
          </div>
        </div>
      </div>
    </div>
  );
};
