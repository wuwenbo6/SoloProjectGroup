import { Entity } from './Entity';
import { System } from './System';

export class World {
  private entities: Map<string, Entity> = new Map();
  private systems: System[] = [];
  private isRunning: boolean = false;
  private lastUpdateTime: number = 0;

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  removeEntity(entityId: string): void {
    this.entities.delete(entityId);
  }

  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  removeSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index > -1) {
      this.systems.splice(index, 1);
    }
  }

  getSystems(): System[] {
    return this.systems;
  }

  start(): void {
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    this.update(deltaTime);

    setTimeout(() => this.gameLoop(), 1000 / 60);
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }

  toJSON(): any {
    return {
      entities: Array.from(this.entities.values()).map(e => e.toJSON()),
      timestamp: Date.now()
    };
  }
}
