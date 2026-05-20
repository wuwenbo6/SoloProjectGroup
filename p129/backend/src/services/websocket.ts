import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface ParticleData {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  state: 'foraging' | 'attacking' | 'reproducing' | 'sleeping';
  energy: number;
  isDead?: boolean;
}

interface ClientMessage {
  type: 'particle_update' | 'sync_request';
  particles?: ParticleData[];
}

interface ServerMessage {
  type: 'particle_sync' | 'particle_death' | 'full_sync';
  particles?: ParticleData[];
  particleId?: string;
  timestamp: number;
}

const clients = new Set<WebSocket>();
let particleState = new Map<string, ParticleData>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('New client connected');
    clients.add(ws);

    const fullSync: ServerMessage = {
      type: 'full_sync',
      particles: Array.from(particleState.values()),
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(fullSync));

    ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        
        if (message.type === 'particle_update' && message.particles) {
          const deadParticleIds: string[] = [];
          const aliveParticles: ParticleData[] = [];
          
          for (const particle of message.particles) {
            if (particle.isDead) {
              particleState.delete(particle.id);
              deadParticleIds.push(particle.id);
            } else {
              particleState.set(particle.id, particle);
              aliveParticles.push(particle);
            }
          }
          
          if (aliveParticles.length > 0) {
            broadcastParticles(aliveParticles);
          }
          
          for (const deadId of deadParticleIds) {
            broadcastDeath(deadId);
          }
        } else if (message.type === 'sync_request') {
          const sync: ServerMessage = {
            type: 'full_sync',
            particles: Array.from(particleState.values()),
            timestamp: Date.now(),
          };
          safeSend(ws, sync);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  console.log('WebSocket server setup complete');
}

function safeSend(ws: WebSocket, message: ServerMessage): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  try {
    const messageStr = JSON.stringify(message);
    ws.send(messageStr, (error) => {
      if (error) {
        console.error('WebSocket send error:', error);
      }
    });
    return true;
  } catch (error) {
    console.error('Error serializing or sending message:', error);
    return false;
  }
}

function broadcastParticles(particles: ParticleData[]) {
  const message: ServerMessage = {
    type: 'particle_sync',
    particles,
    timestamp: Date.now(),
  };
  
  let successCount = 0;
  let failCount = 0;
  
  for (const client of clients) {
    if (safeSend(client, message)) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  if (failCount > 0) {
    console.log(`Broadcast particles: ${successCount} success, ${failCount} failed`);
  }
}

function broadcastDeath(particleId: string) {
  const message: ServerMessage = {
    type: 'particle_death',
    particleId,
    timestamp: Date.now(),
  };
  
  console.log(`Broadcasting death for particle: ${particleId} to ${clients.size} clients`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const client of clients) {
    if (safeSend(client, message)) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`Death broadcast: ${successCount} success, ${failCount} failed`);
}

export function getParticleCount() {
  return particleState.size;
}

export function getParticleStats() {
  const particles = Array.from(particleState.values());
  return {
    total: particles.length,
    foraging: particles.filter(p => p.state === 'foraging').length,
    attacking: particles.filter(p => p.state === 'attacking').length,
    reproducing: particles.filter(p => p.state === 'reproducing').length,
    sleeping: particles.filter(p => p.state === 'sleeping').length,
    averageEnergy: particles.length > 0 
      ? particles.reduce((sum, p) => sum + (p.energy || 100), 0) / particles.length 
      : 0,
  };
}
