class WebRTCManager {
  constructor() {
    this.localStream = null;
    this.peerConnections = new Map();
    this.otherPlayers = new Set();
    this.isInCall = false;
    this.audioElements = new Map();
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];
    this.mediaConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        highpassFilter: true,
        typingNoiseDetection: true,
        sampleRate: 48000,
        channelCount: 1,
        latency: 0
      },
      video: false
    };
    this.rtcConfig = {
      iceServers: this.iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan'
    };
    this.offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
      voiceActivityDetection: true
    };
  }

  async startVoiceCall() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(this.mediaConstraints);
      
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.contentHint = 'speech';
      }
      
      this.isInCall = true;
      console.log('Voice call started with optimized audio settings');
      
      network.startVoiceCall();
      
      for (const playerId of this.otherPlayers) {
        await this.createOffer(playerId);
      }
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('无法访问麦克风，请检查权限设置');
      this.endVoiceCall();
    }
  }

  endVoiceCall() {
    this.isInCall = false;
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();
    
    this.audioElements.forEach((audioEl) => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (e) {}
    });
    this.audioElements.clear();
    
    network.endVoiceCall();
    console.log('Voice call ended');
  }

  async createOffer(targetId) {
    try {
      const pc = this.createPeerConnection(targetId);
      const offer = await pc.createOffer(this.offerOptions);
      
      const optimizedSDP = this.optimizeAudioSDP(offer.sdp);
      offer.sdp = optimizedSDP;
      
      await pc.setLocalDescription(offer);
      
      network.sendWebRTCOffer(targetId, offer);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(fromId, offer) {
    if (!this.isInCall) {
      console.log('Received offer but not in call, ignoring');
      return;
    }

    try {
      const pc = this.createPeerConnection(fromId);
      
      const optimizedOffer = {
        type: offer.type,
        sdp: this.optimizeAudioSDP(offer.sdp)
      };
      
      await pc.setRemoteDescription(new RTCSessionDescription(optimizedOffer));
      
      const answer = await pc.createAnswer();
      answer.sdp = this.optimizeAudioSDP(answer.sdp);
      
      await pc.setLocalDescription(answer);
      
      network.sendWebRTCAnswer(fromId, answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(fromId, answer) {
    try {
      const pc = this.peerConnections.get(fromId);
      if (pc) {
        const optimizedAnswer = {
          type: answer.type,
          sdp: this.optimizeAudioSDP(answer.sdp)
        };
        await pc.setRemoteDescription(new RTCSessionDescription(optimizedAnswer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(fromId, candidate) {
    try {
      const pc = this.peerConnections.get(fromId);
      if (pc && candidate && candidate.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  optimizeAudioSDP(sdp) {
    let optimizedSDP = sdp;
    
    optimizedSDP = optimizedSDP.replace(/a=rtpmap:(\d+) opus\/48000\/2/g, 
      'a=rtpmap:$1 opus/48000/2\r\na=fmtp:$1 maxplaybackrate=16000; sprop-maxcapturerate=16000; stereo=0; sprop-stereo=0; usedtx=1');
    
    optimizedSDP = optimizedSDP.replace(/a=rtcp-fb:(\d+) transport-cc\r\n/g, '');
    
    optimizedSDP = optimizedSDP.replace(/m=audio (\d+) UDP\/TLS\/RTP\/SAVPF ([\d\s]+)/g, 
      (match, port, codecs) => {
        const opusCodec = codecs.split(' ').find(c => {
          const match = sdp.match(new RegExp(`a=rtpmap:${c} (\\w+)`));
          return match && match[1].toLowerCase() === 'opus';
        });
        if (opusCodec) {
          return `m=audio ${port} UDP/TLS/RTP/SAVPF ${opusCodec}`;
        }
        return match;
      });
    
    optimizedSDP = optimizedSDP.replace(/a=mid:video[\s\S]*?(?=m=|$)/g, '');
    optimizedSDP = optimizedSDP.replace(/m=video[\s\S]*?(?=m=|$)/g, '');
    
    return optimizedSDP;
  }

  createPeerConnection(targetId) {
    if (this.peerConnections.has(targetId)) {
      return this.peerConnections.get(targetId);
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this.playRemoteAudio(targetId, remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        network.sendWebRTCIceCandidate(targetId, event.candidate);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${targetId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected' || 
          pc.iceConnectionState === 'failed') {
        this.handleConnectionFailed(targetId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${targetId}: ${pc.connectionState}`);
    };

    this.peerConnections.set(targetId, pc);
    return pc;
  }

  handleConnectionFailed(targetId) {
    console.log(`Connection failed with ${targetId}, attempting to reconnect...`);
    const pc = this.peerConnections.get(targetId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(targetId);
    }
    
    if (this.isInCall && this.otherPlayers.has(targetId)) {
      setTimeout(() => {
        if (this.isInCall) {
          this.createOffer(targetId);
        }
      }, 2000);
    }
  }

  playRemoteAudio(playerId, stream) {
    let audioElement = this.audioElements.get(playerId);
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = `audio-${playerId}`;
      audioElement.autoplay = true;
      audioElement.style.display = 'none';
      
      audioElement.setAttribute('playsinline', '');
      audioElement.setAttribute('webkit-playsinline', '');
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      filter.type = 'highpass';
      filter.frequency.value = 80;
      
      gainNode.gain.value = 1.0;
      
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      document.body.appendChild(audioElement);
      this.audioElements.set(playerId, audioElement);
    }
    audioElement.srcObject = stream;
    
    audioElement.play().catch(err => {
      console.log('Audio play error:', err);
    });
  }

  addPlayer(playerId) {
    this.otherPlayers.add(playerId);
    
    if (this.isInCall) {
      this.createOffer(playerId);
    }
  }

  removePlayer(playerId) {
    this.otherPlayers.delete(playerId);
    
    const pc = this.peerConnections.get(playerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(playerId);
    }
    
    const audioElement = this.audioElements.get(playerId);
    if (audioElement) {
      try {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElement.remove();
      } catch (e) {}
      this.audioElements.delete(playerId);
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  setVolume(playerId, volume) {
    const audioElement = this.audioElements.get(playerId);
    if (audioElement) {
      audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

const webrtc = new WebRTCManager();

function onWebRTCMessage(message) {
  switch (message.type) {
    case 'webrtc_offer':
      webrtc.handleOffer(message.fromId, message.data);
      break;
    case 'webrtc_answer':
      webrtc.handleAnswer(message.fromId, message.data);
      break;
    case 'webrtc_ice_candidate':
      webrtc.handleIceCandidate(message.fromId, message.data);
      break;
  }
}

function onVoiceCallRequest(message) {
  console.log(`Voice call request from ${message.fromName}`);
  if (webrtc.isInCall) {
    webrtc.addPlayer(message.fromId);
  }
}

function onVoiceCallEnded(message) {
  webrtc.removePlayer(message.playerId);
}
