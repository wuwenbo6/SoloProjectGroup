import { Level } from 'level';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Health } from '../components/Health';
import { Cargo } from '../components/Cargo';
import { Render } from '../components/Render';

export class LevelDBStore {
  private db: Level;
  private world: World;

  constructor(path: string, world: World) {
    this.db = new Level(path, { valueEncoding: 'json' });
    this.world = world;
  }

  async saveSnapshot(): Promise<void> {
    const snapshot = this.world.toJSON();
    await this.db.put(`snapshot:${Date.now()}`, snapshot);
  }

  async loadLatestSnapshot(): Promise<void> {
    try {
      let latestKey: string | null = null;
      let latestTime = 0;

      for await (const key of this.db.keys({ gte: 'snapshot:', lte: 'snapshot:\xFF' })) {
        const time = parseInt(key.split(':')[1], 10);
        if (time > latestTime) {
          latestTime = time;
          latestKey = key;
        }
      }

      if (latestKey) {
        const snapshot = await this.db.get(latestKey);
        this.restoreWorld(snapshot);
      }
    } catch (error) {
      console.log('No snapshot found, starting fresh');
    }
  }

  private restoreWorld(snapshot: any): void {
    for (const entityData of snapshot.entities) {
      const entity = new Entity(entityData.id);

      if (entityData.position) {
        const p = entityData.position;
        entity.addComponent(new Position(p.x, p.y, p.z, p.rotation));
      }
      if (entityData.velocity) {
        const v = entityData.velocity;
        entity.addComponent(new Velocity(v.vx, v.vy, v.vz, v.angularVelocity));
      }
      if (entityData.health) {
        const h = entityData.health;
        entity.addComponent(new Health(h.current, h.max, h.shield));
      }
      if (entityData.cargo) {
        const c = entityData.cargo;
        const cargo = new Cargo(c.capacity);
        for (const [key, value] of Object.entries(c.items)) {
          cargo.items.set(key, value as number);
        }
        entity.addComponent(cargo);
      }
      if (entityData.render) {
        const r = entityData.render;
        entity.addComponent(new Render(r.type, r.color, r.size));
      }

      this.world.addEntity(entity);
    }
  }

  async saveEntity(entity: Entity): Promise<void> {
    await this.db.put(`entity:${entity.id}`, entity.toJSON());
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
