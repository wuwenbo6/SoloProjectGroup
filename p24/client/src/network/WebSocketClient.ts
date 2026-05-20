export interface Position {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export interface Velocity {
  vx: number;
  vy: number;
  vz: number;
  angularVelocity: number;
}

export interface Health {
  current: number;
  max: number;
  shield: number;
}

export interface Cargo {
  capacity: number;
  items: Record<string, number>;
}

export interface Render {
  type: 'ship' | 'asteroid' | 'station' | 'projectile';
  color: string;
  size: number;
}

export interface GameEntity {
  id: string;
  position?: Position;
  velocity?: Velocity;
  health?: Health;
  cargo?: Cargo;
  render?: Render;
}

export interface DeltaField {
  fieldId: number;
  value: number | string | boolean | null;
}

export interface DeltaComponent {
  type: number;
  fields: DeltaField[];
}

export interface DeltaState {
  entityId: string;
  components: DeltaComponent[];
  removed: boolean;
  timestamp: number;
}

export type MessageHandler = (type: string, data: any) => void;

const enum ComponentType {
  POSITION = 1,
  VELOCITY = 2,
  HEALTH = 3,
  CARGO = 4,
  RENDER = 5,
}

const enum PositionField {
  X = 1,
  Y = 2,
  Z = 3,
  ROTATION = 4,
}

const enum VelocityField {
  VX = 1,
  VY = 2,
  VZ = 3,
  ANGULAR_VELOCITY = 4,
}

const enum HealthField {
  CURRENT = 1,
  MAX = 2,
  SHIELD = 3,
}

const enum CargoField {
  CAPACITY = 1,
  ITEM_BASE = 100,
}

const enum RenderField {
  TYPE = 1,
  COLOR = 2,
  SIZE = 3,
}

function hashItemName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return CargoField.ITEM_BASE + Math.abs(hash) % 10000;
}

const ITEM_NAME_TO_ID: Record<string, number> = {
  'iron': hashItemName('iron'),
  'gold': hashItemName('gold'),
};

const ITEM_ID_TO_NAME: Record<number, string> = {};
for (const [name, id] of Object.entries(ITEM_NAME_TO_ID)) {
  ITEM_ID_TO_NAME[id] = name;
}

console.log('Item hash mapping:', ITEM_NAME_TO_ID);

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private entities: Map<string, GameEntity> = new Map();
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting: boolean = false;
  private compressionSupported: boolean = true;
  private stats = {
    bytesReceived: 0,
    decompressedBytes: 0,
    messages: 0,
    lastLog: Date.now()
  };

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) return reject(new Error('Already connecting'));
      this.isConnecting = true;

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to server');
        this.isConnecting = false;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.stats.messages++;
          this.stats.bytesReceived += new Blob([event.data]).size;

          if (message.encoding === 'deflate') {
            this.handleCompressedMessage(message);
          } else {
            this.handleMessage(message);
          }

          this.maybeLogStats();
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from server');
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        reject(error);
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch(() => {});
    }, 3000);
  }

  private async handleCompressedMessage(message: any): Promise<void> {
    try {
      const compressedData = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
      const decompressed = await this.decompressData(compressedData);
      const data = JSON.parse(decompressed);

      this.stats.decompressedBytes += new Blob([decompressed]).size;

      switch (message.type) {
        case 'fullState':
          this.handleFullState(data);
          break;
        case 'delta':
          this.handleDelta(data);
          break;
      }

      this.handlers.forEach(handler => handler(message.type, data));
    } catch (error) {
      console.error('Error decompressing message:', error);
    }
  }

  private async decompressData(compressedData: Uint8Array): Promise<string> {
    try {
      const ds = new DecompressionStream('deflate');
      const blob = new Blob([compressedData]);
      const decompressedStream = blob.stream().pipeThrough(ds);
      const decompressedBlob = await new Response(decompressedStream).blob();
      return await decompressedBlob.text();
    } catch (error) {
      console.warn('Decompression failed, falling back to raw:', error);
      return '';
    }
  }

  private handleMessage(message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'fullState':
        this.handleFullState(data);
        break;
      case 'delta':
        this.handleDelta(data);
        break;
    }

    this.handlers.forEach(handler => handler(type, data));
  }

  private handleFullState(data: any): void {
    this.entities.clear();
    for (const entityData of data.entities) {
      this.entities.set(entityData.id, this.normalizeEntity(entityData));
    }
  }

  private normalizeEntity(data: any): GameEntity {
    const entity: GameEntity = { id: data.id };

    if (data[ComponentType.POSITION]) {
      entity.position = data[ComponentType.POSITION];
    }
    if (data[ComponentType.VELOCITY]) {
      entity.velocity = data[ComponentType.VELOCITY];
    }
    if (data[ComponentType.HEALTH]) {
      entity.health = data[ComponentType.HEALTH];
    }
    if (data[ComponentType.CARGO]) {
      entity.cargo = data[ComponentType.CARGO];
    }
    if (data[ComponentType.RENDER]) {
      entity.render = data[ComponentType.RENDER];
    }

    return entity;
  }

  private handleDelta(deltas: DeltaState[]): void {
    for (const delta of deltas) {
      if (delta.removed) {
        this.entities.delete(delta.entityId);
      } else {
        const entity = this.entities.get(delta.entityId) || { id: delta.entityId };
        this.applyDelta(entity, delta.components);
        this.entities.set(delta.entityId, entity);
      }
    }
  }

  private applyDelta(entity: GameEntity, components: DeltaComponent[]): void {
    for (const component of components) {
      switch (component.type) {
        case ComponentType.POSITION:
          entity.position = entity.position || { x: 0, y: 0, z: 0, rotation: 0 };
          for (const field of component.fields) {
            switch (field.fieldId) {
              case PositionField.X:
                entity.position.x = field.value as number;
                break;
              case PositionField.Y:
                entity.position.y = field.value as number;
                break;
              case PositionField.Z:
                entity.position.z = field.value as number;
                break;
              case PositionField.ROTATION:
                entity.position.rotation = field.value as number;
                break;
            }
          }
          break;

        case ComponentType.VELOCITY:
          entity.velocity = entity.velocity || { vx: 0, vy: 0, vz: 0, angularVelocity: 0 };
          for (const field of component.fields) {
            switch (field.fieldId) {
              case VelocityField.VX:
                entity.velocity.vx = field.value as number;
                break;
              case VelocityField.VY:
                entity.velocity.vy = field.value as number;
                break;
              case VelocityField.VZ:
                entity.velocity.vz = field.value as number;
                break;
              case VelocityField.ANGULAR_VELOCITY:
                entity.velocity.angularVelocity = field.value as number;
                break;
            }
          }
          break;

        case ComponentType.HEALTH:
          entity.health = entity.health || { current: 100, max: 100, shield: 0 };
          for (const field of component.fields) {
            switch (field.fieldId) {
              case HealthField.CURRENT:
                entity.health.current = field.value as number;
                break;
              case HealthField.MAX:
                entity.health.max = field.value as number;
                break;
              case HealthField.SHIELD:
                entity.health.shield = field.value as number;
                break;
            }
          }
          break;

        case ComponentType.CARGO:
          entity.cargo = entity.cargo || { capacity: 100, items: {} };
          for (const field of component.fields) {
            if (field.fieldId === CargoField.CAPACITY) {
              entity.cargo.capacity = field.value as number;
            } else if (field.fieldId >= CargoField.ITEM_BASE) {
              const itemName = ITEM_ID_TO_NAME[field.fieldId] || `item_${field.fieldId}`;
              if (field.value === null) {
                delete entity.cargo.items[itemName];
              } else {
                entity.cargo.items[itemName] = field.value as number;
              }
            }
          }
          break;

        case ComponentType.RENDER:
          entity.render = entity.render || { type: 'asteroid' as const, color: '#fff', size: 10 };
          for (const field of component.fields) {
            switch (field.fieldId) {
              case RenderField.TYPE:
                entity.render.type = field.value as any;
                break;
              case RenderField.COLOR:
                entity.render.color = field.value as string;
                break;
              case RenderField.SIZE:
                entity.render.size = field.value as number;
                break;
            }
          }
          break;
      }
    }
  }

  sendInput(input: {
    thrust: number;
    turn: number;
    isMining: boolean;
    isShooting: boolean;
  }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input',
        data: input
      }));
    }
  }

  getEntities(): Map<string, GameEntity> {
    return this.entities;
  }

  addHandler(handler: MessageHandler): void {
    this.handlers.add(handler);
  }

  removeHandler(handler: MessageHandler): void {
    this.handlers.delete(handler);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private maybeLogStats(): void {
    const now = Date.now();
    const elapsed = (now - this.stats.lastLog) / 1000;

    if (elapsed >= 5 && this.stats.bytesReceived > 0) {
      const bytesPerSec = Math.round(this.stats.bytesReceived / elapsed);
      const decompressedPerSec = Math.round(this.stats.decompressedBytes / elapsed);
      const ratio = this.stats.decompressedBytes > 0
        ? (this.stats.bytesReceived / this.stats.decompressedBytes * 100).toFixed(1)
        : '100.0';

      console.log(`[WebSocketClient] 带宽统计:`);
      console.log(`  - 接收: ${(bytesPerSec / 1024).toFixed(2)} KB/s`);
      console.log(`  - 解压后: ${(decompressedPerSec / 1024).toFixed(2)} KB/s`);
      console.log(`  - 压缩比: ${ratio}%`);
      console.log(`  - 消息数: ${this.stats.messages}`);
      console.log(`  - 实体数: ${this.entities.size}`);

      this.stats.lastLog = now;
      this.stats.bytesReceived = 0;
      this.stats.decompressedBytes = 0;
      this.stats.messages = 0;
    }
  }
}
