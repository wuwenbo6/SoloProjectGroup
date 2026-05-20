import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Health } from '../components/Health';
import { Render } from '../components/Render';
import { BehaviorTree, createPirateBehaviorTree, Blackboard } from '../ai/BehaviorTree';

export enum AIType {
  PIRATE = 'pirate',
  TRADER = 'trader',
  MINER = 'miner',
}

export class AIComponent {
  public type: AIType;
  public behaviorTree: BehaviorTree;
  public lastThinkTime: number = 0;
  public thinkInterval: number = 100;

  constructor(type: AIType, behaviorTree: BehaviorTree) {
    this.type = type;
    this.behaviorTree = behaviorTree;
  }
}

export class AISystem extends System {
  private aiEntities: Map<string, AIComponent> = new Map();
  private componentReferences: {
    Position: typeof Position;
    Velocity: typeof Velocity;
    Health: typeof Health;
    Render: typeof Render;
  };

  constructor(world: any) {
    super(world);
    this.componentReferences = {
      Position,
      Velocity,
      Health,
      Render,
    };
  }

  registerAI(entity: Entity, type: AIType): void {
    const blackboard: Blackboard = {
      entity,
      world: {
        getEntities: () => this.world.getEntities(),
        components: this.componentReferences,
      },
      target: null,
      targetDistance: Infinity,
      lastAttackTime: 0,
      patrolPoints: [],
      currentPatrolIndex: 0,
      attackCooldown: 800,
    };

    let behaviorTree: BehaviorTree;
    switch (type) {
      case AIType.PIRATE:
        behaviorTree = createPirateBehaviorTree(blackboard);
        break;
      default:
        behaviorTree = createPirateBehaviorTree(blackboard);
    }

    const aiComponent = new AIComponent(type, behaviorTree);
    this.aiEntities.set(entity.id, aiComponent);
  }

  unregisterAI(entityId: string): void {
    this.aiEntities.delete(entityId);
  }

  update(deltaTime: number): void {
    const now = Date.now();

    for (const [entityId, aiComponent] of this.aiEntities) {
      if (now - aiComponent.lastThinkTime >= aiComponent.thinkInterval) {
        const entity = this.world.getEntity(entityId);
        if (!entity) {
          this.aiEntities.delete(entityId);
          continue;
        }

        const health = entity.getComponent(Health);
        if (health && health.current <= 0) {
          this.aiEntities.delete(entityId);
          this.world.removeEntity(entityId);
          continue;
        }

        aiComponent.behaviorTree.tick();
        aiComponent.lastThinkTime = now;
      }
    }
  }

  getAIEntityCount(): number {
    return this.aiEntities.size;
  }

  spawnPirate(x: number, y: number): Entity {
    const pirate = new Entity();
    pirate.addComponent(new Position(x, y, 0, 0));
    pirate.addComponent(new Velocity());
    pirate.addComponent(new Health(80, 80, 20));
    pirate.addComponent(new Render('ship', '#ff4444', 28));
    this.world.addEntity(pirate);
    this.registerAI(pirate, AIType.PIRATE);
    return pirate;
  }

  spawnMultiplePirates(count: number, centerX: number = 0, centerY: number = 0, radius: number = 500): Entity[] {
    const pirates: Entity[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      pirates.push(this.spawnPirate(x, y));
    }
    return pirates;
  }
}
