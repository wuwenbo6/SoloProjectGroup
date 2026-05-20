import socketService from './socket';

class WebRTCService {
  constructor() {
    this.connections = new Map();
    this.dataChannels = new Map();
    this.localPeerId = null;
    this.onMessageCallback = null;
    this.onPeerConnected = null;
  }

  init(peerId) {
    this.localPeerId = peerId;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    socketService.on('webrtc-offer', async (data) => {
      const { offer, from, sceneId } = data;
      await this.handleOffer(from, offer, sceneId);
    });

    socketService.on('webrtc-answer', async (data) => {
      const { answer, from } = data;
      await this.handleAnswer(from, answer);
    });

    socketService.on('webrtc-ice-candidate', async (data) => {
      const { candidate, from } = data;
      await this.handleIceCandidate(from, candidate);
    });

    socketService.on('peer-joined', (data) => {
      if (this.onPeerConnected) {
        this.onPeerConnected(data);
      }
    });

    socketService.on('scene-peers', (data) => {
      data.peers.forEach(peerId => {
        if (peerId !== this.localPeerId) {
          this.createConnection(peerId, true);
        }
      });
    });
  }

  async createConnection(peerId, isInitiator, sceneId = null) {
    if (this.connections.has(peerId)) {
      return this.connections.get(peerId);
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('webrtc-ice-candidate', {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    if (isInitiator) {
      const dataChannel = pc.createDataChannel('scene-data');
      this.setupDataChannel(dataChannel, peerId);
    }

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId);
    };

    this.connections.set(peerId, pc);

    if (isInitiator && sceneId) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketService.emit('webrtc-offer', {
        targetId: peerId,
        offer,
        sceneId
      });
    }

    return pc;
  }

  setupDataChannel(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log('Data channel open with', peerId);
    };

    dataChannel.onmessage = (event) => {
      if (this.onMessageCallback) {
        const message = JSON.parse(event.data);
        this.onMessageCallback(message, peerId);
      }
    };

    this.dataChannels.set(peerId, dataChannel);
  }

  async handleOffer(from, offer, sceneId) {
    const pc = await this.createConnection(from, false, sceneId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketService.emit('webrtc-answer', {
      targetId: from,
      answer
    });
  }

  async handleAnswer(from, answer) {
    const pc = this.connections.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleIceCandidate(from, candidate) {
    const pc = this.connections.get(from);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  broadcastMessage(message) {
    const msgStr = JSON.stringify(message);
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(msgStr);
      }
    });
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  joinScene(sceneId) {
    socketService.emit('join-scene', sceneId);
  }

  leaveScene(sceneId) {
    socketService.emit('leave-scene', sceneId);
    this.connections.forEach((pc) => pc.close());
    this.connections.clear();
    this.dataChannels.clear();
  }

  disconnect() {
    this.connections.forEach((pc) => pc.close());
    this.connections.clear();
    this.dataChannels.clear();
  }
}

export default new WebRTCService();
