import { ParticleData } from '../types';

interface ServerMessage {
  type: 'particle_sync' | 'particle_death' | 'full_sync';
  particles?: ParticleData[];
  particleId?: string;
  timestamp: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;

  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onParticlesSyncCallback?: (particles: ParticleData[]) => void;
  private onParticleDeathCallback?: (particleId: string) => void;
  private onFullSyncCallback?: (particles: ParticleData[]) => void;

  constructor(url: string = 'ws://localhost:3001/ws') {
    this.url = url;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectCallback?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.onDisconnectCallback?.();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'particle_sync':
        if (message.particles) {
          this.onParticlesSyncCallback?.(message.particles);
        }
        break;
      case 'particle_death':
        if (message.particleId) {
          this.onParticleDeathCallback?.(message.particleId);
        }
        break;
      case 'full_sync':
        if (message.particles) {
          this.onFullSyncCallback?.(message.particles);
        }
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendParticleUpdate(particles: ParticleData[]): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const message = {
        type: 'particle_update',
        particles,
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending particle update:', error);
    }
  }

  requestSync(): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const message = {
        type: 'sync_request',
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error requesting sync:', error);
    }
  }

  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  onParticlesSync(callback: (particles: ParticleData[]) => void): void {
    this.onParticlesSyncCallback = callback;
  }

  onParticleDeath(callback: (particleId: string) => void): void {
    this.onParticleDeathCallback = callback;
  }

  onFullSync(callback: (particles: ParticleData[]) => void): void {
    this.onFullSyncCallback = callback;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
