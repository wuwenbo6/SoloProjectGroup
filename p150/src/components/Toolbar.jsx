import React from 'react';

const Toolbar = ({ transformMode, setTransformMode, onAddPrimitive, onFileUpload }) => {
  const primitives = [
    { type: 'box', label: 'Box', icon: '⬜' },
    { type: 'sphere', label: 'Sphere', icon: '⚪' },
    { type: 'cylinder', label: 'Cylinder', icon: '🔘' },
    { type: 'cone', label: 'Cone', icon: '🔺' },
    { type: 'torus', label: 'Torus', icon: '🍩' },
    { type: 'plane', label: 'Plane', icon: '▭' },
  ];

  const transformModes = [
    { mode: 'translate', label: 'Move', icon: '↔️' },
    { mode: 'rotate', label: 'Rotate', icon: '🔄' },
    { mode: 'scale', label: 'Scale', icon: '📐' },
  ];

  return (
    <div style={styles.toolbar}>
      <div style={styles.section}>
        <span style={styles.sectionLabel}>Transform</span>
        <div style={styles.buttonGroup}>
          {transformModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              style={{
                ...styles.toolButton,
                ...(transformMode === mode ? styles.toolButtonActive : {}),
              }}
              onClick={() => setTransformMode(mode)}
              title={label}
            >
              <span style={styles.icon}>{icon}</span>
              <span style={styles.buttonLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <span style={styles.sectionLabel}>Add Object</span>
        <div style={styles.buttonGroup}>
          {primitives.map(({ type, label, icon }) => (
            <button
              key={type}
              style={styles.toolButton}
              onClick={() => onAddPrimitive(type)}
              title={label}
            >
              <span style={styles.icon}>{icon}</span>
              <span style={styles.buttonLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <span style={styles.sectionLabel}>Import</span>
        <button style={styles.importButton} onClick={onFileUpload}>
          <span style={styles.icon}>📁</span>
          <span style={styles.buttonLabel}>Import GLTF/GLB</span>
        </button>
      </div>
    </div>
  );
};

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#16213e',
    borderBottom: '1px solid #0f3460',
    overflowX: 'auto',
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginRight: '8px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '4px',
  },
  toolButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 12px',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '60px',
  },
  toolButtonActive: {
    background: '#3b82f6',
    borderColor: '#2563eb',
    color: 'white',
  },
  importButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 16px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '80px',
  },
  icon: {
    fontSize: '18px',
  },
  buttonLabel: {
    fontSize: '11px',
    fontWeight: '500',
  },
  divider: {
    width: '1px',
    height: '40px',
    background: '#334155',
    margin: '0 8px',
  },
};

export default Toolbar;
