import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Render } from '../components/Render';
import { Health } from '../components/Health';
import { Input } from '../components/Input';

export class CombatSystem extends System {
  private readonly projectileSpeed = 500;
  private readonly projectileDamage = 20;
  private lastShootTime: Map<string, number> = new Map();
  private readonly shootCooldown = 300;

  update(deltaTime: number): void {
    const ships = this.getEntitiesWithComponents(Position, Render, Input).filter(
      entity => entity.getComponent(Render)!.type === 'ship'
    );

    for (const ship of ships) {
      const input = ship.getComponent(Input)!;
      if (input.isShooting) {
        this.tryShoot(ship);
      }
    }

    this.updateProjectiles(deltaTime);
    this.checkProjectileCollisions();
    this.cleanupDeadEntities();
  }

  private tryShoot(ship: Entity): void {
    const lastTime = this.lastShootTime.get(ship.id) || 0;
    const now = Date.now();
    
    if (now - lastTime < this.shootCooldown) return;
    
    this.lastShootTime.set(ship.id, now);
    this.createProjectile(ship);
  }

  private createProjectile(ship: Entity): void {
    const position = ship.getComponent(Position)!;
    
    const projectile = new Entity();
    projectile.addComponent(new Position(
      position.x + Math.cos(position.rotation) * 25,
      position.y + Math.sin(position.rotation) * 25,
      position.z,
      position.rotation
    ));
    projectile.addComponent(new Velocity(
      Math.cos(position.rotation) * this.projectileSpeed,
      Math.sin(position.rotation) * this.projectileSpeed,
      0,
      0
    ));
    projectile.addComponent(new Render('projectile', '#ff0000', 8));
    projectile.addComponent(new Health(1, 1, 0));

    this.world.addEntity(projectile);
  }

  private updateProjectiles(deltaTime: number): void {
    const projectiles = this.getEntitiesWithComponents(Position, Velocity, Render).filter(
      entity => entity.getComponent(Render)!.type === 'projectile'
    );

    for (const projectile of projectiles) {
      const pos = projectile.getComponent(Position)!;
      const vel = projectile.getComponent(Velocity)!;
      
      pos.x += vel.vx * deltaTime;
      pos.y += vel.vy * deltaTime;
      pos.z += vel.vz * deltaTime;

      if (Math.abs(pos.x) > 5000 || Math.abs(pos.y) > 5000) {
        const health = projectile.getComponent(Health)!;
        health.current = 0;
      }
    }
  }

  private checkProjectileCollisions(): void {
    const projectiles = this.getEntitiesWithComponents(Position, Render, Health).filter(
      entity => entity.getComponent(Render)!.type === 'projectile'
    );

    const targets = this.getEntitiesWithComponents(Position, Render, Health).filter(
      entity => entity.getComponent(Render)!.type === 'ship'
    );

    for (const projectile of projectiles) {
      const projPos = projectile.getComponent(Position)!;
      const projRender = projectile.getComponent(Render)!;

      for (const target of targets) {
        const targetPos = target.getComponent(Position)!;
        const targetRender = target.getComponent(Render)!;
        const targetHealth = target.getComponent(Health)!;

        const dx = projPos.x - targetPos.x;
        const dy = projPos.y - targetPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (projRender.size + targetRender.size) / 2;

        if (distance < minDistance) {
          targetHealth.takeDamage(this.projectileDamage);
          projectile.getComponent(Health)!.current = 0;
          break;
        }
      }
    }
  }

  private cleanupDeadEntities(): void {
    const entities = this.getEntitiesWithComponents(Health);
    
    for (const entity of entities) {
      const health = entity.getComponent(Health)!;
      if (health.isDead()) {
        this.world.removeEntity(entity.id);
      }
    }
  }
}
