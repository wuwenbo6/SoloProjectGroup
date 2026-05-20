import React from 'react';

interface GateToolboxProps {
  onDragStart: (gateType: string) => void;
}

const GATES = [
  { type: 'H', name: 'Hadamard', color: '#e94560' },
  { type: 'X', name: 'Pauli-X', color: '#0f3460' },
  { type: 'Y', name: 'Pauli-Y', color: '#533483' },
  { type: 'Z', name: 'Pauli-Z', color: '#16213e' },
  { type: 'CNOT', name: 'CNOT', color: '#00d9ff' },
  { type: 'Toffoli', name: 'Toffoli', color: '#00ff88' },
];

export const GateToolbox: React.FC<GateToolboxProps> = ({ onDragStart }) => {
  return (
    <div
      style={{
        background: '#1a1a2e',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px' }}>
        Quantum Gates
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {GATES.map((gate) => (
          <div
            key={gate.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('gateType', gate.type);
              onDragStart(gate.type);
            }}
            style={{
              padding: '12px 8px',
              background: gate.color,
              color: '#fff',
              borderRadius: '6px',
              textAlign: 'center',
              cursor: 'grab',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'transform 0.2s, box-shadow 0.2s',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {gate.type}
            <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
              {gate.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
