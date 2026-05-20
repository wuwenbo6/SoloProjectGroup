import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { create } from 'zustand';

class CRDTManager {
  constructor() {
    this.doc = null;
    this.provider = null;
    this.nodes = null;
    this.animations = null;
    this.scenes = null;
    this.currentSceneId = null;
    this.callbacks = new Set();
  }

  init(roomId, userId) {
    this.doc = new Y.Doc();
    this.nodes = this.doc.getMap('nodes');
    this.animations = this.doc.getMap('animations');
    this.scenes = this.doc.getMap('scenes');
    
    this.provider = new WebsocketProvider(
      'ws://localhost:8080',
      roomId,
      this.doc,
      {
        connect: true,
        params: { userId }
      }
    );

    this.provider.on('status', (event) => {
      console.log('CRDT connection status:', event.status);
    });

    this.nodes.observeDeep((events) => {
      this.notifyCallbacks(events);
    });

    this.animations.observeDeep((events) => {
      this.notifyCallbacks(events);
    });

    this.scenes.observeDeep((events) => {
      this.notifyCallbacks(events);
    });

    if (this.scenes.size === 0) {
      const defaultSceneId = 'scene_default';
      this.scenes.set(defaultSceneId, {
        id: defaultSceneId,
        name: 'Default Scene',
        nodeIds: [],
        activeAnimationId: null,
        createdAt: Date.now()
      });
      this.currentSceneId = defaultSceneId;
    } else {
      this.currentSceneId = this.scenes.keys().next().value;
    }

    return this;
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  notifyCallbacks(events) {
    this.callbacks.forEach(cb => cb(events));
  }

  setNodePosition(nodeId, position, clientId) {
    const nodeData = this.nodes.get(nodeId) || {};
    const pos = nodeData.position || {};
    
    const newPos = {
      x: this.resolveConflict(pos.x, position.x, pos.xClientId, clientId),
      y: this.resolveConflict(pos.y, position.y, pos.yClientId, clientId),
      z: this.resolveConflict(pos.z, position.z, pos.zClientId, clientId),
      xClientId: clientId,
      yClientId: clientId,
      zClientId: clientId,
      lastUpdate: Date.now()
    };

    this.nodes.set(nodeId, {
      ...nodeData,
      position: newPos
    });
  }

  setNodeRotation(nodeId, rotation, clientId) {
    const nodeData = this.nodes.get(nodeId) || {};
    const rot = nodeData.rotation || {};
    
    const newRot = {
      x: this.resolveConflict(rot.x, rotation.x, rot.xClientId, clientId),
      y: this.resolveConflict(rot.y, rotation.y, rot.yClientId, clientId),
      z: this.resolveConflict(rot.z, rotation.z, rot.zClientId, clientId),
      xClientId: clientId,
      yClientId: clientId,
      zClientId: clientId,
      lastUpdate: Date.now()
    };

    this.nodes.set(nodeId, {
      ...nodeData,
      rotation: newRot
    });
  }

  setNodeScale(nodeId, scale, clientId) {
    const nodeData = this.nodes.get(nodeId) || {};
    const sc = nodeData.scale || {};
    
    const newScale = {
      x: this.resolveConflict(sc.x, scale.x, sc.xClientId, clientId),
      y: this.resolveConflict(sc.y, scale.y, sc.yClientId, clientId),
      z: this.resolveConflict(sc.z, scale.z, sc.zClientId, clientId),
      xClientId: clientId,
      yClientId: clientId,
      zClientId: clientId,
      lastUpdate: Date.now()
    };

    this.nodes.set(nodeId, {
      ...nodeData,
      scale: newScale
    });
  }

  resolveConflict(oldVal, newVal, oldClientId, newClientId) {
    if (oldVal === undefined) return newVal;
    if (oldClientId === undefined) return newVal;
    if (oldClientId === newClientId) return newVal;
    return oldClientId > newClientId ? oldVal : newVal;
  }

  setNodeMaterial(nodeId, material, baseUrl = '') {
    const nodeData = this.nodes.get(nodeId) || {};
    const processedMaterial = this.processMaterialUrls(material, baseUrl);
    
    this.nodes.set(nodeId, {
      ...nodeData,
      material: processedMaterial,
      materialLastUpdate: Date.now()
    });
  }

  processMaterialUrls(material, baseUrl) {
    if (!material) return material;
    const result = { ...material };
    
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(prop => {
      if (result[prop] && typeof result[prop] === 'string') {
        result[prop] = this.normalizeUrl(result[prop], baseUrl);
        result[`${prop}Original`] = result[prop];
      }
    });
    
    return result;
  }

  normalizeUrl(url, baseUrl) {
    if (!url) return url;
    
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    
    if (url.startsWith('//')) {
      return window.location.protocol + url;
    }
    
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    
    if (baseUrl) {
      const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      return base + url;
    }
    
    return url;
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  getAllNodes() {
    const result = {};
    this.nodes.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  addNode(nodeId, data, sceneId = null) {
    const targetSceneId = sceneId || this.currentSceneId;
    const scene = this.scenes.get(targetSceneId);
    
    this.nodes.set(nodeId, {
      ...data,
      id: nodeId,
      sceneId: targetSceneId,
      createdAt: Date.now()
    });

    if (scene) {
      const nodeIds = scene.nodeIds || [];
      if (!nodeIds.includes(nodeId)) {
        this.scenes.set(targetSceneId, {
          ...scene,
          nodeIds: [...nodeIds, nodeId]
        });
      }
    }
  }

  removeNode(nodeId) {
    const nodeData = this.nodes.get(nodeId);
    if (nodeData && nodeData.sceneId) {
      const scene = this.scenes.get(nodeData.sceneId);
      if (scene) {
        this.scenes.set(nodeData.sceneId, {
          ...scene,
          nodeIds: (scene.nodeIds || []).filter(id => id !== nodeId)
        });
      }
    }
    this.nodes.delete(nodeId);
  }

  getSceneNodes(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) return {};
    
    const result = {};
    (scene.nodeIds || []).forEach(nodeId => {
      const node = this.nodes.get(nodeId);
      if (node) {
        result[nodeId] = node;
      }
    });
    return result;
  }

  getCurrentSceneNodes() {
    return this.getSceneNodes(this.currentSceneId);
  }

  createScene(sceneId, name) {
    this.scenes.set(sceneId, {
      id: sceneId,
      name: name || `Scene ${this.scenes.size + 1}`,
      nodeIds: [],
      activeAnimationId: null,
      createdAt: Date.now()
    });
  }

  deleteScene(sceneId) {
    if (this.scenes.size <= 1) return;
    
    const scene = this.scenes.get(sceneId);
    if (scene) {
      (scene.nodeIds || []).forEach(nodeId => {
        this.nodes.delete(nodeId);
      });
    }
    this.scenes.delete(sceneId);
    
    if (this.currentSceneId === sceneId) {
      this.currentSceneId = this.scenes.keys().next().value;
    }
  }

  switchScene(sceneId) {
    if (this.scenes.has(sceneId)) {
      this.currentSceneId = sceneId;
      return true;
    }
    return false;
  }

  renameScene(sceneId, name) {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      this.scenes.set(sceneId, {
        ...scene,
        name
      });
    }
  }

  getAllScenes() {
    const result = {};
    this.scenes.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  getCurrentSceneId() {
    return this.currentSceneId;
  }

  createAnimation(animationId, name, nodeId) {
    this.animations.set(animationId, {
      id: animationId,
      name: name || `Animation ${this.animations.size + 1}`,
      nodeId,
      tracks: {},
      duration: 0,
      isPlaying: false,
      currentTime: 0,
      playbackSpeed: 1,
      loop: true,
      createdAt: Date.now()
    });

    const scene = this.scenes.get(this.currentSceneId);
    if (scene) {
      this.scenes.set(this.currentSceneId, {
        ...scene,
        activeAnimationId: animationId
      });
    }
  }

  deleteAnimation(animationId) {
    this.animations.delete(animationId);
  }

  addKeyframe(animationId, trackType, time, value, clientId) {
    const animation = this.animations.get(animationId);
    if (!animation) return;

    const tracks = animation.tracks || {};
    const track = tracks[trackType] || { keyframes: [], type: trackType };
    
    const keyframeIndex = track.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
    
    if (keyframeIndex >= 0) {
      const existingKf = track.keyframes[keyframeIndex];
      const newValue = {};
      Object.keys(value).forEach(key => {
        newValue[key] = this.resolveConflict(
          existingKf.value[key], 
          value[key], 
          existingKf.clientId, 
          clientId
        );
      });
      track.keyframes[keyframeIndex] = {
        time,
        value: newValue,
        clientId,
        lastUpdate: Date.now()
      };
    } else {
      track.keyframes.push({
        time,
        value,
        clientId,
        lastUpdate: Date.now()
      });
      track.keyframes.sort((a, b) => a.time - b.time);
    }

    const maxTime = Math.max(...track.keyframes.map(k => k.time), animation.duration);

    this.animations.set(animationId, {
      ...animation,
      tracks: {
        ...tracks,
        [trackType]: track
      },
      duration: maxTime
    });
  }

  removeKeyframe(animationId, trackType, time) {
    const animation = this.animations.get(animationId);
    if (!animation) return;

    const tracks = animation.tracks || {};
    const track = tracks[trackType];
    if (!track) return;

    track.keyframes = track.keyframes.filter(kf => Math.abs(kf.time - time) > 0.01);

    this.animations.set(animationId, {
      ...animation,
      tracks: {
        ...tracks,
        [trackType]: track
      }
    });
  }

  setAnimationTime(animationId, time) {
    const animation = this.animations.get(animationId);
    if (!animation) return;

    this.animations.set(animationId, {
      ...animation,
      currentTime: Math.max(0, Math.min(time, animation.duration))
    });
  }

  setAnimationPlaying(animationId, isPlaying) {
    const animation = this.animations.get(animationId);
    if (!animation) return;

    this.animations.set(animationId, {
      ...animation,
      isPlaying
    });
  }

  setAnimationSpeed(animationId, speed) {
    const animation = this.animations.get(animationId);
    if (!animation) return;

    this.animations.set(animationId, {
      ...animation,
      playbackSpeed: Math.max(0.1, Math.min(5, speed))
    });
  }

  setAnimationLoop(animationId, loop) {
    const animation = this.animations.get(animationId);
    if (!animation) return;

    this.animations.set(animationId, {
      ...animation,
      loop
    });
  }

  setActiveAnimation(animationId) {
    const scene = this.scenes.get(this.currentSceneId);
    if (scene) {
      this.scenes.set(this.currentSceneId, {
        ...scene,
        activeAnimationId: animationId
      });
    }
  }

  renameAnimation(animationId, name) {
    const animation = this.animations.get(animationId);
    if (animation) {
      this.animations.set(animationId, {
        ...animation,
        name
      });
    }
  }

  getAllAnimations() {
    const result = {};
    this.animations.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  getAnimation(animationId) {
    return this.animations.get(animationId);
  }

  interpolateKeyframes(track, time) {
    if (!track || !track.keyframes || track.keyframes.length === 0) {
      return null;
    }

    const keyframes = track.keyframes;
    
    if (time <= keyframes[0].time) {
      return keyframes[0].value;
    }
    
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value;
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
        const t = (time - keyframes[i].time) / (keyframes[i + 1].time - keyframes[i].time);
        const v1 = keyframes[i].value;
        const v2 = keyframes[i + 1].value;
        
        const result = {};
        Object.keys(v1).forEach(key => {
          result[key] = v1[key] + (v2[key] - v1[key]) * t;
        });
        return result;
      }
    }

    return null;
  }

  setSkeletonPose(nodeId, boneName, position, rotation, scale) {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return;

    const bones = nodeData.bones || {};
    const bone = bones[boneName] || {};

    this.nodes.set(nodeId, {
      ...nodeData,
      bones: {
        ...bones,
        [boneName]: {
          ...bone,
          position: position || bone.position,
          rotation: rotation || bone.rotation,
          scale: scale || bone.scale,
          lastUpdate: Date.now()
        }
      }
    });
  }

  getSkeletonData(nodeId) {
    const nodeData = this.nodes.get(nodeId);
    return nodeData?.bones || {};
  }

  destroy() {
    if (this.provider) {
      this.provider.destroy();
    }
    if (this.doc) {
      this.doc.destroy();
    }
    this.callbacks.clear();
  }
}

export const crdtManager = new CRDTManager();

export const useCRDTStore = create((set, get) => ({
  nodes: {},
  animations: {},
  scenes: {},
  currentSceneId: null,
  isConnected: false,
  roomId: null,
  userId: null,

  init: (roomId, userId) => {
    crdtManager.init(roomId, userId);
    
    crdtManager.provider.on('status', (event) => {
      set({ isConnected: event.status === 'connected' });
    });

    crdtManager.subscribe(() => {
      set({
        nodes: crdtManager.getAllNodes(),
        animations: crdtManager.getAllAnimations(),
        scenes: crdtManager.getAllScenes(),
        currentSceneId: crdtManager.getCurrentSceneId()
      });
    });

    set({
      roomId,
      userId,
      nodes: crdtManager.getAllNodes(),
      animations: crdtManager.getAllAnimations(),
      scenes: crdtManager.getAllScenes(),
      currentSceneId: crdtManager.getCurrentSceneId()
    });
  },

  setNodePosition: (nodeId, position) => {
    const { userId } = get();
    crdtManager.setNodePosition(nodeId, position, userId);
  },

  setNodeRotation: (nodeId, rotation) => {
    const { userId } = get();
    crdtManager.setNodeRotation(nodeId, rotation, userId);
  },

  setNodeScale: (nodeId, scale) => {
    const { userId } = get();
    crdtManager.setNodeScale(nodeId, scale, userId);
  },

  setNodeMaterial: (nodeId, material, baseUrl) => {
    crdtManager.setNodeMaterial(nodeId, material, baseUrl);
  },

  addNode: (nodeId, data, sceneId) => {
    crdtManager.addNode(nodeId, data, sceneId);
  },

  removeNode: (nodeId) => {
    crdtManager.removeNode(nodeId);
  },

  getCurrentSceneNodes: () => {
    return crdtManager.getCurrentSceneNodes();
  },

  createScene: (sceneId, name) => {
    crdtManager.createScene(sceneId, name);
  },

  deleteScene: (sceneId) => {
    crdtManager.deleteScene(sceneId);
  },

  switchScene: (sceneId) => {
    const result = crdtManager.switchScene(sceneId);
    if (result) {
      set({ currentSceneId: crdtManager.getCurrentSceneId() });
    }
    return result;
  },

  renameScene: (sceneId, name) => {
    crdtManager.renameScene(sceneId, name);
  },

  createAnimation: (animationId, name, nodeId) => {
    crdtManager.createAnimation(animationId, name, nodeId);
  },

  deleteAnimation: (animationId) => {
    crdtManager.deleteAnimation(animationId);
  },

  addKeyframe: (animationId, trackType, time, value) => {
    const { userId } = get();
    crdtManager.addKeyframe(animationId, trackType, time, value, userId);
  },

  removeKeyframe: (animationId, trackType, time) => {
    crdtManager.removeKeyframe(animationId, trackType, time);
  },

  setAnimationTime: (animationId, time) => {
    crdtManager.setAnimationTime(animationId, time);
  },

  setAnimationPlaying: (animationId, isPlaying) => {
    crdtManager.setAnimationPlaying(animationId, isPlaying);
  },

  setAnimationSpeed: (animationId, speed) => {
    crdtManager.setAnimationSpeed(animationId, speed);
  },

  setAnimationLoop: (animationId, loop) => {
    crdtManager.setAnimationLoop(animationId, loop);
  },

  setActiveAnimation: (animationId) => {
    crdtManager.setActiveAnimation(animationId);
  },

  renameAnimation: (animationId, name) => {
    crdtManager.renameAnimation(animationId, name);
  },

  interpolateKeyframes: (track, time) => {
    return crdtManager.interpolateKeyframes(track, time);
  },

  setSkeletonPose: (nodeId, boneName, position, rotation, scale) => {
    crdtManager.setSkeletonPose(nodeId, boneName, position, rotation, scale);
  },

  getSkeletonData: (nodeId) => {
    return crdtManager.getSkeletonData(nodeId);
  },

  destroy: () => {
    crdtManager.destroy();
    set({ nodes: {}, animations: {}, scenes: {}, currentSceneId: null, isConnected: false });
  }
}));
