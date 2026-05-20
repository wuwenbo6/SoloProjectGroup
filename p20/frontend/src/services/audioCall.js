import socketService from './socket';
import { ElMessage } from 'element-plus';

class AudioCallService {
  constructor() {
    this.peerConnections = new Map();
    this.localStream = null;
    this.audioElements = new Map();
    this.sceneId = null;
    this.userId = null;
    this.username = null;
    this.isJoined = false;
    this.isMuted = false;
    this.participants = new Map();
    this.listeners = new Map();
    this.audioWorker = null;
    this.workerSupported = typeof Worker !== 'undefined';
    this.lastSpeakingState = false;
    this.lastSpeakingUpdate = 0;
    this.speakingDebounce = 150;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  async init(sceneId, userId, username) {
    this.sceneId = sceneId;
    this.userId = userId;
    this.username = username;
    
    this._setupSocketListeners();
  }

  _setupSocketListeners() {
    socketService.on('webrtc-offer', async (data) => {
      if (data.type === 'audio') {
        await this._handleOffer(data);
      }
    });

    socketService.on('webrtc-answer', async (data) => {
      await this._handleAnswer(data);
    });

    socketService.on('webrtc-ice-candidate', async (data) => {
      await this._handleIceCandidate(data);
    });

    socketService.on('user-joined-audio', (data) => {
      this.participants.set(data.peerId, {
        userId: data.userId,
        username: data.username,
        speaking: false,
        muted: false
      });
      this.emit('participants-changed', Array.from(this.participants.values()));
      
      if (this.isJoined && this.localStream) {
        this._createPeerConnection(data.peerId, true);
      }
    });

    socketService.on('user-left-audio', (data) => {
      this.participants.delete(data.peerId);
      this._closePeerConnection(data.peerId);
      this.emit('participants-changed', Array.from(this.participants.values()));
    });

    socketService.on('user-mute-changed', (data) => {
      const participant = this.participants.get(data.peerId);
      if (participant) {
        participant.muted = data.muted;
        this.emit('participants-changed', Array.from(this.participants.values()));
      }
    });

    socketService.on('user-speaking-changed', (data) => {
      const participant = this.participants.get(data.peerId);
      if (participant) {
        participant.speaking = data.speaking;
        this.emit('participants-changed', Array.from(this.participants.values()));
      }
    });

    socketService.on('audio-room-state', (data) => {
      data.participants.forEach(p => {
        if (p.peerId !== socketService.socket?.id) {
          this.participants.set(p.peerId, p);
        }
      });
      this.emit('participants-changed', Array.from(this.participants.values()));
    });
  }

  async joinAudio() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });

      if (this.workerSupported) {
        await this._initAudioWorker();
      } else {
        console.warn('Web Workers not supported, using main thread VAD');
      }

      socketService.emit('join-audio', {
        sceneId: this.sceneId,
        userId: this.userId,
        username: this.username
      });

      this.isJoined = true;
      this.isMuted = false;
      this.emit('join-success');
      
      ElMessage.success('已加入语音通话');
      return true;
    } catch (error) {
      console.error('Failed to join audio:', error);
      ElMessage.error('无法访问麦克风，请检查权限设置');
      return false;
    }
  }

  async _initAudioWorker() {
    try {
      const workerBlob = new Blob([`
        let isProcessing = false;
        let isMuted = false;
        let silenceCounter = 0;
        let lastSpeakingState = false;
        let audioContext = null;
        let analyser = null;
        let source = null;
        let processInterval = null;

        const SPEAKING_THRESHOLD = 30;
        const SILENCE_THRESHOLD = 8;

        onmessage = (e) => {
          const { type, payload } = e.data;
          
          switch (type) {
            case 'init':
              init(payload.stream);
              break;
            case 'set-muted':
              isMuted = payload.muted;
              if (muted) {
                silenceCounter = SILENCE_THRESHOLD;
                if (lastSpeakingState) {
                  lastSpeakingState = false;
                  postMessage({ type: 'speaking-state', speaking: false, level: 0 });
                }
              }
              break;
            case 'stop':
              stop();
              break;
          }
        };

        function init(stream) {
          try {
            const AudioContextClass = self.AudioContext || self.webkitAudioContext;
            if (!AudioContextClass) {
              throw new Error('Web Audio API not supported');
            }

            audioContext = new AudioContextClass({ latencyHint: 'interactive' });
            source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.6;

            source.connect(analyser);
            isProcessing = true;
            startVAD();
            postMessage({ type: 'init-success' });
          } catch (error) {
            postMessage({ type: 'error', error: error.message });
          }
        }

        function startVAD() {
          if (!analyser) return;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const process = () => {
            if (!isProcessing) return;

            if (!isMuted) {
              analyser.getByteFrequencyData(dataArray);
              
              let sum = 0;
              const sampleCount = Math.min(30, dataArray.length);
              for (let i = 0; i < sampleCount; i++) {
                sum += dataArray[i];
              }
              const average = sum / sampleCount;

              let isSpeaking = false;
              if (average > SPEAKING_THRESHOLD) {
                isSpeaking = true;
                silenceCounter = 0;
              } else {
                silenceCounter++;
                if (silenceCounter < SILENCE_THRESHOLD) {
                  isSpeaking = lastSpeakingState;
                }
              }

              if (isSpeaking !== lastSpeakingState) {
                lastSpeakingState = isSpeaking;
                postMessage({ 
                  type: 'speaking-state', 
                  speaking: isSpeaking,
                  level: average
                });
              }
            }

            processInterval = setTimeout(process, 100);
          };

          process();
        }

        function stop() {
          isProcessing = false;
          if (processInterval) {
            clearTimeout(processInterval);
            processInterval = null;
          }
          if (audioContext) {
            audioContext.close();
            audioContext = null;
          }
          analyser = null;
          source = null;
          postMessage({ type: 'stopped' });
        }
      `], { type: 'application/javascript' });

      const workerUrl = URL.createObjectURL(workerBlob);
      this.audioWorker = new Worker(workerUrl);

      this.audioWorker.onmessage = (e) => {
        const { type, speaking, level } = e.data;
        if (type === 'speaking-state') {
          this._handleSpeakingState(speaking, level);
        }
      };

      this.audioWorker.onerror = (error) => {
        console.warn('Audio worker error:', error);
      };

      this.audioWorker.postMessage({ 
        type: 'init', 
        payload: { stream: this.localStream } 
      });

    } catch (error) {
      console.warn('Failed to init audio worker, falling back to main thread:', error);
    }
  }

  _handleSpeakingState(speaking, level) {
    const now = Date.now();
    if (now - this.lastSpeakingUpdate < this.speakingDebounce) {
      return;
    }

    if (speaking !== this.lastSpeakingState) {
      this.lastSpeakingState = speaking;
      this.lastSpeakingUpdate = now;
      
      socketService.emit('speaking-state', {
        sceneId: this.sceneId,
        speaking
      });
      
      this.emit('speaking-state', { speaking, level });
    }
  }

  _optimizePeerConnection(pc) {
    const config = pc.getConfiguration();
    
    config.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' }
    ];
    
    pc.setConfiguration(config);
  }

  async _createPeerConnection(peerId, isInitiator) {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId);
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    const pc = new RTCPeerConnection(configuration);

    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const sender = pc.addTrack(audioTrack, this.localStream);
        
        if (sender.setParameters) {
          const parameters = sender.getParameters();
          if (parameters.encodings && parameters.encodings.length > 0) {
            parameters.encodings[0].maxBitrate = 32000;
            parameters.encodings[0].maxFramerate = 48;
            try {
              sender.setParameters(parameters);
            } catch (e) {
            }
          }
        }
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('webrtc-ice-candidate', {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      this._handleRemoteTrack(peerId, event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this._closePeerConnection(peerId);
      }
    };

    this.peerConnections.set(peerId, pc);

    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
          voiceActivityDetection: true
        });
        await pc.setLocalDescription(offer);
        socketService.emit('webrtc-offer', {
          targetId: peerId,
          offer,
          sceneId: this.sceneId,
          type: 'audio'
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    return pc;
  }

  async _handleOffer(data) {
    const { offer, from } = data;
    
    if (!this.isJoined) return;
    
    const pc = await this._createPeerConnection(from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
      voiceActivityDetection: true
    });
    await pc.setLocalDescription(answer);
    
    socketService.emit('webrtc-answer', {
      targetId: from,
      answer
    });
  }

  async _handleAnswer(data) {
    const { answer, from } = data;
    const pc = this.peerConnections.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async _handleIceCandidate(data) {
    const { candidate, from } = data;
    const pc = this.peerConnections.get(from);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
      }
    }
  }

  _handleRemoteTrack(peerId, stream) {
    let audioEl = this.audioElements.get(peerId);
    
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      this.audioElements.set(peerId, audioEl);
    }
    
    audioEl.srcObject = stream;
  }

  _closePeerConnection(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    const audioEl = this.audioElements.get(peerId);
    if (audioEl) {
      audioEl.remove();
      this.audioElements.delete(peerId);
    }
  }

  toggleMute() {
    if (!this.localStream) return;
    
    this.isMuted = !this.isMuted;
    
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });

    if (this.audioWorker) {
      this.audioWorker.postMessage({ 
        type: 'set-muted', 
        payload: { muted: this.isMuted } 
      });
    }

    socketService.emit('toggle-mute', {
      sceneId: this.sceneId,
      muted: this.isMuted
    });

    this.emit('mute-changed', this.isMuted);
    
    return this.isMuted;
  }

  leaveAudio() {
    socketService.emit('leave-audio', this.sceneId);

    this.peerConnections.forEach((pc, peerId) => {
      this._closePeerConnection(peerId);
    });

    if (this.audioWorker) {
      this.audioWorker.postMessage({ type: 'stop' });
      this.audioWorker.terminate();
      this.audioWorker = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.participants.clear();
    this.isJoined = false;
    this.isMuted = false;
    this.lastSpeakingState = false;

    this.emit('left');
    this.emit('participants-changed', []);
    
    ElMessage.info('已离开语音通话');
  }

  destroy() {
    this.leaveAudio();
    this.listeners.clear();
  }
}

export default new AudioCallService();
