class WebRTCManager {
  constructor(io) {
    this.io = io;
    this.audioRooms = new Map();
  }

  _getOrCreateRoom(sceneId) {
    if (!this.audioRooms.has(sceneId)) {
      this.audioRooms.set(sceneId, {
        participants: new Map(),
        speakers: new Set()
      });
    }
    return this.audioRooms.get(sceneId);
  }

  handleConnection(socket) {
    socket.on('webrtc-offer', (data) => {
      const { targetId, offer, sceneId, type } = data;
      socket.to(targetId).emit('webrtc-offer', {
        offer,
        from: socket.id,
        sceneId,
        type: type || 'data'
      });
    });

    socket.on('webrtc-answer', (data) => {
      const { targetId, answer } = data;
      socket.to(targetId).emit('webrtc-answer', {
        answer,
        from: socket.id
      });
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { targetId, candidate } = data;
      socket.to(targetId).emit('webrtc-ice-candidate', {
        candidate,
        from: socket.id
      });
    });

    socket.on('join-audio', (data) => {
      const { sceneId, userId, username } = data;
      const room = this._getOrCreateRoom(sceneId);
      
      room.participants.set(socket.id, {
        userId,
        username,
        speaking: false,
        muted: false
      });

      socket.join(`audio:${sceneId}`);
      socket.currentAudioRoom = sceneId;

      socket.to(`audio:${sceneId}`).emit('user-joined-audio', {
        userId,
        username,
        peerId: socket.id
      });

      const participantsList = Array.from(room.participants.entries()).map(([peerId, p]) => ({
        userId: p.userId,
        username: p.username,
        peerId,
        speaking: p.speaking,
        muted: p.muted
      }));

      socket.emit('audio-room-state', {
        participants: participantsList
      });
    });

    socket.on('leave-audio', (sceneId) => {
      this._removeUserFromAudioRoom(socket, sceneId);
    });

    socket.on('toggle-mute', (data) => {
      const { sceneId, muted } = data;
      const room = this.audioRooms.get(sceneId);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);
        participant.muted = muted;

        socket.to(`audio:${sceneId}`).emit('user-mute-changed', {
          userId: participant.userId,
          peerId: socket.id,
          muted
        });
      }
    });

    socket.on('speaking-state', (data) => {
      const { sceneId, speaking } = data;
      const room = this.audioRooms.get(sceneId);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);
        participant.speaking = speaking;

        if (speaking) {
          room.speakers.add(socket.id);
        } else {
          room.speakers.delete(socket.id);
        }

        socket.to(`audio:${sceneId}`).emit('user-speaking-changed', {
          userId: participant.userId,
          peerId: socket.id,
          speaking
        });
      }
    });

    socket.on('join-scene', (sceneId) => {
      socket.join(sceneId);
      
      const room = this.io.sockets.adapter.rooms.get(sceneId);
      const peersInRoom = room ? Array.from(room).filter(id => id !== socket.id) : [];
      
      socket.emit('scene-peers', {
        peers: peersInRoom,
        sceneId
      });

      socket.to(sceneId).emit('peer-joined', {
        peerId: socket.id,
        userId: socket.userId
      });
    });

    socket.on('leave-scene', (sceneId) => {
      socket.leave(sceneId);
      this._removeUserFromAudioRoom(socket, sceneId);
      socket.to(sceneId).emit('peer-left', {
        peerId: socket.id
      });
    });

    socket.on('disconnect', () => {
      if (socket.currentAudioRoom) {
        this._removeUserFromAudioRoom(socket, socket.currentAudioRoom);
      }
    });
  }

  _removeUserFromAudioRoom(socket, sceneId) {
    const room = this.audioRooms.get(sceneId);
    if (room && room.participants.has(socket.id)) {
      const participant = room.participants.get(socket.id);
      
      room.participants.delete(socket.id);
      room.speakers.delete(socket.id);
      
      socket.leave(`audio:${sceneId}`);

      socket.to(`audio:${sceneId}`).emit('user-left-audio', {
        userId: participant.userId,
        peerId: socket.id
      });

      if (room.participants.size === 0) {
        this.audioRooms.delete(sceneId);
      }

      if (socket.currentAudioRoom === sceneId) {
        socket.currentAudioRoom = null;
      }
    }
  }

  getRoomParticipants(sceneId) {
    const room = this.audioRooms.get(sceneId);
    if (!room) return [];
    
    return Array.from(room.participants.entries()).map(([peerId, p]) => ({
      userId: p.userId,
      username: p.username,
      peerId,
      speaking: p.speaking,
      muted: p.muted
    }));
  }
}

module.exports = WebRTCManager;
