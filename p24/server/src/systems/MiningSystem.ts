import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Render } from '../components/Render';
import { Cargo } from '../components/Cargo';
import { Input } from '../components/Input';

interface ShipAssignment {
  shipCargo: Cargo;
  toMine: number;
}

interface AsteroidMining {
  asteroidCargo: Cargo;
  assignments: ShipAssignment[];
}

export class MiningSystem extends System {
  private readonly miningRange = 50;
  private readonly miningSpeed = 2;

  update(deltaTime: number): void {
    const ships = this.getEntitiesWithComponents(Position, Render, Cargo, Input).filter(
      entity => entity.getComponent(Render)!.type === 'ship'
    );

    const asteroids = this.getEntitiesWithComponents(Position, Render, Cargo).filter(
      entity => entity.getComponent(Render)!.type === 'asteroid'
    );

    const asteroidMiners: Map<string, AsteroidMining> = new Map();

    for (const ship of ships) {
      const input = ship.getComponent(Input)!;
      if (!input.isMining) continue;

      const shipPos = ship.getComponent(Position)!;
      const shipCargo = ship.getComponent(Cargo)!;

      for (const asteroid of asteroids) {
        const asteroidPos = asteroid.getComponent(Position)!;

        if (this.isInRange(shipPos, asteroidPos)) {
          if (!asteroidMiners.has(asteroid.id)) {
            asteroidMiners.set(asteroid.id, {
              asteroidCargo: asteroid.getComponent(Cargo)!,
              assignments: []
            });
          }

          const mining = asteroidMiners.get(asteroid.id)!;
          const mineAmount = Math.ceil(this.miningSpeed * deltaTime);
          mining.assignments.push({ shipCargo, toMine: mineAmount });
        }
      }
    }

    for (const mining of asteroidMiners.values()) {
      this.distributeResources(mining);
    }
  }

  private distributeResources(mining: AsteroidMining): void {
    if (mining.assignments.length === 0) return;

    const resourceTypes = Array.from(mining.asteroidCargo.items.keys());
    
    for (const resourceType of resourceTypes) {
      const totalAvailable = mining.asteroidCargo.getItemCount(resourceType);
      if (totalAvailable <= 0) continue;

      const validMiners = mining.assignments.filter(a => a.shipCargo.canAddItem(1));
      if (validMiners.length === 0) continue;

      let remaining = totalAvailable;
      const perMiner = Math.floor(remaining / validMiners.length);
      let remainder = remaining % validMiners.length;

      for (const assignment of validMiners) {
        if (remaining <= 0) break;

        let amount = perMiner;
        if (remainder > 0) {
          amount += 1;
          remainder -= 1;
        }

        amount = Math.min(amount, assignment.toMine);
        if (amount <= 0) continue;

        const acquired = mining.asteroidCargo.tryAcquireResources(resourceType, amount);
        
        if (acquired > 0) {
          assignment.shipCargo.addItem(resourceType, acquired);
          remaining -= acquired;
        }
      }
    }
  }

  private isInRange(posA: Position, posB: Position): boolean {
    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.miningRange;
  }
}
