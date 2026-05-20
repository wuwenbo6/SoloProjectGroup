import { create } from 'zustand';
import { io } from 'socket.io-client';

class WebRTCManager {
  constructor() {
    this.socket = null;
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.userId = null;
    this.roomId = null;
    this.callbacks = new Set();
  }

  init(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;

    this.socket = io('http://localhost:8080');

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.socket.emit('join-room', { roomId, userId });
    });

    this.socket.on('user-joined', ({ userId: remoteUserId, socketId }) => {
      console.log('User joined:', remoteUserId);
      this.createPeerConnection(remoteUserId, true);
      this.notifyCallbacks({ type: 'user-joined', userId: remoteUserId });
    });

    this.socket.on('user-left', ({ userId: remoteUserId }) => {
      console.log('User left:', remoteUserId);
      this.closePeerConnection(remoteUserId);
      this.notifyCallbacks({ type: 'user-left', userId: remoteUserId });
    });

    this.socket.on('signal', async ({ from, signal }) => {
      console.log('Received signal from:', from);
      
      if (!this.peerConnections.has(from)) {
        this.createPeerConnection(from, false);
      }

      const pc = this.peerConnections.get(from);
      
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('signal', {
          to: from,
          from: this.userId,
          signal: pc.localDescription
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    this.socket.on('room-joined', ({ users, document, versions }) => {
      this.notifyCallbacks({
        type: 'room-joined',
        users,
        document,
        versions
      });
    });

    this.socket.on('document-saved', ({ document, version }) => {
      this.notifyCallbacks({
        type: 'document-saved',
        document,
        version
      });
    });

    this.socket.on('document-rolled-back', ({ document, version }) => {
      this.notifyCallbacks({
        type: 'document-rolled-back',
        document,
        version
      });
    });

    this.socket.on('versions-list', (versions) => {
      this.notifyCallbacks({
        type: 'versions-list',
        versions
      });
    });

    return this;
  }

  createPeerConnection(remoteUserId, isInitiator) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          to: remoteUserId,
          from: this.userId,
          signal: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', remoteUserId, pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.notifyCallbacks({
          type: 'peer-connected',
          userId: remoteUserId
        });
      }
    };

    if (isInitiator) {
      const dataChannel = pc.createDataChannel('sync-data');
      this.setupDataChannel(dataChannel, remoteUserId);
      
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          this.socket.emit('signal', {
            to: remoteUserId,
            from: this.userId,
            signal: pc.localDescription
          });
        });
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel, remoteUserId);
      };
    }

    this.peerConnections.set(remoteUserId, pc);
  }

  setupDataChannel(channel, remoteUserId) {
    channel.onopen = () => {
      console.log('Data channel opened with:', remoteUserId);
      this.dataChannels.set(remoteUserId, channel);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyCallbacks({
          type: 'data-message',
          from: remoteUserId,
          data
        });
      } catch (e) {
        console.error('Error parsing data channel message:', e);
      }
    };

    channel.onclose = () => {
      console.log('Data channel closed with:', remoteUserId);
      this.dataChannels.delete(remoteUserId);
    };
  }

  closePeerConnection(userId) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    this.dataChannels.delete(userId);
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(data);
      }
    });
  }

  sendTo(userId, message) {
    const channel = this.dataChannels.get(userId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(message));
    }
  }

  saveDocument(data) {
    this.socket.emit('save-document', {
      roomId: this.roomId,
      data,
      userId: this.userId
    });
  }

  rollbackVersion(versionId) {
    this.socket.emit('rollback-version', {
      roomId: this.roomId,
      versionId,
      userId: this.userId
    });
  }

  getVersions() {
    this.socket.emit('get-versions', { roomId: this.roomId });
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  notifyCallbacks(event) {
    this.callbacks.forEach(cb => cb(event));
  }

  destroy() {
    this.socket.emit('leave-room', {
      roomId: this.roomId,
      userId: this.userId
    });
    
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.socket.disconnect();
    this.callbacks.clear();
  }
}

export const webrtcManager = new WebRTCManager();

export const useWebRTCStore = create((set, get) => ({
  connectedUsers: [],
  isConnected: false,
  versions: [],

  init: (roomId, userId) => {
    webrtcManager.init(roomId, userId);
    
    webrtcManager.subscribe((event) => {
      if (event.type === 'user-joined') {
        set(state => ({
          connectedUsers: [...new Set([...state.connectedUsers, event.userId])]
        }));
      } else if (event.type === 'user-left') {
        set(state => ({
          connectedUsers: state.connectedUsers.filter(id => id !== event.userId)
        }));
      } else if (event.type === 'room-joined') {
        set({
          connectedUsers: event.users,
          isConnected: true,
          versions: event.versions
        });
      } else if (event.type === 'versions-list') {
        set({ versions: event.versions });
      }
    });
  },

  broadcast: (message) => {
    webrtcManager.broadcast(message);
  },

  saveDocument: (data) => {
    webrtcManager.saveDocument(data);
  },

  rollbackVersion: (versionId) => {
    webrtcManager.rollbackVersion(versionId);
  },

  getVersions: () => {
    webrtcManager.getVersions();
  },

  destroy: () => {
    webrtcManager.destroy();
    set({ connectedUsers: [], isConnected: false });
  }
}));
