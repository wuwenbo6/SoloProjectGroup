import React, { useState, useRef, useEffect } from 'react';
import { Gate } from '../types';

interface CircuitCanvasProps {
  numQubits: number;
  gates: Gate[];
  onAddGate: (gate: Gate) => void;
  onRemoveGate: (index: number) => void;
}

const GATE_COLORS: Record<string, string> = {
  H: '#e94560',
  X: '#0f3460',
  Y: '#533483',
  Z: '#16213e',
  CNOT: '#00d9ff',
  Toffoli: '#00ff88',
};

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  numQubits,
  gates,
  onAddGate,
  onRemoveGate,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState<{ qubit: number; col: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, cellWidth: 80, rowHeight: 70 });

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const width = canvasRef.current.clientWidth - 80;
        const cellWidth = Math.max(80, Math.floor(width / Math.max(gates.length + 4, 8)));
        setDimensions({ width, cellWidth, rowHeight: 70 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [gates.length]);

  const handleDragOver = (e: React.DragEvent, qubit: number, col: number) => {
    e.preventDefault();
    setDropTarget({ qubit, col });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, qubit: number, col: number) => {
    e.preventDefault();
    const gateType = e.dataTransfer.getData('gateType');
    setDropTarget(null);

    if (gateType) {
      const newGate: Gate = {
        type: gateType,
        target: qubit,
        controls:
          gateType === 'CNOT'
            ? [qubit === 0 ? 1 : 0]
            : gateType === 'Toffoli'
            ? [Math.max(0, qubit - 1), Math.max(0, qubit - 2)]
            : undefined,
      };
      onAddGate(newGate);
    }
  };

  const numColumns = Math.max(gates.length + 4, 8);
  const { cellWidth, rowHeight } = dimensions;

  return (
    <div
      ref={canvasRef}
      style={{
        background: '#1a1a2e',
        padding: '20px',
        borderRadius: '8px',
        overflowX: 'auto',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '16px' }}>
        Circuit Editor
      </h3>
      <div
        style={{
          position: 'relative',
          minWidth: `${numColumns * cellWidth + 80}px`,
          paddingTop: '10px',
        }}
      >
        {Array.from({ length: numQubits }).map((_, qubitIndex) => (
          <div
            key={qubitIndex}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: `${rowHeight}px`,
              marginBottom: '4px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '50px',
                color: '#e94560',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'right',
                paddingRight: '10px',
                flexShrink: 0,
              }}
            >
              q{qubitIndex}
            </div>

            <div
              style={{
                position: 'absolute',
                left: '60px',
                top: `${rowHeight / 2 - 1}px`,
                height: '2px',
                backgroundColor: '#3a3a5a',
                width: `${numColumns * cellWidth}px`,
                zIndex: 1,
              }}
            />

            <div
              style={{
                display: 'flex',
                marginLeft: '10px',
                position: 'relative',
                zIndex: 2,
              }}
            >
              {Array.from({ length: numColumns }).map((_, colIndex) => (
                <div
                  key={colIndex}
                  onDragOver={(e) => handleDragOver(e, qubitIndex, colIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, qubitIndex, colIndex)}
                  style={{
                    width: `${cellWidth}px`,
                    height: `${rowHeight}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      dropTarget?.qubit === qubitIndex && dropTarget?.col === colIndex
                        ? 'rgba(233, 69, 96, 0.3)'
                        : 'transparent',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s ease',
                    border:
                      dropTarget?.qubit === qubitIndex && dropTarget?.col === colIndex
                        ? '2px dashed #e94560'
                        : '2px solid transparent',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {gates.map((gate, gateIndex) => {
          const gateLeft = 70 + gateIndex * cellWidth;
          const gateTop = gate.target * (rowHeight + 4) + 10;

          return (
            <React.Fragment key={gateIndex}>
              <div
                onDoubleClick={() => onRemoveGate(gateIndex)}
                style={{
                  position: 'absolute',
                  left: `${gateLeft + (cellWidth - 56) / 2}px`,
                  top: `${gateTop + (rowHeight - 56) / 2}px`,
                  width: '56px',
                  height: '56px',
                  backgroundColor: GATE_COLORS[gate.type] || '#e94560',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: gate.type.length > 3 ? '13px' : '16px',
                  cursor: 'pointer',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'transform 0.1s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Double-click to remove"
              >
                {gate.type}
              </div>

              {gate.controls &&
                gate.controls.map((controlQubit) => {
                  const controlTop = controlQubit * (rowHeight + 4) + 10;
                  const minTop = Math.min(controlTop, gateTop);
                  const maxTop = Math.max(controlTop, gateTop);
                  const lineLeft = gateLeft + cellWidth / 2;

                  return (
                    <React.Fragment key={`control-${controlQubit}`}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${lineLeft - 6}px`,
                          top: `${controlTop + rowHeight / 2 - 6}px`,
                          width: '12px',
                          height: '12px',
                          backgroundColor: GATE_COLORS[gate.type] || '#e94560',
                          borderRadius: '50%',
                          zIndex: 99,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: `${lineLeft - 1}px`,
                          top: `${minTop + rowHeight / 2}px`,
                          width: '2px',
                          height: `${maxTop - minTop}px`,
                          backgroundColor: GATE_COLORS[gate.type] || '#e94560',
                          zIndex: 98,
                        }}
                      />
                    </React.Fragment>
                  );
                })}
            </React.Fragment>
          );
        })}
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '12px 16px',
          background: '#16213e',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#888',
          lineHeight: '1.5',
        }}
      >
        💡 Drag gates from the toolbox onto the circuit grid. Double-click a gate to
        remove it. Control qubits are automatically connected with lines.
      </div>
    </div>
  );
};
