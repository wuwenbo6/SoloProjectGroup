import React, { useState } from 'react';
import { useCRDTStore } from '../store/crdtStore';

const Sidebar = ({ selectedNode, nodes, onSelectNode, gltfUrl, setGltfUrl, onUrlImport }) => {
  const setNodeMaterial = useCRDTStore(state => state.setNodeMaterial);
  const [activeTab, setActiveTab] = useState('hierarchy');

  const selectedNodeData = selectedNode ? nodes[selectedNode] : null;

  const handleMaterialChange = (key, value) => {
    if (selectedNodeData) {
      const currentMaterial = selectedNodeData.material || {};
      setNodeMaterial(selectedNode, {
        ...currentMaterial,
        [key]: value,
      });
    }
  };

  const handleColorChange = (e) => {
    handleMaterialChange('color', e.target.value);
  };

  const handleMetalnessChange = (e) => {
    handleMaterialChange('metalness', parseFloat(e.target.value));
  };

  const handleRoughnessChange = (e) => {
    handleMaterialChange('roughness', parseFloat(e.target.value));
  };

  const handleMapUrlChange = (e) => {
    handleMaterialChange('map', e.target.value);
  };

  const tabs = [
    { id: 'hierarchy', label: 'Hierarchy', icon: '📂' },
    { id: 'material', label: 'Material', icon: '🎨' },
    { id: 'import', label: 'Import', icon: '📥' },
  ];

  return (
    <div style={styles.sidebar}>
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.tabContent}>
        {activeTab === 'hierarchy' && (
          <div style={styles.hierarchyList}>
            <h3 style={styles.listTitle}>Scene Objects</h3>
            {Object.keys(nodes).length === 0 ? (
              <p style={styles.emptyMessage}>No objects in scene</p>
            ) : (
              Object.values(nodes).map((node) => (
                <div
                  key={node.id}
                  style={{
                    ...styles.hierarchyItem,
                    ...(selectedNode === node.id ? styles.hierarchyItemSelected : {}),
                  }}
                  onClick={() => onSelectNode(node.id)}
                >
                  <span style={styles.hierarchyIcon}>
                    {node.type === 'gltf' ? '📦' : '🔷'}
                  </span>
                  <span style={styles.hierarchyName}>
                    {node.name || node.type || node.id}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'material' && (
          <div style={styles.materialPanel}>
            <h3 style={styles.panelTitle}>Material Properties</h3>
            {selectedNodeData ? (
              <div style={styles.materialForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Color</label>
                  <input
                    type="color"
                    value={selectedNodeData.material?.color || '#4a90d9'}
                    onChange={handleColorChange}
                    style={styles.colorInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Metalness: {selectedNodeData.material?.metalness || 0.1}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedNodeData.material?.metalness || 0.1}
                    onChange={handleMetalnessChange}
                    style={styles.slider}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Roughness: {selectedNodeData.material?.roughness || 0.5}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedNodeData.material?.roughness || 0.5}
                    onChange={handleRoughnessChange}
                    style={styles.slider}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Texture Map URL</label>
                  <input
                    type="text"
                    value={selectedNodeData.material?.map || ''}
                    onChange={handleMapUrlChange}
                    placeholder="Enter texture URL..."
                    style={styles.textInput}
                  />
                </div>

                {selectedNodeData.material?.map && (
                  <div style={styles.texturePreview}>
                    <img
                      src={selectedNodeData.material.map}
                      alt="Texture preview"
                      style={styles.textureImage}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p style={styles.emptyMessage}>Select an object to edit material</p>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div style={styles.importPanel}>
            <h3 style={styles.panelTitle}>Import GLTF/GLB</h3>
            <div style={styles.importForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Model URL</label>
                <input
                  type="text"
                  value={gltfUrl}
                  onChange={(e) => setGltfUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onUrlImport()}
                  placeholder="https://example.com/model.gltf"
                  style={styles.textInput}
                />
              </div>
              <button style={styles.importButton} onClick={onUrlImport}>
                Import from URL
              </button>
              <p style={styles.importNote}>
                Tip: You can also use the "Import GLTF/GLB" button in the toolbar to upload local files.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  sidebar: {
    width: '320px',
    background: '#16213e',
    borderLeft: '1px solid #0f3460',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #0f3460',
  },
  tab: {
    flex: 1,
    padding: '12px 8px',
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#1e293b',
    color: '#e2e8f0',
    borderBottom: '2px solid #3b82f6',
  },
  tabContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  hierarchyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  listTitle: {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
  },
  hierarchyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: '#1e293b',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  hierarchyItemSelected: {
    background: '#3b82f6',
    color: 'white',
  },
  hierarchyIcon: {
    fontSize: '16px',
  },
  hierarchyName: {
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: '500',
  },
  emptyMessage: {
    color: '#64748b',
    fontSize: '13px',
    textAlign: 'center',
    padding: '24px',
  },
  materialPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelTitle: {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  materialForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '500',
  },
  colorInput: {
    width: '100%',
    height: '40px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: '#334155',
    cursor: 'pointer',
    appearance: 'none',
  },
  textInput: {
    padding: '10px 12px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
  },
  texturePreview: {
    width: '100%',
    height: '120px',
    background: '#1e293b',
    borderRadius: '6px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textureImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  importPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  importForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  importButton: {
    padding: '12px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  importNote: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: '1.5',
  },
};

export default Sidebar;
