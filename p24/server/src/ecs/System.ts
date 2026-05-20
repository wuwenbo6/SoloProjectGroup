import { Entity } from './Entity';
import { World } from './World';

export abstract class System {
  protected world: World;

  constructor(world: World) {
    this.world = world;
  }

  abstract update(deltaTime: number): void;

  protected getEntitiesWithComponents(...componentTypes: (new (...args: any[]) => any)[]): Entity[] {
    return this.world.getEntities().filter(entity => {
      return componentTypes.every(type => entity.hasComponent(type));
    });
  }
}
