class Network {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.playerId = null;
    this.roomId = null;
    this.playerName = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isReconnecting = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}?clientId=${this.clientId || ''}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to server');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.emit('connected');
        
        if (this.roomId && this.playerId) {
          this.rejoinRoom();
        }
        
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from server');
        this.emit('disconnected');
        
        if (!this.isReconnecting) {
          this.attemptReconnect();
        }
      };
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      this.connect().catch(() => {
        console.log('Reconnect failed, will retry');
      });
    }, delay);
  }

  rejoinRoom() {
    console.log('Rejoining room:', this.roomId, 'as player:', this.playerId);
    this.send('rejoin_room', {
      roomId: this.roomId,
      playerId: this.playerId,
      playerName: this.playerName
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        break;
      case 'room_created':
        this.roomId = message.roomId;
        this.playerId = message.playerId;
        roomId = message.roomId;
        if (message.fullState && message.fullState.puzzleState) {
          this.syncFullPuzzleState(message.fullState.puzzleState);
        }
        if (typeof onRoomCreated === 'function') {
          onRoomCreated(message);
        }
        break;
      case 'room_joined':
        this.roomId = message.roomId;
        this.playerId = message.playerId;
        roomId = message.roomId;
        if (message.fullState && message.fullState.puzzleState) {
          this.syncFullPuzzleState(message.fullState.puzzleState);
        }
        if (typeof onRoomJoined === 'function') {
          onRoomJoined(message);
        }
        break;
      case 'rejoined_room':
        this.roomId = message.roomId;
        this.playerId = message.playerId;
        roomId = message.roomId;
        if (message.fullState && message.fullState.puzzleState) {
          this.syncFullPuzzleState(message.fullState.puzzleState);
        }
        if (typeof onRejoinedRoom === 'function') {
          onRejoinedRoom(message);
        }
        break;
      case 'room_state':
        if (typeof onRoomState === 'function') {
          onRoomState(message);
        }
        break;
      case 'player_joined':
        if (typeof onPlayerJoined === 'function') {
          onPlayerJoined(message.player);
        }
        break;
      case 'player_left':
        if (typeof onPlayerLeft === 'function') {
          onPlayerLeft(message.playerId);
        }
        break;
      case 'player_moved':
        if (typeof onPlayerMoved === 'function') {
          onPlayerMoved(message);
        }
        break;
      case 'camera_updated':
        if (typeof onCameraUpdated === 'function') {
          onCameraUpdated(message);
        }
        break;
      case 'rooms_list':
        displayRooms(message.rooms);
        break;
      case 'puzzles_list':
        updatePuzzleList(message.puzzles);
        break;
      case 'puzzle_state':
        if (typeof onPuzzleState === 'function') {
          onPuzzleState(message);
        }
        displayPuzzle(message);
        break;
      case 'puzzle_result':
        if (typeof onPuzzleResult === 'function') {
          onPuzzleResult(message);
        }
        break;
      case 'puzzle_updated':
        if (typeof onPuzzleUpdated === 'function') {
          onPuzzleUpdated(message);
        }
        break;
      case 'chat_message':
        addChatMessage(message.playerName, message.message);
        break;
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        if (typeof onWebRTCMessage === 'function') {
          onWebRTCMessage(message);
        }
        break;
      case 'voice_call_request':
        if (typeof onVoiceCallRequest === 'function') {
          onVoiceCallRequest(message);
        }
        break;
      case 'voice_call_ended':
        if (typeof onVoiceCallEnded === 'function') {
          onVoiceCallEnded(message);
        }
        break;
      case 'error':
        alert(message.message);
        break;
    }
  }

  send(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  createRoom(playerName, roomName = 'Game Room') {
    this.playerName = playerName;
    this.send('create_room', { playerName, roomName });
  }

  joinRoom(roomId, playerName) {
    this.playerName = playerName;
    this.send('join_room', { roomId, playerName });
  }

  leaveRoom() {
    this.send('leave_room');
  }

  listRooms() {
    this.send('list_rooms');
  }

  sendPlayerMove(x, y) {
    this.send('player_move', { x, y });
  }

  sendCameraUpdate(x, y) {
    this.send('camera_update', { x, y });
  }

  getPuzzles() {
    this.send('get_puzzles');
  }

  getPuzzleState(puzzleId) {
    this.send('get_puzzle_state', { puzzleId });
  }

  sendPuzzleAction(puzzleId, action, payload = {}) {
    this.send('puzzle_action', { puzzleId, action, payload });
  }

  sendChatMessage(message) {
    this.send('chat_message', { message });
  }

  sendWebRTCOffer(targetId, offer) {
    this.send('webrtc_offer', { targetId, data: offer });
  }

  sendWebRTCAnswer(targetId, answer) {
    this.send('webrtc_answer', { targetId, data: answer });
  }

  sendWebRTCIceCandidate(targetId, candidate) {
    this.send('webrtc_ice_candidate', { targetId, data: candidate });
  }

  startVoiceCall() {
    this.send('start_voice_call');
  }

  endVoiceCall() {
    this.send('end_voice_call');
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  syncFullPuzzleState(puzzleState) {
    if (typeof onFullPuzzleStateSync === 'function') {
      onFullPuzzleStateSync(puzzleState);
    }
  }
}

const network = new Network();
network.connect();
