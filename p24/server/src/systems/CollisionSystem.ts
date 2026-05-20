import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Render } from '../components/Render';
import { Health } from '../components/Health';

export interface Collision {
  entityA: Entity;
  entityB: Entity;
}

export class CollisionSystem extends System {
  private collisions: Collision[] = [];

  update(deltaTime: number): void {
    this.collisions = [];
    const entities = this.getEntitiesWithComponents(Position, Render);
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        if (this.checkCollision(entities[i], entities[j])) {
          this.collisions.push({
            entityA: entities[i],
            entityB: entities[j]
          });
          this.handleCollision(entities[i], entities[j]);
        }
      }
    }
  }

  private checkCollision(entityA: Entity, entityB: Entity): boolean {
    const posA = entityA.getComponent(Position)!;
    const posB = entityB.getComponent(Position)!;
    const renderA = entityA.getComponent(Render)!;
    const renderB = entityB.getComponent(Render)!;

    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (renderA.size + renderB.size) / 2;

    return distance < minDistance;
  }

  private handleCollision(entityA: Entity, entityB: Entity): void {
    const healthA = entityA.getComponent(Health);
    const healthB = entityB.getComponent(Health);

    if (healthA && healthB) {
      healthA.takeDamage(5);
      healthB.takeDamage(5);
    }
  }

  getCollisions(): Collision[] {
    return this.collisions;
  }
}
