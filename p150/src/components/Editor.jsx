import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import SceneNode from './SceneNode';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import VersionHistory from './VersionHistory';
import AnimationEditor from './AnimationEditor';
import SceneManager from './SceneManager';
import { useCRDTStore } from '../store/crdtStore';
import { useWebRTCStore } from '../store/webrtcStore';
import { exportGLTF, exportGLB } from '../utils/export';

const Editor = ({ roomId, userId, onLeave }) => {
  const nodes = useCRDTStore(state => state.nodes);
  const scenes = useCRDTStore(state => state.scenes);
  const currentSceneId = useCRDTStore(state => state.currentSceneId);
  const animations = useCRDTStore(state => state.animations);
  const addNode = useCRDTStore(state => state.addNode);
  const [selectedNode, setSelectedNode] = useState(null);
  const [transformMode, setTransformMode] = useState('translate');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [showAnimationEditor, setShowAnimationEditor] = useState(false);
  const [showSceneManager, setShowSceneManager] = useState(false);
  const [gltfUrl, setGltfUrl] = useState('');
  const fileInputRef = useRef(null);

  const connectedUsers = useWebRTCStore(state => state.connectedUsers);
  const saveDocument = useWebRTCStore(state => state.saveDocument);
  const getVersions = useWebRTCStore(state => state.getVersions);

  useEffect(() => {
    getVersions();
  }, [getVersions]);

  const currentScene = scenes[currentSceneId];
  const activeAnimationId = currentScene?.activeAnimationId;
  const activeAnimation = animations[activeAnimationId];

  const getCurrentSceneNodes = () => {
    return Object.values(nodes).filter((n) => n.sceneId === currentSceneId);
  };

  const handleAddPrimitive = (type) => {
    const nodeId = `node_${Date.now()}`;
    addNode(nodeId, {
      id: nodeId,
      type,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      material: {
        color: '#4a90d9',
        metalness: 0.1,
        roughness: 0.5,
      },
    }, currentSceneId);
    setSelectedNode(nodeId);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      loadGLTF(url, file.name);
    }
  };

  const loadGLTF = (url, name) => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      url,
      (gltf) => {
        const nodeId = `gltf_${Date.now()}`;
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        
        addNode(nodeId, {
          id: nodeId,
          type: 'gltf',
          name: name || 'Imported Model',
          url: url,
          position: { x: -center.x, y: 1, z: -center.z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          material: null,
        }, currentSceneId);
        setSelectedNode(nodeId);
      },
      undefined,
      (error) => {
        console.error('Error loading GLTF:', error);
        alert('Failed to load GLTF model');
      }
    );
  };

  const handleUrlImport = () => {
    if (gltfUrl.trim()) {
      loadGLTF(gltfUrl.trim(), 'URL Model');
      setGltfUrl('');
    }
  };

  const handleSave = () => {
    saveDocument(nodes);
    alert('Document saved!');
  };

  const handleExportGLTF = async () => {
    const currentNodes = getCurrentSceneNodes();
    await exportGLTF(Object.fromEntries(currentNodes.map(n => [n.id, n])), 'scene.gltf');
  };

  const handleExportGLB = async () => {
    const currentNodes = getCurrentSceneNodes();
    await exportGLB(Object.fromEntries(currentNodes.map(n => [n.id, n])), 'scene.glb');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.leaveButton} onClick={onLeave}>
            ← Leave
          </button>
          <div style={styles.sceneInfo}>
            <span style={styles.sceneLabel}>Scene:</span>
            <span style={styles.sceneName}>{currentScene?.name || 'Default'}</span>
          </div>
          <div style={styles.roomInfo}>
            <span style={styles.roomLabel}>Room:</span>
            <span style={styles.roomId}>{roomId}</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userCount}>
            <span style={styles.userIcon}>👥</span>
            <span>{connectedUsers.length} user(s)</span>
          </div>
          <button 
            style={styles.sceneManagerButton} 
            onClick={() => setShowSceneManager(true)}
          >
            🎬 Scenes
          </button>
          <button
            style={styles.animationButton}
            onClick={() => setShowAnimationEditor(true)}
          >
            ✨ Animations
          </button>
          {activeAnimation && (
            <div style={styles.activeAnimationBadge}>
              <span style={styles.animationPlayIcon}>▶️</span>
              <span>{activeAnimation.name}</span>
            </div>
          )}
          <button style={styles.versionButton} onClick={() => setShowVersions(true)}>
            📜 Versions
          </button>
          <button style={styles.saveButton} onClick={handleSave}>
            💾 Save
          </button>
          <button style={styles.exportButton} onClick={handleExportGLTF}>
            📤 Export GLTF
          </button>
          <button style={styles.exportButton} onClick={handleExportGLB}>
            📦 Export GLB
          </button>
        </div>
      </div>

      <Toolbar
        transformMode={transformMode}
        setTransformMode={setTransformMode}
        onAddPrimitive={handleAddPrimitive}
        onFileUpload={() => fileInputRef.current?.click()}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".gltf,.glb"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <div style={styles.mainContent}>
        <div style={styles.canvasWrapper}>
          <Canvas
            camera={{ position: [5, 5, 5], fov: 50 }}
            style={styles.canvas}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
              <pointLight position={[-10, -10, -5]} intensity={0.5} />
              <Environment preset="city" />
              <Grid
                infiniteGrid
                cellSize={1}
                cellThickness={0.5}
                cellColor="#6b7280"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#374151"
                fadeDistance={50}
                fadeStrength={1}
              />
              
              {getCurrentSceneNodes().map((nodeData) => (
                <SceneNode
                  key={nodeData.id}
                  nodeData={nodeData}
                  isSelected={selectedNode === nodeData.id}
                  onSelect={() => setSelectedNode(nodeData.id)}
                  transformMode={transformMode}
                />
              ))}
              
              <OrbitControls makeDefault />
            </Suspense>
          </Canvas>
        </div>

        {showSidebar && (
          <Sidebar
            selectedNode={selectedNode}
            nodes={Object.fromEntries(getCurrentSceneNodes().map(n => [n.id, n]))}
            onSelectNode={setSelectedNode}
            gltfUrl={gltfUrl}
            setGltfUrl={setGltfUrl}
            onUrlImport={handleUrlImport}
          />
        )}

        <button
          style={{ ...styles.toggleSidebar, right: showSidebar ? '320px' : '16px' }}
          onClick={() => setShowSidebar(!showSidebar)}
        >
          {showSidebar ? '→' : '←'}
        </button>
      </div>

      {showVersions && (
        <div style={styles.modalOverlay}>
          <VersionHistory onClose={() => setShowVersions(false)} roomId={roomId} />
        </div>
      )}

      {showAnimationEditor && (
        <div style={styles.modalOverlay}>
          <AnimationEditor
            selectedNode={selectedNode}
            onClose={() => setShowAnimationEditor(false)}
          />
        </div>
      )}

      {showSceneManager && (
        <div style={styles.modalOverlay}>
          <SceneManager onClose={() => setShowSceneManager(false)} />
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a2e',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#16213e',
    borderBottom: '1px solid #0f3460',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  leaveButton: {
    padding: '8px 16px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  sceneInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#e2e8f0',
  },
  sceneLabel: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  sceneName: {
    fontFamily: 'monospace',
    background: '#1e293b',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
  },
  roomInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#e2e8f0',
  },
  roomLabel: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  roomId: {
    fontFamily: 'monospace',
    background: '#1e293b',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
  },
  userCount: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#e2e8f0',
    padding: '8px 12px',
    background: '#1e293b',
    borderRadius: '6px',
  },
  userIcon: {
    fontSize: '16px',
  },
  activeAnimationBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#e2e8f0',
    padding: '8px 12px',
    background: '#7c3aed',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
  },
  animationPlayIcon: {
    fontSize: '14px',
  },
  sceneManagerButton: {
    padding: '8px 16px',
    background: '#ec4899',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  animationButton: {
    padding: '8px 16px',
    background: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  versionButton: {
    padding: '8px 16px',
    background: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  saveButton: {
    padding: '8px 16px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  exportButton: {
    padding: '8px 16px',
    background: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    position: 'relative',
  },
  canvasWrapper: {
    flex: 1,
    position: 'relative',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  toggleSidebar: {
    position: 'absolute',
    top: '16px',
    width: '32px',
    height: '32px',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: '4px',
    cursor: 'pointer',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
};

export default Editor;
