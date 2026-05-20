const WebRTCManager = require('../webrtc/signaling');
const crdtManager = require('../crdt');

const setupSocket = (io) => {
  const webrtcManager = new WebRTCManager(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      socket.userId = token;
      next();
    } else {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId, socket.id);

    webrtcManager.handleConnection(socket);

    socket.on('scene-operation', async (data) => {
      const { sceneId, operation, lamportTime: clientLamport } = data;
      
      try {
        const result = await crdtManager.applyOperation(
          sceneId, 
          operation, 
          socket.userId,
          clientLamport || 0
        );

        if (!result.skipped) {
          socket.to(sceneId).emit('operation-broadcast', {
            operation,
            from: socket.userId,
            lamportTime: result.lamportTime,
            opId: result.opId
          });

          io.to(sceneId).emit('scene-state-update', result.state);
        }
      } catch (err) {
        console.error('Operation error:', err);
      }
    });

    socket.on('request-scene-state', async (sceneId) => {
      await crdtManager.loadSceneFromDB(sceneId);
      const state = crdtManager.getSceneState(sceneId);
      const lamportTime = crdtManager.getLamportTime(sceneId);
      
      socket.emit('scene-state-update', {
        objects: state,
        lamportTime,
        fullSync: true
      });
    });

    socket.on('create-snapshot', async (sceneId) => {
      try {
        const version = await crdtManager.createSnapshot(sceneId, socket.userId);
        io.to(sceneId).emit('snapshot-created', { version });
        socket.emit('snapshot-success', { version });
      } catch (err) {
        socket.emit('snapshot-error', { error: err.message });
      }
    });

    socket.on('rollback-version', async (data) => {
      const { sceneId, version } = data;
      try {
        const state = await crdtManager.rollbackToVersion(sceneId, version);
        io.to(sceneId).emit('scene-state-update', {
          objects: state,
          rollback: true,
          version
        });
        io.to(sceneId).emit('rollback-complete', { version });
      } catch (err) {
        socket.emit('rollback-error', { error: err.message });
      }
    });

    socket.on('get-snapshots', async (sceneId) => {
      try {
        const snapshots = await crdtManager.getSnapshots(sceneId);
        socket.emit('snapshots-list', snapshots);
      } catch (err) {
        socket.emit('snapshots-error', { error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
    });
  });
};

module.exports = setupSocket;
