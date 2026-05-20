import Phaser from 'phaser';
import { WebSocketClient, GameEntity } from '../network/WebSocketClient';

export class GameScene extends Phaser.Scene {
  private client: WebSocketClient;
  private gameObjects: Map<string, Phaser.GameObjects.Container> = new Map();
  private camera: Phaser.Cameras.Scene2D.Camera;
  private keys: { [key: string]: Phaser.Input.Keyboard.Key };
  private playerId: string | null = null;
  private isMining: boolean = false;

  constructor(client: WebSocketClient) {
    super('GameScene');
    this.client = client;
  }

  preload(): void {}

  create(): void {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x0a0a1a);

    this.createStarfield();

    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      UP: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      M: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M)
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.client.sendInput({
          thrust: this.getThrustInput(),
          turn: this.getTurnInput(),
          isMining: this.isMining,
          isShooting: true
        });
      }
    });

    this.input.on('pointerup', () => {
      this.client.sendInput({
        thrust: this.getThrustInput(),
        turn: this.getTurnInput(),
        isMining: this.isMining,
        isShooting: false
      });
    });

    this.client.addHandler((type) => {
      if (type === 'fullState') {
        this.findPlayer();
      }
    });
  }

  private createStarfield(): void {
    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(-2000, 2000);
      const y = Phaser.Math.Between(-2000, 2000);
      const size = Phaser.Math.FloatBetween(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.3, 1);
      
      this.add.circle(x, y, size, 0xffffff, alpha)
        .setScrollFactor(Phaser.Math.FloatBetween(0.2, 0.8));
    }
  }

  private findPlayer(): void {
    if (this.playerId) return;
    
    const entities = this.client.getEntities();
    for (const [id, entity] of entities) {
      if (entity.render?.type === 'ship') {
        this.playerId = id;
        break;
      }
    }
  }

  update(): void {
    this.sendInput();
    this.updateEntities();
    this.followPlayer();
  }

  private sendInput(): void {
    const thrust = this.getThrustInput();
    const turn = this.getTurnInput();

    if (this.keys.M.isDown && !this.isMining) {
      this.isMining = true;
    } else if (this.keys.M.isUp && this.isMining) {
      this.isMining = false;
    }

    this.client.sendInput({
      thrust,
      turn,
      isMining: this.isMining,
      isShooting: this.input.activePointer.leftButtonDown()
    });
  }

  private getThrustInput(): number {
    if (this.keys.W.isDown || this.keys.UP.isDown) return 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) return -1;
    return 0;
  }

  private getTurnInput(): number {
    if (this.keys.A.isDown || this.keys.LEFT.isDown) return -1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) return 1;
    return 0;
  }

  private updateEntities(): void {
    const entities = this.client.getEntities();
    
    for (const [id, entity] of entities) {
      this.updateEntity(id, entity);
    }

    for (const id of this.gameObjects.keys()) {
      if (!entities.has(id)) {
        this.gameObjects.get(id)?.destroy();
        this.gameObjects.delete(id);
      }
    }
  }

  private updateEntity(id: string, entity: GameEntity): void {
    let container = this.gameObjects.get(id);

    if (!container) {
      container = this.createGameObject(entity);
      this.gameObjects.set(id, container);
    }

    if (entity.position) {
      container.setPosition(entity.position.x, entity.position.y);
      container.setRotation(entity.position.rotation);
    }

    this.updateHealthBar(container, entity);
  }

  private createGameObject(entity: GameEntity): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    if (!entity.render) return container;

    switch (entity.render.type) {
      case 'ship':
        this.createShipSprite(container, entity);
        break;
      case 'asteroid':
        this.createAsteroidSprite(container, entity);
        break;
      case 'station':
        this.createStationSprite(container, entity);
        break;
      case 'projectile':
        this.createProjectileSprite(container, entity);
        break;
    }

    if (entity.health && entity.render.type !== 'projectile') {
      const healthBar = this.add.rectangle(0, -entity.render.size / 2 - 10, 30, 4, 0x00ff00);
      healthBar.setName('healthBar');
      container.add(healthBar);
    }

    return container;
  }

  private createShipSprite(container: Phaser.GameObjects.Container, entity: GameEntity): void {
    const size = entity.render?.size || 30;
    const color = Phaser.Display.Color.HexStringToColor(entity.render?.color || '#00ff88');

    const body = this.add.triangle(0, 0, -size/2, size/2, -size/2, -size/2, size/2, 0, color.color);
    body.setStrokeStyle(2, 0xffffff);

    const flame = this.add.triangle(-size/2 - 8, 0, -8, -6, -8, 6, 0, 0, 0xff6600);
    flame.setName('flame');
    flame.setVisible(false);

    container.add([body, flame]);
  }

  private createAsteroidSprite(container: Phaser.GameObjects.Container, entity: GameEntity): void {
    const size = entity.render?.size || 25;
    const color = Phaser.Display.Color.HexStringToColor(entity.render?.color || '#8B7355');

    const points: number[] = [];
    const numPoints = 8;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radius = size / 2 + Phaser.Math.Between(-5, 5);
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    const asteroid = this.add.polygon(0, 0, points, color.color);
    asteroid.setStrokeStyle(2, 0x5a4a3a);
    container.add(asteroid);
  }

  private createStationSprite(container: Phaser.GameObjects.Container, entity: GameEntity): void {
    const size = entity.render?.size || 60;
    const color = Phaser.Display.Color.HexStringToColor(entity.render?.color || '#4488ff');

    const main = this.add.circle(0, 0, size/2, color.color);
    main.setStrokeStyle(3, 0xffffff);

    const dock1 = this.add.rectangle(size/2 + 10, 0, 20, 10, color.color);
    const dock2 = this.add.rectangle(-size/2 - 10, 0, 20, 10, color.color);
    const dock3 = this.add.rectangle(0, size/2 + 10, 10, 20, color.color);
    const dock4 = this.add.rectangle(0, -size/2 - 10, 10, 20, color.color);

    container.add([main, dock1, dock2, dock3, dock4]);
  }

  private createProjectileSprite(container: Phaser.GameObjects.Container, entity: GameEntity): void {
    const size = entity.render?.size || 8;
    const color = Phaser.Display.Color.HexStringToColor(entity.render?.color || '#ff0000');

    const projectile = this.add.circle(0, 0, size/2, color.color);
    const glow = this.add.circle(0, 0, size, color.color, 0.3);
    container.add([glow, projectile]);
  }

  private updateHealthBar(container: Phaser.GameObjects.Container, entity: GameEntity): void {
    if (!entity.health) return;

    const healthBar = container.getByName('healthBar') as Phaser.GameObjects.Rectangle;
    if (!healthBar) return;

    const healthPercent = entity.health.current / entity.health.max;
    healthBar.width = 30 * healthPercent;
    
    if (healthPercent > 0.5) {
      healthBar.fillColor = 0x00ff00;
    } else if (healthPercent > 0.25) {
      healthBar.fillColor = 0xffff00;
    } else {
      healthBar.fillColor = 0xff0000;
    }
  }

  private followPlayer(): void {
    if (!this.playerId) return;

    const entities = this.client.getEntities();
    const player = entities.get(this.playerId);
    if (player?.position) {
      this.camera.scrollX = player.position.x - this.camera.width / 2;
      this.camera.scrollY = player.position.y - this.camera.height / 2;

      const playerObj = this.gameObjects.get(this.playerId);
      if (playerObj) {
        const flame = playerObj.getByName('flame') as Phaser.GameObjects.Shape;
        if (flame) {
          flame.setVisible(this.getThrustInput() !== 0);
        }
      }
    }
  }
}
