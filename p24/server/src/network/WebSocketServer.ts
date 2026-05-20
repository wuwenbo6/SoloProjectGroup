import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Health } from '../components/Health';
import { Cargo } from '../components/Cargo';
import { Render } from '../components/Render';
import { Input } from '../components/Input';
import { PlayerFaction } from '../components/PlayerFaction';
import { FactionManager } from '../managers/FactionManager';
import { SyncManager } from './SyncManager';
import { CompressedMessage } from './DeltaCompressor';

export interface ClientMessage {
  type: string;
  data: any;
}

export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private syncManager: SyncManager;
  private players: Map<string, Entity> = new Map();
  private factionManager: FactionManager;

  constructor(port: number, world: World, factionManager: FactionManager) {
    this.world = world;
    this.factionManager = factionManager;
    this.wss = new WSServer({ port });
    this.syncManager = new SyncManager(world, this);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const socketId = this.generateSocketId();
      (ws as any).id = socketId;

      console.log(`Client connected: ${socketId}`);

      const player = this.createPlayer(socketId);
      this.players.set(socketId, player);

      this.syncManager.sendFullStateToClient(socketId);

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          this.handleMessage(socketId, message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${socketId}`);
        const player = this.players.get(socketId);
        if (player) {
          this.world.removeEntity(player.id);
          this.players.delete(socketId);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${socketId}:`, error);
      });
    });

    this.syncManager.start();
  }

  private generateSocketId(): string {
    return 'socket_' + Math.random().toString(36).substr(2, 9);
  }

  private createPlayer(socketId: string): Entity {
    const player = new Entity();
    player.addComponent(new Position(
      Math.random() * 800 - 400,
      Math.random() * 600 - 300,
      0,
      0
    ));
    player.addComponent(new Velocity());
    player.addComponent(new Health());
    player.addComponent(new Cargo());
    player.addComponent(new Render('ship', '#00ff88', 30));
    player.addComponent(new Input());

    this.world.addEntity(player);
    return player;
  }

  private handleMessage(socketId: string, message: ClientMessage): void {
    const player = this.players.get(socketId);
    if (!player) return;

    switch (message.type) {
      case 'input':
        const input = player.getComponent(Input);
        if (input) {
          input.thrust = message.data.thrust || 0;
          input.turn = message.data.turn || 0;
          input.isMining = message.data.isMining || false;
          input.isShooting = message.data.isShooting || false;
        }
        break;

      case 'faction:create':
        this.handleCreateFaction(socketId, message.data);
        break;

      case 'faction:disband':
        this.handleDisbandFaction(socketId, message.data);
        break;

      case 'faction:join':
        this.handleJoinFaction(socketId, message.data);
        break;

      case 'faction:leave':
        this.handleLeaveFaction(socketId);
        break;

      case 'faction:declareWar':
        this.handleDeclareWar(socketId, message.data);
        break;

      case 'faction:list':
        this.handleListFactions(socketId);
        break;
    }
  }

  private handleCreateFaction(socketId: string, data: any): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const faction = this.factionManager.createFaction(data.name, player.id);
    if (faction) {
      this.sendToClient(socketId, {
        type: 'faction:created',
        data: {
          factionId: faction.id,
          name: faction.name,
          members: Array.from(faction.members.keys())
        }
      });
    } else {
      this.sendToClient(socketId, {
        type: 'faction:error',
        data: { message: 'Failed to create faction. You may already be in a faction.' }
      });
    }
  }

  private handleDisbandFaction(socketId: string, data: any): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const success = this.factionManager.disbandFaction(data.factionId, player.id);
    if (success) {
      this.sendToClient(socketId, {
        type: 'faction:disbanded',
        data: { factionId: data.factionId }
      });
    } else {
      this.sendToClient(socketId, {
        type: 'faction:error',
        data: { message: 'Failed to disband faction. You may not be the leader.' }
      });
    }
  }

  private handleJoinFaction(socketId: string, data: any): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const success = this.factionManager.joinFaction(data.factionId, player.id);
    if (success) {
      const faction = this.factionManager.getFaction(data.factionId);
      this.sendToClient(socketId, {
        type: 'faction:joined',
        data: {
          factionId: data.factionId,
          name: faction?.name,
          members: Array.from(faction?.members.keys() || [])
        }
      });
    } else {
      this.sendToClient(socketId, {
        type: 'faction:error',
        data: { message: 'Failed to join faction. You may already be in a faction.' }
      });
    }
  }

  private handleLeaveFaction(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const success = this.factionManager.leaveFaction(player.id);
    if (success) {
      this.sendToClient(socketId, {
        type: 'faction:left',
        data: {}
      });
    } else {
      this.sendToClient(socketId, {
        type: 'faction:error',
        data: { message: 'Failed to leave faction.' }
      });
    }
  }

  private handleDeclareWar(socketId: string, data: any): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const attackerFactionId = this.factionManager.getPlayerFactionId(player.id);
    if (!attackerFactionId) {
      this.sendToClient(socketId, {
        type: 'faction:error',
        data: { message: 'You are not in a faction.' }
      });
      return;
    }

    const war = this.factionManager.declareWar(attackerFactionId, data.defenderFactionId, player.id);
    if (war) {
      this.broadcast({
        type: 'faction:warDeclared',
        data: {
          warId: war.warId,
          attacker: war.attackerFactionId,
          defender: war.defenderFactionId,
          startTime: war.startTime
        }
      });
    } else {
      this.sendToClient(socketId, {
        type: 'faction:error',
        data: { message: 'Failed to declare war.' }
      });
    }
  }

  private handleListFactions(socketId: string): void {
    const factions = this.factionManager.getAllFactions();
    const wars = this.factionManager.getActiveWars();

    this.sendToClient(socketId, {
      type: 'faction:list',
      data: {
        factions: factions.map(f => ({
          id: f.id,
          name: f.name,
          memberCount: f.getMemberCount(),
          stationCount: f.getStationCount(),
          warScore: f.warScore
        })),
        activeWars: wars.map(w => ({
          warId: w.warId,
          attacker: w.attackerFactionId,
          defender: w.defenderFactionId,
          startTime: w.startTime
        }))
      }
    });
  }

  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  sendToClient(socketId: string, message: any): void {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if ((client as any).id === socketId && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  broadcastBinary(compressed: CompressedMessage): void {
    const payload = JSON.stringify({
      type: compressed.type,
      encoding: compressed.encoding,
      data: compressed.data.toString('base64')
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  sendBinaryToClient(socketId: string, compressed: CompressedMessage): void {
    const payload = JSON.stringify({
      type: compressed.type,
      encoding: compressed.encoding,
      data: compressed.data.toString('base64')
    });

    this.wss.clients.forEach((client) => {
      if ((client as any).id === socketId && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  stop(): void {
    this.syncManager.stop();
    this.wss.close();
  }
}
