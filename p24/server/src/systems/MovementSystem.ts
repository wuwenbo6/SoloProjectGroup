import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Input } from '../components/Input';

export class MovementSystem extends System {
  private readonly thrustPower = 200;
  private readonly turnPower = 3;
  private readonly drag = 0.98;
  private readonly maxSpeed = 300;

  update(deltaTime: number): void {
    const entities = this.getEntitiesWithComponents(Position, Velocity);
    
    for (const entity of entities) {
      const position = entity.getComponent(Position)!;
      const velocity = entity.getComponent(Velocity)!;
      const input = entity.getComponent(Input);

      if (input) {
        this.applyInput(velocity, input, position, deltaTime);
      }

      this.applyDrag(velocity);
      this.limitSpeed(velocity);

      position.x += velocity.vx * deltaTime;
      position.y += velocity.vy * deltaTime;
      position.z += velocity.vz * deltaTime;
      position.rotation += velocity.angularVelocity * deltaTime;
    }
  }

  private applyInput(velocity: Velocity, input: Input, position: Position, deltaTime: number): void {
    if (input.thrust !== 0) {
      const thrust = input.thrust * this.thrustPower * deltaTime;
      velocity.vx += Math.cos(position.rotation) * thrust;
      velocity.vy += Math.sin(position.rotation) * thrust;
    }

    if (input.turn !== 0) {
      velocity.angularVelocity = input.turn * this.turnPower;
    } else {
      velocity.angularVelocity *= 0.9;
    }
  }

  private applyDrag(velocity: Velocity): void {
    velocity.vx *= this.drag;
    velocity.vy *= this.drag;
    velocity.vz *= this.drag;
  }

  private limitSpeed(velocity: Velocity): void {
    const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2 + velocity.vz ** 2);
    if (speed > this.maxSpeed) {
      const ratio = this.maxSpeed / speed;
      velocity.vx *= ratio;
      velocity.vy *= ratio;
      velocity.vz *= ratio;
    }
  }
}
