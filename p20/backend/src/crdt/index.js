const Y = require('yjs');
const { pool } = require('../database');

class CRDTManager {
  constructor() {
    this.scenes = new Map();
    this.operationCache = new Map();
  }

  getSceneDoc(sceneId) {
    if (!this.scenes.has(sceneId)) {
      const ydoc = new Y.Doc();
      
      ydoc.guid = sceneId;
      
      this.scenes.set(sceneId, {
        doc: ydoc,
        objects: ydoc.getMap('objects'),
        transformOps: ydoc.getArray('transformOps'),
        lastSnapshot: 0,
        lamportTime: 0,
        vectorClock: new Map(),
        seenOperations: new Set()
      });
    }
    return this.scenes.get(sceneId);
  }

  _tickLamport(scene, remoteTime = 0) {
    scene.lamportTime = Math.max(scene.lamportTime, remoteTime) + 1;
    return scene.lamportTime;
  }

  _updateVectorClock(scene, userId, time) {
    const current = scene.vectorClock.get(userId) || 0;
    scene.vectorClock.set(userId, Math.max(current, time));
  }

  _generateOperationId(operation, userId, lamportTime) {
    return `${operation.objectId}-${userId}-${lamportTime}`;
  }

  _shouldApplyOperation(scene, opId) {
    if (scene.seenOperations.has(opId)) {
      return false;
    }
    scene.seenOperations.add(opId);
    if (scene.seenOperations.size > 10000) {
      const keys = Array.from(scene.seenOperations).slice(0, 5000);
      keys.forEach(k => scene.seenOperations.delete(k));
    }
    return true;
  }

  async applyOperation(sceneId, operation, userId, remoteLamportTime = 0) {
    const scene = this.getSceneDoc(sceneId);
    const { doc, objects } = scene;

    const lamportTime = this._tickLamport(scene, remoteLamportTime);
    this._updateVectorClock(scene, userId, lamportTime);

    const opId = this._generateOperationId(operation, userId, lamportTime);
    
    if (!this._shouldApplyOperation(scene, opId)) {
      return {
      state: this.getSceneState(sceneId),
      skipped: true,
      lamportTime
      };
    }

    Y.transact(doc, () => {
      switch (operation.type) {
        case 'ADD_OBJECT':
          objects.set(operation.objectId, {
            id: operation.objectId,
            type: operation.objectType,
            position: operation.position || { x: 0, y: 0, z: 0 },
            rotation: operation.rotation || { x: 0, y: 0, z: 0 },
            scale: operation.scale || { x: 1, y: 1, z: 1 },
            color: operation.color || '#ffffff',
            name: operation.name || 'Object',
            createdBy: userId,
            createdAt: Date.now(),
            lamportTime,
            opId
          });
          break;

        case 'UPDATE_TRANSFORM':
          const obj = objects.get(operation.objectId);
          if (obj) {
            const objLamport = obj.lamportTime || 0;
            
            if (lamportTime >= objLamport) {
              objects.set(operation.objectId, {
                ...obj,
                position: operation.position !== undefined ? operation.position : obj.position,
                rotation: operation.rotation !== undefined ? operation.rotation : obj.rotation,
                scale: operation.scale !== undefined ? operation.scale : obj.scale,
                color: operation.color !== undefined ? operation.color : obj.color,
                name: operation.name !== undefined ? operation.name : obj.name,
                updatedBy: userId,
                updatedAt: Date.now(),
                lamportTime,
                opId
              });
            }
          }
          break;

        case 'DELETE_OBJECT':
          objects.delete(operation.objectId);
          break;
      }
    }, userId);

    return {
      state: this.getSceneState(sceneId),
      lamportTime,
      opId,
      skipped: false
    };
  }

  getSceneState(sceneId) {
    const scene = this.getSceneDoc(sceneId);
    const objects = [];
    scene.objects.forEach((value, key) => {
      objects.push({ id: key, ...value });
    });
    return objects;
  }

  getLamportTime(sceneId) {
    const scene = this.getSceneDoc(sceneId);
    return scene.lamportTime;
  }

  getDocUpdate(sceneId) {
    const scene = this.getSceneDoc(sceneId);
    return Y.encodeStateAsUpdate(scene.doc);
  }

  applyDocUpdate(sceneId, update) {
    const scene = this.getSceneDoc(sceneId);
    Y.applyUpdate(scene.doc, update);
  }

  async createSnapshot(sceneId, userId) {
    const scene = this.getSceneDoc(sceneId);
    const state = this.getSceneState(sceneId);
    
    const result = await pool.query(
      'SELECT MAX(version) as max_version FROM scene_snapshots WHERE scene_id = $1',
      [sceneId]
    );
    
    const nextVersion = (result.rows[0].max_version || 0) + 1;
    
    await pool.query(
      `INSERT INTO scene_snapshots (scene_id, snapshot_data, version, created_by, lamport_time, vector_clock)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sceneId, 
        JSON.stringify(state), 
        nextVersion, 
        userId,
        scene.lamportTime,
        JSON.stringify(Array.from(scene.vectorClock.entries()))
      ]
    );

    scene.lastSnapshot = nextVersion;
    return nextVersion;
  }

  async rollbackToVersion(sceneId, version) {
    const result = await pool.query(
      'SELECT snapshot_data, lamport_time FROM scene_snapshots WHERE scene_id = $1 AND version = $2',
      [sceneId, version]
    );

    if (result.rows.length === 0) {
      throw new Error('Version not found');
    }

    const snapshotData = result.rows[0].snapshot_data;
    const snapshotLamport = result.rows[0].lamport_time || 0;
    const scene = this.getSceneDoc(sceneId);
    
    scene.lamportTime = Math.max(scene.lamportTime, snapshotLamport + 1);
    
    Y.transact(scene.doc, () => {
      scene.objects.clear();
      snapshotData.forEach(obj => {
        scene.objects.set(obj.id, {
          ...obj,
          lamportTime: scene.lamportTime
        });
      });
    });

    return this.getSceneState(sceneId);
  }

  async getSnapshots(sceneId) {
    const result = await pool.query(
      `SELECT id, version, created_at, created_by 
       FROM scene_snapshots 
       WHERE scene_id = $1 
       ORDER BY version DESC`,
      [sceneId]
    );
    return result.rows;
  }

  async loadSceneFromDB(sceneId) {
    const result = await pool.query(
      'SELECT snapshot_data, lamport_time FROM scene_snapshots WHERE scene_id = $1 ORDER BY version DESC LIMIT 1',
      [sceneId]
    );

    if (result.rows.length > 0) {
      const scene = this.getSceneDoc(sceneId);
      const snapshotData = result.rows[0].snapshot_data;
      const snapshotLamport = result.rows[0].lamport_time || 0;
      
      scene.lamportTime = Math.max(scene.lamportTime, snapshotLamport);
      
      Y.transact(scene.doc, () => {
        scene.objects.clear();
        snapshotData.forEach(obj => {
          scene.objects.set(obj.id, obj);
        });
      });
    }
  }
}

module.exports = new CRDTManager();
