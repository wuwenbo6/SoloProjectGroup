import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCRDTStore } from '../store/crdtStore';

const SceneManager = ({ onClose }) => {
  const {
    scenes,
    currentSceneId,
    createScene,
    deleteScene,
    switchScene,
    renameScene,
    nodes,
  } = useCRDTStore();

  const [newSceneName, setNewSceneName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateScene = () => {
    const sceneId = `scene_${uuidv4().slice(0, 8)}`;
    const name = newSceneName.trim() || `Scene ${Object.keys(scenes).length + 1}`;
    createScene(sceneId, name);
    setNewSceneName('');
  };

  const handleDeleteScene = (sceneId) => {
    if (Object.keys(scenes).length <= 1) {
      alert('Cannot delete the last scene');
      return;
    }
    if (confirm('Delete this scene and all its objects?')) {
      deleteScene(sceneId);
    }
  };

  const handleSwitchScene = (sceneId) => {
    switchScene(sceneId);
  };

  const handleStartRename = (sceneId, currentName) => {
    setEditingId(sceneId);
    setEditingName(currentName);
  };

  const handleSaveRename = (sceneId) => {
    if (editingName.trim()) {
      renameScene(sceneId, editingName.trim());
    }
    setEditingId(null);
  };

  const getSceneNodeCount = (sceneId) => {
    return Object.values(nodes).filter((n) => n.sceneId === sceneId).length;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Scene Manager</h3>
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.createSection}>
          <input
            style={styles.input}
            placeholder="Scene name..."
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateScene()}
          />
          <button style={styles.createButton} onClick={handleCreateScene}>
            + New Scene
          </button>
        </div>

        <div style={styles.sceneList}>
          {Object.values(scenes).map((scene) => (
            <div
              key={scene.id}
              style={{
                ...styles.sceneItem,
                ...(currentSceneId === scene.id ? styles.sceneItemActive : {}),
              }}
            >
              {editingId === scene.id ? (
                <input
                  style={styles.nameInput}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleSaveRename(scene.id)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveRename(scene.id)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  style={styles.sceneNameWrapper}
                  onClick={() => handleSwitchScene(scene.id)}
                >
                  <span style={styles.sceneIcon}>🎬</span>
                  <span style={styles.sceneName}>{scene.name}</span>
                  <span style={styles.nodeCount}>
                    {getSceneNodeCount(scene.id)} objects
                  </span>
                </div>
              )}

              <div style={styles.sceneActions}>
                <button
                  style={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(scene.id, scene.name);
                  }}
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  style={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteScene(scene.id);
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.tips}>
          <p>💡 <strong>Tips:</strong></p>
          <ul>
            <li>Click on a scene to switch to it</li>
            <li>Each scene has its own objects and animations</li>
            <li>You must have at least one scene</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: '#1a1a2e',
    borderRadius: '8px',
    border: '1px solid #334155',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '500px',
    width: '400px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#16213e',
    borderBottom: '1px solid #334155',
  },
  title: {
    margin: 0,
    color: '#e2e8f0',
    fontSize: '16px',
    fontWeight: '600',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 8px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  createSection: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
  },
  createButton: {
    padding: '10px 16px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  sceneList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  sceneItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    marginBottom: '4px',
    background: '#1e293b',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s',
  },
  sceneItemActive: {
    borderColor: '#3b82f6',
    background: '#1e3a5f',
  },
  sceneNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  sceneIcon: {
    fontSize: '16px',
  },
  sceneName: {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: '500',
  },
  nodeCount: {
    color: '#64748b',
    fontSize: '11px',
    marginLeft: '8px',
  },
  nameInput: {
    flex: 1,
    background: '#0f172a',
    border: '1px solid #3b82f6',
    color: '#e2e8f0',
    fontSize: '14px',
    padding: '4px 8px',
    borderRadius: '4px',
    outline: 'none',
  },
  sceneActions: {
    display: 'flex',
    gap: '4px',
  },
  actionButton: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  tips: {
    padding: '12px 16px',
    borderTop: '1px solid #334155',
    color: '#64748b',
    fontSize: '11px',
  },
};

export default SceneManager;
