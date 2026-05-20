const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { PuzzleEngine } = require('./puzzleEngine');

const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

class GameServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.rooms = new Map();
    this.clients = new Map();
    this.puzzleEngine = new PuzzleEngine();
    this.webrtcSignaling = new Map();
    
    this.setupHandlers();
  }

  setupHandlers() {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      this.clients.set(clientId, {
        ws,
        roomId: null,
        playerId: null,
        playerName: null
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.send(JSON.stringify({ type: 'connected', clientId }));
    });
  }

  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'create_room':
        await this.createRoom(clientId, message);
        break;
      case 'join_room':
        await this.joinRoom(clientId, message);
        break;
      case 'rejoin_room':
        await this.rejoinRoom(clientId, message);
        break;
      case 'leave_room':
        await this.leaveRoom(clientId);
        break;
      case 'list_rooms':
        await this.listRooms(clientId);
        break;
      case 'player_move':
        await this.handlePlayerMove(clientId, message);
        break;
      case 'camera_update':
        await this.handleCameraUpdate(clientId, message);
        break;
      case 'puzzle_action':
        await this.handlePuzzleAction(clientId, message);
        break;
      case 'get_puzzles':
        await this.getPuzzles(clientId);
        break;
      case 'get_puzzle_state':
        await this.getPuzzleState(clientId, message);
        break;
      case 'chat_message':
        this.handleChatMessage(clientId, message);
        break;
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        this.handleWebRTCSignaling(clientId, message);
        break;
      case 'start_voice_call':
        this.startVoiceCall(clientId);
        break;
      case 'end_voice_call':
        this.endVoiceCall(clientId);
        break;
    }
  }

  async createRoom(clientId, message) {
    const client = this.clients.get(clientId);
    if (client.roomId) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Already in a room'
      }));
      return;
    }

    const roomId = uuidv4().slice(0, 8);
    const roomName = message.roomName || 'Game Room';
    const playerName = message.playerName || 'Player';
    const playerId = uuidv4();
    const playerColor = PLAYER_COLORS[0];

    await db.createRoom(roomId, roomName, 4);
    await db.addPlayer(playerId, roomId, playerName, playerColor);
    await db.updateRoomPlayerCount(roomId, 1);
    await db.updateRoomStatus(roomId, 'waiting');
    
    await this.puzzleEngine.initializeRoomPuzzles(roomId);

    this.rooms.set(roomId, {
      id: roomId,
      players: new Map(),
      gameState: {
        sharedCamera: { x: 0, y: 0 }
      }
    });

    const room = this.rooms.get(roomId);
    room.players.set(clientId, {
      playerId,
      name: playerName,
      color: playerColor,
      x: 400,
      y: 300
    });

    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    const fullPuzzleState = await this.puzzleEngine.getPuzzleEngineState(roomId);

    client.ws.send(JSON.stringify({
      type: 'room_created',
      roomId,
      playerId,
      playerColor,
      players: Array.from(room.players.values()),
      fullState: {
        puzzleState: fullPuzzleState
      }
    }));

    await this.broadcastRoomState(roomId);
  }

  async joinRoom(clientId, message) {
    const client = this.clients.get(clientId);
    const roomId = message.roomId;
    const playerName = message.playerName || 'Player';

    const roomData = await db.getRoom(roomId);
    if (!roomData) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }

    if (roomData.current_players >= roomData.max_players) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room is full'
      }));
      return;
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        players: new Map(),
        gameState: {
          sharedCamera: { x: 0, y: 0 }
        }
      };
      this.rooms.set(roomId, room);
    }

    const playerId = uuidv4();
    const usedColors = Array.from(room.players.values()).map(p => p.color);
    const playerColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0];

    await db.addPlayer(playerId, roomId, playerName, playerColor);
    await db.updateRoomPlayerCount(roomId, roomData.current_players + 1);

    const existingPlayers = Array.from(room.players.values());
    
    room.players.set(clientId, {
      playerId,
      name: playerName,
      color: playerColor,
      x: 400,
      y: 300
    });

    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    const fullPuzzleState = await this.puzzleEngine.getPuzzleEngineState(roomId);

    client.ws.send(JSON.stringify({
      type: 'room_joined',
      roomId,
      playerId,
      playerColor,
      players: [...existingPlayers, {
        playerId,
        name: playerName,
        color: playerColor,
        x: 400,
        y: 300
      }],
      fullState: {
        puzzleState: fullPuzzleState
      }
    }));

    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      player: {
        playerId,
        name: playerName,
        color: playerColor,
        x: 400,
        y: 300
      }
    }, clientId);

    await this.broadcastRoomState(roomId);
  }

  async rejoinRoom(clientId, message) {
    const client = this.clients.get(clientId);
    const roomId = message.roomId;
    const playerId = message.playerId;
    const playerName = message.playerName || 'Player';

    const roomData = await db.getRoom(roomId);
    if (!roomData) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        players: new Map(),
        gameState: {
          sharedCamera: { x: 0, y: 0 }
        }
      };
      this.rooms.set(roomId, room);
    }

    const playerData = await db.getPlayer(playerId);
    let playerColor = playerData?.color || '#FF6B6B';
    
    const usedColors = Array.from(room.players.values()).map(p => p.color);
    if (usedColors.includes(playerColor)) {
      playerColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0];
    }

    const existingPlayers = Array.from(room.players.values());
    
    room.players.set(clientId, {
      playerId,
      name: playerName,
      color: playerColor,
      x: 400,
      y: 300
    });

    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    const fullPuzzleState = await this.puzzleEngine.getPuzzleEngineState(roomId);

    client.ws.send(JSON.stringify({
      type: 'rejoined_room',
      roomId,
      playerId,
      playerColor,
      players: [...existingPlayers, {
        playerId,
        name: playerName,
        color: playerColor,
        x: 400,
        y: 300
      }],
      fullState: {
        puzzleState: fullPuzzleState
      }
    }));

    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      player: {
        playerId,
        name: playerName,
        color: playerColor,
        x: 400,
        y: 300
      }
    }, clientId);

    await this.broadcastRoomState(roomId);
  }

  async leaveRoom(clientId) {
    const client = this.clients.get(clientId);
    if (!client || !client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (room) {
      room.players.delete(clientId);
      
      await db.removePlayer(client.playerId);
      
      const remainingPlayers = room.players.size;
      await db.updateRoomPlayerCount(client.roomId, remainingPlayers);

      if (remainingPlayers === 0) {
        this.rooms.delete(client.roomId);
        await db.deleteRoom(client.roomId);
      } else {
        this.broadcastToRoom(client.roomId, {
          type: 'player_left',
          playerId: client.playerId
        });
        await this.broadcastRoomState(client.roomId);
      }
    }

    client.roomId = null;
    client.playerId = null;
    client.playerName = null;
  }

  async handleDisconnect(clientId) {
    await this.leaveRoom(clientId);
    this.clients.delete(clientId);
  }

  async listRooms(clientId) {
    const client = this.clients.get(clientId);
    const rooms = await db.listRooms();
    
    client.ws.send(JSON.stringify({
      type: 'rooms_list',
      rooms
    }));
  }

  async handlePlayerMove(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (!room) return;

    const player = room.players.get(clientId);
    if (!player) return;

    player.x = message.x;
    player.y = message.y;

    await db.updatePlayerPosition(client.playerId, message.x, message.y);

    this.broadcastToRoom(client.roomId, {
      type: 'player_moved',
      playerId: client.playerId,
      x: message.x,
      y: message.y
    }, clientId);
  }

  async handleCameraUpdate(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (!room) return;

    room.gameState.sharedCamera = {
      x: message.x,
      y: message.y
    };

    await db.updateGameState(client.roomId, {
      shared_camera_x: message.x,
      shared_camera_y: message.y
    });

    this.broadcastToRoom(client.roomId, {
      type: 'camera_updated',
      x: message.x,
      y: message.y
    }, clientId);
  }

  async handlePuzzleAction(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const result = await this.puzzleEngine.handlePuzzleAction(
      client.roomId,
      message.puzzleId,
      message.action,
      message.payload || {}
    );

    client.ws.send(JSON.stringify({
      type: 'puzzle_result',
      ...result
    }));

    if (result.success && result.isSolved) {
      const score = 100;
      const timeSpent = 0;
      
      try {
        await db.updateLeaderboard(client.playerId, client.playerName, score, 1, timeSpent);
        await this.checkAndUnlockAchievements(client.playerId, client.roomId);
      } catch (achievementError) {
        console.error('Error updating achievements:', achievementError);
      }
    }

    if (result.success) {
      this.broadcastToRoom(client.roomId, {
        type: 'puzzle_updated',
        puzzleId: message.puzzleId,
        isSolved: result.isSolved,
        state: result.state
      }, clientId);
    }
  }

  async checkAndUnlockAchievements(playerId, roomId) {
    try {
      const leaderboard = await db.getLeaderboard(100);
      const playerStats = leaderboard.find(p => p.player_id === playerId);
      
      if (playerStats) {
        if (playerStats.puzzle_count >= 1) {
          await db.unlockAchievement(playerId, 'first_puzzle');
        }
        if (playerStats.puzzle_count >= 10) {
          await db.unlockAchievement(playerId, 'puzzle_master');
        }
        
        const unlockedCount = await db.getPlayerAchievements(playerId);
        const unlocked = unlockedCount.filter(a => a.unlocked).length;
        if (unlocked >= 5) {
          await db.unlockAchievement(playerId, 'collector');
        }
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }

  async getPuzzles(clientId) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const puzzles = await this.puzzleEngine.getAllRoomPuzzles(client.roomId);
    
    client.ws.send(JSON.stringify({
      type: 'puzzles_list',
      puzzles
    }));
  }

  async getPuzzleState(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const state = await this.puzzleEngine.getRoomPuzzleState(client.roomId, message.puzzleId);
    
    client.ws.send(JSON.stringify({
      type: 'puzzle_state',
      ...state
    }));
  }

  handleChatMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    this.broadcastToRoom(client.roomId, {
      type: 'chat_message',
      playerId: client.playerId,
      playerName: client.playerName,
      message: message.message,
      timestamp: Date.now()
    });
  }

  handleWebRTCSignaling(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (!room) return;

    if (message.targetId) {
      const targetClient = Array.from(room.players.entries())
        .find(([_, p]) => p.playerId === message.targetId);
      
      if (targetClient) {
        const [targetClientId] = targetClient;
        const target = this.clients.get(targetClientId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(JSON.stringify({
            type: message.type,
            fromId: client.playerId,
            fromName: client.playerName,
            data: message.data
          }));
        }
      }
    } else {
      this.broadcastToRoom(client.roomId, {
        type: message.type,
        fromId: client.playerId,
        fromName: client.playerName,
        data: message.data
      }, clientId);
    }
  }

  startVoiceCall(clientId) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (!room) return;

    const otherPlayers = Array.from(room.players.entries())
      .filter(([cid]) => cid !== clientId);

    otherPlayers.forEach(([targetClientId]) => {
      const target = this.clients.get(targetClientId);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify({
          type: 'voice_call_request',
          fromId: client.playerId,
          fromName: client.playerName
        }));
      }
    });
  }

  endVoiceCall(clientId) {
    const client = this.clients.get(clientId);
    if (!client.roomId) return;

    this.broadcastToRoom(client.roomId, {
      type: 'voice_call_ended',
      playerId: client.playerId
    });
  }

  broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    
    room.players.forEach((_, clientId) => {
      if (clientId !== excludeClientId) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      }
    });
  }

  async broadcastRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const roomData = await db.getRoom(roomId);
    const players = Array.from(room.players.values());
    const gameState = await db.getGameState(roomId);
    const puzzles = await this.puzzleEngine.getAllRoomPuzzles(roomId);

    const stateMessage = JSON.stringify({
      type: 'room_state',
      room: roomData,
      players,
      gameState,
      puzzles
    });

    room.players.forEach((_, clientId) => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(stateMessage);
      }
    });
  }
}

module.exports = GameServer;
