export enum NodeStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  RUNNING = 'running',
}

export interface Blackboard {
  entity: any;
  world: any;
  target: any;
  targetDistance: number;
  lastAttackTime: number;
  patrolPoints: { x: number; y: number }[];
  currentPatrolIndex: number;
  attackCooldown: number;
  [key: string]: any;
}

export abstract class BehaviorNode {
  protected blackboard: Blackboard;

  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
  }

  abstract execute(): NodeStatus;
}

export class SequenceNode extends BehaviorNode {
  private children: BehaviorNode[];

  constructor(blackboard: Blackboard, children: BehaviorNode[]) {
    super(blackboard);
    this.children = children;
  }

  execute(): NodeStatus {
    for (const child of this.children) {
      const status = child.execute();
      if (status !== NodeStatus.SUCCESS) {
        return status;
      }
    }
    return NodeStatus.SUCCESS;
  }
}

export class SelectorNode extends BehaviorNode {
  private children: BehaviorNode[];

  constructor(blackboard: Blackboard, children: BehaviorNode[]) {
    super(blackboard);
    this.children = children;
  }

  execute(): NodeStatus {
    for (const child of this.children) {
      const status = child.execute();
      if (status !== NodeStatus.FAILURE) {
        return status;
      }
    }
    return NodeStatus.FAILURE;
  }
}

export class ParallelNode extends BehaviorNode {
  private children: BehaviorNode[];
  private successThreshold: number;

  constructor(blackboard: Blackboard, children: BehaviorNode[], successThreshold: number = 1) {
    super(blackboard);
    this.children = children;
    this.successThreshold = successThreshold;
  }

  execute(): NodeStatus {
    let successCount = 0;
    for (const child of this.children) {
      const status = child.execute();
      if (status === NodeStatus.SUCCESS) {
        successCount++;
      }
    }
    return successCount >= this.successThreshold ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class InverterNode extends BehaviorNode {
  private child: BehaviorNode;

  constructor(blackboard: Blackboard, child: BehaviorNode) {
    super(blackboard);
    this.child = child;
  }

  execute(): NodeStatus {
    const status = this.child.execute();
    if (status === NodeStatus.SUCCESS) return NodeStatus.FAILURE;
    if (status === NodeStatus.FAILURE) return NodeStatus.SUCCESS;
    return status;
  }
}

export class ConditionNode extends BehaviorNode {
  private condition: (blackboard: Blackboard) => boolean;

  constructor(blackboard: Blackboard, condition: (blackboard: Blackboard) => boolean) {
    super(blackboard);
    this.condition = condition;
  }

  execute(): NodeStatus {
    return this.condition(this.blackboard) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class ActionNode extends BehaviorNode {
  private action: (blackboard: Blackboard) => NodeStatus;

  constructor(blackboard: Blackboard, action: (blackboard: Blackboard) => NodeStatus) {
    super(blackboard);
    this.action = action;
  }

  execute(): NodeStatus {
    return this.action(this.blackboard);
  }
}

export class WaitNode extends BehaviorNode {
  private duration: number;
  private startTime: number | null = null;

  constructor(blackboard: Blackboard, duration: number) {
    super(blackboard);
    this.duration = duration;
  }

  execute(): NodeStatus {
    if (this.startTime === null) {
      this.startTime = Date.now();
    }

    if (Date.now() - this.startTime >= this.duration) {
      this.startTime = null;
      return NodeStatus.SUCCESS;
    }

    return NodeStatus.RUNNING;
  }
}

export class BehaviorTree {
  private root: BehaviorNode;
  private blackboard: Blackboard;

  constructor(root: BehaviorNode, blackboard: Blackboard) {
    this.root = root;
    this.blackboard = blackboard;
  }

  tick(): void {
    this.root.execute();
  }

  getBlackboard(): Blackboard {
    return this.blackboard;
  }
}

export function createPirateBehaviorTree(blackboard: Blackboard): BehaviorTree {
  const root = new SelectorNode(blackboard, [
    new SequenceNode(blackboard, [
      new ConditionNode(blackboard, (bb) => bb.target !== null),
      new ConditionNode(blackboard, (bb) => bb.targetDistance < 500),
      new SelectorNode(blackboard, [
        new SequenceNode(blackboard, [
          new ConditionNode(blackboard, (bb) => {
            const targetHealth = bb.target.getComponent?.(bb.world.components?.Health || 'Health');
            return targetHealth && targetHealth.current < 50;
          }),
          new ActionNode(blackboard, chaseTarget),
          new ActionNode(blackboard, attackTarget)
        ]),
        new SequenceNode(blackboard, [
          new ConditionNode(blackboard, (bb) => bb.targetDistance < 200),
          new ActionNode(blackboard, chaseTarget)
        ])
      ])
    ]),
    new ActionNode(blackboard, patrol),
    new ActionNode(blackboard, searchTarget)
  ]);

  return new BehaviorTree(root, blackboard);
}

function searchTarget(blackboard: Blackboard): NodeStatus {
  const world = blackboard.world;
  const entity = blackboard.entity;
  const position = entity.getComponent?.(world.components?.Position || 'Position');
  if (!position) return NodeStatus.FAILURE;

  let nearestPlayer: any = null;
  let nearestDistance = Infinity;

  for (const other of world.getEntities()) {
    if (other.id === entity.id) continue;
    const render = other.getComponent?.(world.components?.Render || 'Render');
    if (!render || render.type !== 'ship') continue;

    const otherPos = other.getComponent?.(world.components?.Position || 'Position');
    if (!otherPos) continue;

    const health = other.getComponent?.(world.components?.Health || 'Health');
    if (!health || health.current < 20) continue;

    const dx = position.x - otherPos.x;
    const dy = position.y - otherPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPlayer = other;
    }
  }

  if (nearestPlayer) {
    blackboard.target = nearestPlayer;
    blackboard.targetDistance = nearestDistance;
    return NodeStatus.SUCCESS;
  }

  return NodeStatus.FAILURE;
}

function chaseTarget(blackboard: Blackboard): NodeStatus {
  const entity = blackboard.entity;
  const target = blackboard.target;
  const world = blackboard.world;

  const position = entity.getComponent?.(world.components?.Position || 'Position');
  const velocity = entity.getComponent?.(world.components?.Velocity || 'Velocity');
  const targetPos = target?.getComponent?.(world.components?.Position || 'Position');

  if (!position || !velocity || !targetPos) return NodeStatus.FAILURE;

  const dx = targetPos.x - position.x;
  const dy = targetPos.y - position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  blackboard.targetDistance = distance;

  if (distance < 50) {
    velocity.vx = 0;
    velocity.vy = 0;
    return NodeStatus.SUCCESS;
  }

  const targetAngle = Math.atan2(dy, dx);
  position.rotation = targetAngle;

  const speed = 80;
  velocity.vx = Math.cos(targetAngle) * speed;
  velocity.vy = Math.sin(targetAngle) * speed;

  return NodeStatus.RUNNING;
}

function attackTarget(blackboard: Blackboard): NodeStatus {
  const now = Date.now();
  const cooldown = blackboard.attackCooldown || 1000;

  if (now - blackboard.lastAttackTime < cooldown) {
    return NodeStatus.RUNNING;
  }

  const entity = blackboard.entity;
  const target = blackboard.target;
  const world = blackboard.world;

  const position = entity.getComponent?.(world.components?.Position || 'Position');
  const targetHealth = target?.getComponent?.(world.components?.Health || 'Health');

  if (!position || !targetHealth) return NodeStatus.FAILURE;

  targetHealth.current = Math.max(0, targetHealth.current - 15);
  blackboard.lastAttackTime = now;

  return NodeStatus.SUCCESS;
}

function patrol(blackboard: Blackboard): NodeStatus {
  const entity = blackboard.entity;
  const world = blackboard.world;

  const position = entity.getComponent?.(world.components?.Position || 'Position');
  const velocity = entity.getComponent?.(world.components?.Velocity || 'Velocity');

  if (!position || !velocity) return NodeStatus.FAILURE;

  if (!blackboard.patrolPoints || blackboard.patrolPoints.length === 0) {
    blackboard.patrolPoints = generatePatrolPoints(position.x, position.y);
    blackboard.currentPatrolIndex = 0;
  }

  const targetPoint = blackboard.patrolPoints[blackboard.currentPatrolIndex];
  const dx = targetPoint.x - position.x;
  const dy = targetPoint.y - position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 30) {
    blackboard.currentPatrolIndex = (blackboard.currentPatrolIndex + 1) % blackboard.patrolPoints.length;
    return NodeStatus.SUCCESS;
  }

  const targetAngle = Math.atan2(dy, dx);
  position.rotation = targetAngle;

  const speed = 50;
  velocity.vx = Math.cos(targetAngle) * speed;
  velocity.vy = Math.sin(targetAngle) * speed;

  return NodeStatus.RUNNING;
}

function generatePatrolPoints(centerX: number, centerY: number): { x: number; y: number }[] {
  const radius = 200 + Math.random() * 100;
  const points: { x: number; y: number }[] = [];
  const numPoints = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2 + Math.random() * 0.5;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  }

  return points;
}
