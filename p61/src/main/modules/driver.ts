import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export interface ConnectionConfig {
  port: string;
  baudRate: number;
  typewriterModel: string;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  maxRetries?: number;
}

export interface ConnectionStats {
  connectionTime: number;
  bytesReceived: number;
  charactersReceived: number;
  retryCount: number;
  lastHeartbeat: number;
}

export class TypeWriterDriver extends EventEmitter {
  private port: SerialPort | null = null;
  private isConnected: boolean = false;
  private config: ConnectionConfig | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastDataTime: number = 0;
  private retryCount: number = 0;
  private isReconnecting: boolean = false;
  private stats: ConnectionStats = {
    connectionTime: 0,
    bytesReceived: 0,
    charactersReceived: 0,
    retryCount: 0,
    lastHeartbeat: 0
  };
  private connectionStartTime: number = 0;
  private buffer: Buffer = Buffer.alloc(0);

  constructor() {
    super();
  }

  async listPorts(): Promise<PortInfo[]> {
    try {
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId
      }));
    } catch (error) {
      console.error('Failed to list ports:', error);
      throw error;
    }
  }

  async connect(config: ConnectionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.config = {
          ...config,
          enableHeartbeat: config.enableHeartbeat ?? true,
          heartbeatInterval: config.heartbeatInterval ?? 5000,
          maxRetries: config.maxRetries ?? 5
        };

        this.port = new SerialPort({
          path: config.port,
          baudRate: config.baudRate,
          autoOpen: false
        });

        this.port.open((error) => {
          if (error) {
            reject(error);
            return;
          }

          this.isConnected = true;
          this.connectionStartTime = Date.now();
          this.retryCount = 0;
          this.stats.retryCount = 0;
          this.buffer = Buffer.alloc(0);
          
          this.setupDataListener();
          this.startHeartbeat();
          this.emit('connected', this.config);
          resolve();
        });

        this.port.on('error', (error) => {
          this.emit('error', error);
          this.handleConnectionError(error);
        });

        this.port.on('close', () => {
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          
          if (!this.isReconnecting) {
            this.attemptReconnect();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private startHeartbeat(): void {
    if (!this.config?.enableHeartbeat) return;

    this.stopHeartbeat();
    this.lastDataTime = Date.now();

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastData = now - this.lastDataTime;
      const interval = this.config?.heartbeatInterval || 5000;

      this.stats.lastHeartbeat = now;
      this.stats.connectionTime = Math.floor((now - this.connectionStartTime) / 1000);

      this.emit('heartbeat', {
        timestamp: now,
        connectionTime: this.stats.connectionTime,
        bytesReceived: this.stats.bytesReceived,
        charactersReceived: this.stats.charactersReceived
      });

      if (timeSinceLastData > interval * 3) {
        this.emit('warning', { message: '数据接收超时，可能连接中断' });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('Connection error:', error);
  }

  private async attemptReconnect(): Promise<void> {
    const maxRetries = this.config?.maxRetries || 5;
    
    if (this.retryCount >= maxRetries) {
      this.emit('reconnect-failed', { message: '达到最大重试次数，停止重连' });
      this.isReconnecting = false;
      return;
    }

    this.isReconnecting = true;
    this.retryCount++;
    this.stats.retryCount++;

    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
    
    this.emit('reconnecting', {
      attempt: this.retryCount,
      maxAttempts: maxRetries,
      delay
    });

    setTimeout(async () => {
      try {
        if (this.port && this.port.isOpen) {
          await this.disconnect();
        }
        
        if (this.config) {
          await this.connect(this.config);
          this.emit('reconnected', { attempt: this.retryCount });
          this.isReconnecting = false;
        }
      } catch (error) {
        this.emit('reconnect-error', { attempt: this.retryCount, error });
        this.isReconnecting = false;
        this.attemptReconnect();
      }
    }, delay);
  }

  private setupDataListener(): void {
    if (!this.port) return;

    this.port.on('data', (data: Buffer) => {
      this.lastDataTime = Date.now();
      this.stats.bytesReceived += data.length;
      
      this.buffer = Buffer.concat([this.buffer, data]);
      this.processBuffer();
    });
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      const charCode = this.buffer[0];
      this.buffer = this.buffer.subarray(1);

      if (this.validateCharacter(charCode)) {
        const char = this.mapCharacter(charCode);
        this.stats.charactersReceived++;
        
        this.emit('character', {
          char,
          charCode,
          timestamp: Date.now(),
          typewriterModel: this.config?.typewriterModel,
          valid: true
        });
      } else {
        this.emit('invalid-character', {
          charCode,
          timestamp: Date.now()
        });
      }
    }
  }

  private validateCharacter(charCode: number): boolean {
    if (charCode >= 32 && charCode <= 126) return true;
    if (charCode === 10 || charCode === 13) return true;
    if (charCode === 9) return true;
    
    return false;
  }

  private mapCharacter(charCode: number): string {
    switch (charCode) {
      case 10: return '\n';
      case 13: return '\r';
      case 9: return '\t';
      default: return String.fromCharCode(charCode);
    }
  }

  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isReconnecting = false;
      this.stopHeartbeat();
      
      if (this.port && this.isConnected) {
        this.port.close((error) => {
          if (error) {
            console.error('Error closing port:', error);
            reject(error);
            return;
          }
          this.isConnected = false;
          this.port = null;
          this.buffer = Buffer.alloc(0);
          resolve();
        });
      } else {
        this.isConnected = false;
        this.port = null;
        this.buffer = Buffer.alloc(0);
        resolve();
      }
    });
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getConfig(): ConnectionConfig | null {
    return this.config;
  }
}
