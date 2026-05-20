import { defineStore } from 'pinia';
import * as THREE from 'three';
import * as Y from 'yjs';
import socketService from '../services/socket';
import webrtcService from '../services/webrtc';
import api from '../services/api';
import { v4 as uuidv4 } from 'uuid';

export const useSceneStore = defineStore('scene', {
  state: () => ({
    objects: [],
    selectedObjectId: null,
    sceneId: null,
    peers: [],
    snapshots: [],
    lamportTime: 0,
    seenOperations: new Set(),
    clientId: null,
    ydoc: null,
    yObjects: null,
    pendingOperations: new Map(),
    transformQueue: []
  }),

  actions: {
    async initScene(sceneId) {
      this.sceneId = sceneId;
      this.clientId = uuidv4();
      this.lamportTime = 0;
      this.seenOperations.clear();
      this.pendingOperations.clear();
      
      this.ydoc = new Y.Doc();
      this.ydoc.clientID = this.clientId;
      this.yObjects = this.ydoc.getMap('objects');
      
      this.yObjects.observe((event) => {
        this._syncObjectsFromYjs();
      });

      socketService.on('scene-state-update', (data) => {
        this._handleStateUpdate(data);
      });

      socketService.on('operation-broadcast', (data) => {
        this._handleRemoteOperation(data);
      });

      webrtcService.onMessage((message) => {
        this._handleWebRTCMessage(message);
      });

      socketService.emit('request-scene-state', sceneId);
      webrtcService.joinScene(sceneId);
    },

    _tickLamport(remoteTime = 0) {
      this.lamportTime = Math.max(this.lamportTime, remoteTime) + 1;
      return this.lamportTime;
    },

    _generateOpId(operation, lamportTime) {
      return `${operation.objectId}-${this.clientId}-${lamportTime}`;
    },

    _shouldApplyOperation(opId, remoteLamport) {
      if (this.seenOperations.has(opId)) {
        return false;
      }
      
      this.seenOperations.add(opId);
      
      if (this.seenOperations.size > 5000) {
        const keys = Array.from(this.seenOperations).slice(0, 2500);
        keys.forEach(k => this.seenOperations.delete(k));
      }
      
      return true;
    },

    _syncObjectsFromYjs() {
      const objects = [];
      this.yObjects.forEach((value, key) => {
        objects.push({ id: key, ...value });
      });
      this.objects = objects;
    },

    _handleStateUpdate(data) {
      const objects = data.objects || data;
      const serverLamport = data.lamportTime || 0;
      
      this.lamportTime = Math.max(this.lamportTime, serverLamport);
      
      if (data.fullSync || data.rollback) {
        Y.transact(this.ydoc, () => {
          this.yObjects.clear();
          objects.forEach(obj => {
            this.yObjects.set(obj.id, obj);
          });
        });
      }
    },

    _handleRemoteOperation(data) {
      const { operation, from, lamportTime: remoteLamport, opId } = data;
      
      this._tickLamport(remoteLamport);
      
      if (!this._shouldApplyOperation(opId, remoteLamport)) {
        return;
      }

      if (from === this.clientId) {
        return;
      }

      this._applyOperationToYjs(operation, remoteLamport, from);
    },

    _handleWebRTCMessage(message) {
      if (message.type === 'transform-update') {
        const { objectId, position, rotation, scale, lamportTime: remoteLamport, opId, from } = message;
        
        if (from === this.clientId) {
          return;
        }
        
        this._tickLamport(remoteLamport || 0);
        
        if (opId && !this._shouldApplyOperation(opId, remoteLamport)) {
          return;
        }

        const obj = this.yObjects.get(objectId);
        if (obj) {
          const objLamport = obj.lamportTime || 0;
          const remoteTime = remoteLamport || 0;
          
          if (remoteTime >= objLamport) {
            Y.transact(this.ydoc, () => {
              this.yObjects.set(objectId, {
                ...obj,
                position: position || obj.position,
                rotation: rotation || obj.rotation,
                scale: scale || obj.scale,
                lamportTime: remoteTime,
                opId
              });
            });
          }
        }
      }
    },

    _applyOperationToYjs(operation, lamportTime, userId) {
      Y.transact(this.ydoc, () => {
        switch (operation.type) {
          case 'ADD_OBJECT':
            this.yObjects.set(operation.objectId, {
              id: operation.objectId,
              type: operation.objectType,
              position: operation.position || { x: 0, y: 0, z: 0 },
              rotation: operation.rotation || { x: 0, y: 0, z: 0 },
              scale: operation.scale || { x: 1, y: 1, z: 1 },
              color: operation.color || '#ffffff',
              name: operation.name || 'Object',
              lamportTime,
              opId: this._generateOpId(operation, lamportTime)
            });
            break;

          case 'UPDATE_TRANSFORM':
            const obj = this.yObjects.get(operation.objectId);
            if (obj) {
              const objLamport = obj.lamportTime || 0;
              if (lamportTime >= objLamport) {
                this.yObjects.set(operation.objectId, {
                  ...obj,
                  position: operation.position !== undefined ? operation.position : obj.position,
                  rotation: operation.rotation !== undefined ? operation.rotation : obj.rotation,
                  scale: operation.scale !== undefined ? operation.scale : obj.scale,
                  color: operation.color !== undefined ? operation.color : obj.color,
                  name: operation.name !== undefined ? operation.name : obj.name,
                  lamportTime,
                  updatedBy: userId
                });
              }
            }
            break;

          case 'DELETE_OBJECT':
            this.yObjects.delete(operation.objectId);
            break;
        }
      });
    },

    addObject(type) {
      const objectId = uuidv4();
      const lamportTime = this._tickLamport();
      const opId = this._generateOpId({ objectId }, lamportTime);
      
      const newObject = {
        id: objectId,
        type,
        name: `${type} ${this.objects.length + 1}`,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#ffffff',
        lamportTime,
        opId
      };

      Y.transact(this.ydoc, () => {
        this.yObjects.set(objectId, newObject);
      });

      socketService.emit('scene-operation', {
        sceneId: this.sceneId,
        operation: {
          type: 'ADD_OBJECT',
          objectId,
          objectType: type,
          position: newObject.position
        },
        lamportTime
      });

      return objectId;
    },

    updateObjectTransform(objectId, { position, rotation, scale }) {
      const obj = this.yObjects.get(objectId);
      if (!obj) return;

      const lamportTime = this._tickLamport();
      const opId = this._generateOpId({ objectId }, lamportTime);

      Y.transact(this.ydoc, () => {
        this.yObjects.set(objectId, {
          ...obj,
          position: position !== undefined ? position : obj.position,
          rotation: rotation !== undefined ? rotation : obj.rotation,
          scale: scale !== undefined ? scale : obj.scale,
          lamportTime,
          opId
        });
      });

      const updatedObj = this.yObjects.get(objectId);

      socketService.emit('scene-operation', {
        sceneId: this.sceneId,
        operation: {
          type: 'UPDATE_TRANSFORM',
          objectId,
          position: updatedObj.position,
          rotation: updatedObj.rotation,
          scale: updatedObj.scale
        },
        lamportTime
      });

      webrtcService.broadcastMessage({
        type: 'transform-update',
        objectId,
        position: updatedObj.position,
        rotation: updatedObj.rotation,
        scale: updatedObj.scale,
        lamportTime,
        opId,
        from: this.clientId
      });
    },

    updateObjectColor(objectId, color) {
      const obj = this.yObjects.get(objectId);
      if (!obj) return;

      const lamportTime = this._tickLamport();
      const opId = this._generateOpId({ objectId }, lamportTime);

      Y.transact(this.ydoc, () => {
        this.yObjects.set(objectId, {
          ...obj,
          color,
          lamportTime,
          opId
        });
      });

      socketService.emit('scene-operation', {
        sceneId: this.sceneId,
        operation: {
          type: 'UPDATE_TRANSFORM',
          objectId,
          color
        },
        lamportTime
      });
    },

    updateObjectName(objectId, name) {
      const obj = this.yObjects.get(objectId);
      if (!obj) return;

      const lamportTime = this._tickLamport();
      const opId = this._generateOpId({ objectId }, lamportTime);

      Y.transact(this.ydoc, () => {
        this.yObjects.set(objectId, {
          ...obj,
          name,
          lamportTime,
          opId
        });
      });

      socketService.emit('scene-operation', {
        sceneId: this.sceneId,
        operation: {
          type: 'UPDATE_TRANSFORM',
          objectId,
          name
        },
        lamportTime
      });
    },

    deleteObject(objectId) {
      const lamportTime = this._tickLamport();

      Y.transact(this.ydoc, () => {
        this.yObjects.delete(objectId);
      });

      socketService.emit('scene-operation', {
        sceneId: this.sceneId,
        operation: {
          type: 'DELETE_OBJECT',
          objectId
        },
        lamportTime
      });

      if (this.selectedObjectId === objectId) {
        this.selectedObjectId = null;
      }
    },

    selectObject(objectId) {
      this.selectedObjectId = objectId;
    },

    async createSnapshot() {
      return new Promise((resolve, reject) => {
        socketService.emit('create-snapshot', this.sceneId);
        socketService.on('snapshot-success', resolve);
        socketService.on('snapshot-error', reject);
      });
    },

    async rollbackToVersion(version) {
      socketService.emit('rollback-version', {
        sceneId: this.sceneId,
        version
      });
    },

    async fetchSnapshots() {
      const response = await api.get(`/scenes/${this.sceneId}/snapshots`);
      this.snapshots = response.data;
      return this.snapshots;
    },

    setObjects(objects) {
      if (!this.ydoc || !this.yObjects) return;

      const lamportTime = this._tickLamport();
      
      Y.transact(this.ydoc, () => {
        this.yObjects.clear();
        objects.forEach(obj => {
          this.yObjects.set(obj.id, {
            ...obj,
            lamportTime,
            opId: this._generateOpId({ objectId: obj.id }, lamportTime)
          });
        });
      });
    },

    leaveScene() {
      webrtcService.leaveScene(this.sceneId);
      
      if (this.ydoc) {
        this.ydoc.destroy();
      }
      
      this.ydoc = null;
      this.yObjects = null;
      this.objects = [];
      this.selectedObjectId = null;
      this.sceneId = null;
      this.lamportTime = 0;
      this.seenOperations.clear();
    }
  },

  getters: {
    selectedObject: (state) => {
      return state.objects.find(o => o.id === state.selectedObjectId);
    }
  }
});
