import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { WebSocketClient } from '../network/WebSocketClient';

export class GameManager {
  private game: Phaser.Game | null = null;
  private client: WebSocketClient;
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
    this.client = new WebSocketClient('ws://localhost:3001');
  }

  async start(): Promise<void> {
    await this.client.connect();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: window.innerWidth,
      height: window.innerHeight,
      scene: [new GameScene(this.client)],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 }
        }
      },
      render: {
        pixelArt: false,
        antialias: true
      }
    };

    this.game = new Phaser.Game(config);

    window.addEventListener('resize', () => {
      if (this.game) {
        this.game.scale.resize(window.innerWidth, window.innerHeight);
      }
    });
  }

  getClient(): WebSocketClient {
    return this.client;
  }

  stop(): void {
    this.client.disconnect();
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }
}
