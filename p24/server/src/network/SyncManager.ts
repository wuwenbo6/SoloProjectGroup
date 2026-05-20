import { World } from '../ecs/World';
import { DeltaCompressor, DeltaState, CompressedMessage } from './DeltaCompressor';
import { WebSocketServer } from './WebSocketServer';

interface SyncStats {
  totalBytesSent: number;
  totalDeltas: number;
  totalFullStates: number;
  totalUncompressedBytes: number;
  lastStatsTime: number;
}

export class SyncManager {
  private world: World;
  private compressor: DeltaCompressor;
  private server: WebSocketServer;
  private syncInterval: NodeJS.Timeout | null = null;
  private fullStateInterval: NodeJS.Timeout | null = null;
  private readonly syncRate = 30;
  private stats: SyncStats = {
    totalBytesSent: 0,
    totalDeltas: 0,
    totalFullStates: 0,
    totalUncompressedBytes: 0,
    lastStatsTime: Date.now()
  };
  private enableCompression: boolean = true;

  constructor(world: World, server: WebSocketServer) {
    this.world = world;
    this.compressor = new DeltaCompressor();
    this.server = server;
  }

  start(): void {
    this.syncInterval = setInterval(() => {
      this.broadcastDelta();
    }, 1000 / this.syncRate);

    this.fullStateInterval = setInterval(() => {
      this.broadcastFullState();
    }, 5000);

    setInterval(() => {
      this.logStats();
    }, 5000);
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.fullStateInterval) {
      clearInterval(this.fullStateInterval);
      this.fullStateInterval = null;
    }
  }

  private broadcastDelta(): void {
    const entities = this.world.getEntities();
    const deltas = this.compressor.computeDelta(entities);
    
    if (deltas.length > 0) {
      this.stats.totalDeltas++;

      if (this.enableCompression) {
        const uncompressed = JSON.stringify(deltas);
        this.stats.totalUncompressedBytes += Buffer.byteLength(uncompressed, 'utf-8');

        const compressed = this.compressor.compress(deltas);
        this.stats.totalBytesSent += compressed.data.length;
        
        this.server.broadcastBinary(compressed);
      } else {
        const data = JSON.stringify(deltas);
        this.stats.totalBytesSent += Buffer.byteLength(data, 'utf-8');
        this.stats.totalUncompressedBytes += Buffer.byteLength(data, 'utf-8');

        this.server.broadcast({
          type: 'delta',
          data: deltas
        });
      }
    }
  }

  private broadcastFullState(): void {
    const entities = this.world.getEntities();
    this.stats.totalFullStates++;

    if (this.enableCompression) {
      const fullState = this.compressor.getFullStateRaw(entities);
      const uncompressed = JSON.stringify(fullState);
      this.stats.totalUncompressedBytes += Buffer.byteLength(uncompressed, 'utf-8');

      const compressed = this.compressor.getFullState(entities);
      this.stats.totalBytesSent += compressed.data.length;
      
      this.server.broadcastBinary(compressed);
    } else {
      const fullState = this.compressor.getFullStateRaw(entities);
      const data = JSON.stringify(fullState);
      this.stats.totalBytesSent += Buffer.byteLength(data, 'utf-8');
      this.stats.totalUncompressedBytes += Buffer.byteLength(data, 'utf-8');

      this.server.broadcast({
        type: 'fullState',
        data: fullState
      });
    }
  }

  sendFullStateToClient(socketId: string): void {
    const entities = this.world.getEntities();

    if (this.enableCompression) {
      const fullState = this.compressor.getFullStateRaw(entities);
      const uncompressed = JSON.stringify(fullState);
      this.stats.totalUncompressedBytes += Buffer.byteLength(uncompressed, 'utf-8');

      const compressed = this.compressor.getFullState(entities);
      this.stats.totalBytesSent += compressed.data.length;

      this.server.sendBinaryToClient(socketId, compressed);
    } else {
      const fullState = this.compressor.getFullStateRaw(entities);
      const data = JSON.stringify(fullState);
      this.stats.totalBytesSent += Buffer.byteLength(data, 'utf-8');
      this.stats.totalUncompressedBytes += Buffer.byteLength(data, 'utf-8');

      this.server.sendToClient(socketId, {
        type: 'fullState',
        data: fullState
      });
    }
  }

  private logStats(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.stats.lastStatsTime) / 1000;

    if (elapsedSeconds > 0) {
      const bytesPerSecond = Math.round(this.stats.totalBytesSent / elapsedSeconds);
      const uncompressedPerSecond = Math.round(this.stats.totalUncompressedBytes / elapsedSeconds);
      const ratio = this.stats.totalUncompressedBytes > 0 
        ? (this.stats.totalBytesSent / this.stats.totalUncompressedBytes * 100).toFixed(1)
        : '100.0';

      console.log(`[SyncManager] 带宽统计:`);
      console.log(`  - 压缩后: ${(bytesPerSecond / 1024).toFixed(2)} KB/s`);
      console.log(`  - 原始大小: ${(uncompressedPerSecond / 1024).toFixed(2)} KB/s`);
      console.log(`  - 压缩比: ${ratio}%`);
      console.log(`  - 增量更新: ${this.stats.totalDeltas} 次`);
      console.log(`  - 全量同步: ${this.stats.totalFullStates} 次`);
      console.log(`  - 实体数量: ${this.world.getEntities().length}`);
    }

    this.stats.lastStatsTime = now;
    this.stats.totalBytesSent = 0;
    this.stats.totalUncompressedBytes = 0;
    this.stats.totalDeltas = 0;
    this.stats.totalFullStates = 0;
  }

  setCompressionEnabled(enabled: boolean): void {
    this.enableCompression = enabled;
    console.log(`[SyncManager] 压缩${enabled ? '已启用' : '已禁用'}`);
  }

  getCompressionStats(): { enabled: boolean; ratio: number } {
    const deltas = this.compressor.computeDelta(this.world.getEntities());
    const stats = this.compressor.getCompressionStats(deltas);
    
    return {
      enabled: this.enableCompression,
      ratio: stats.ratio
    };
  }
}
