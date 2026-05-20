import type { HangingConfig, Skeleton, Node, Point } from '../../types';
import { StressCalculator } from '../stressCalculation';

export class HangingSimulator {
  private config: HangingConfig;
  private stressCalculator: StressCalculator;
  private ropeSegments: Node[] = [];

  constructor(config: Partial<HangingConfig> = {}) {
    this.config = {
      anchorPoints: [],
      gravity: { x: 0, y: 0, z: -9.8 },
      airResistance: 0.05,
      ...config,
    };
    this.stressCalculator = new StressCalculator();
  }

  updateConfig(config: Partial<HangingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): HangingConfig {
    return { ...this.config };
  }

  setAnchorPoints(nodeIds: string[]): void {
    this.config.anchorPoints = [...nodeIds];
  }

  addAnchorPoint(nodeId: string): void {
    if (!this.config.anchorPoints.includes(nodeId)) {
      this.config.anchorPoints.push(nodeId);
    }
  }

  removeAnchorPoint(nodeId: string): void {
    this.config.anchorPoints = this.config.anchorPoints.filter(id => id !== nodeId);
  }

  getAnchorPoints(): string[] {
    return [...this.config.anchorPoints];
  }

  private subtractPoints(a: Point, b: Point): Point {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  private addPoints(a: Point, b: Point): Point {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  private multiplyPoint(p: Point, scalar: number): Point {
    return { x: p.x * scalar, y: p.y * scalar, z: p.z * scalar };
  }

  private vectorLength(p: Point): number {
    return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  }

  createHangRope(anchorPosition: Point, attachNodeId: string, segments: number = 5, segmentLength: number = 0.5): Node[] {
    this.ropeSegments = [];
    let prevNodeId = '';

    for (let i = 0; i < segments; i++) {
      const t = (i + 1) / segments;
      const position = {
        x: anchorPosition.x + (0) * t,
        y: anchorPosition.y + (0) * t,
        z: anchorPosition.z - segmentLength * (i + 1),
      };
      const isFixed = i === 0;
      const segment: Node = {
        id: `rope_${Date.now()}_${i}`,
        position,
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 0.1,
        isFixed,
        stress: 0,
        maxStress: 1000,
      };
      this.ropeSegments.push(segment);
      prevNodeId = segment.id;
    }

    return this.ropeSegments;
  }

  applyHangingForces(skeleton: Skeleton): Map<string, Point> {
    const forces = new Map<string, Point>();

    for (const node of skeleton.nodes) {
      if (node.isFixed) continue;

      const gravityForce = this.multiplyPoint(this.config.gravity, node.mass);
      forces.set(node.id, gravityForce);

      const dragForce = this.multiplyPoint(node.velocity, -this.config.airResistance);
      const currentForce = forces.get(node.id) || { x: 0, y: 0, z: 0 };
      forces.set(node.id, this.addPoints(currentForce, dragForce));
    }

    return forces;
  }

  simulateHanging(skeleton: Skeleton, deltaTime: number, iterations: number = 1): Skeleton {
    let updatedSkeleton = JSON.parse(JSON.stringify(skeleton));

    for (const node of updatedSkeleton.nodes) {
      if (this.config.anchorPoints.includes(node.id)) {
        node.isFixed = true;
      }
    }

    for (let i = 0; i < iterations; i++) {
      const forces = this.applyHangingForces(updatedSkeleton);
      updatedSkeleton = this.stressCalculator.updatePhysics(updatedSkeleton, deltaTime, forces);
    }

    return updatedSkeleton;
  }

  calculateTension(skeleton: Skeleton): Map<string, number> {
    const tensions = new Map<string, number>();
    const stressResult = this.stressCalculator.calculateStress(skeleton);

    for (const anchorId of this.config.anchorPoints) {
      const node = skeleton.nodes.find(n => n.id === anchorId);
      if (node) {
        const tension = stressResult.nodeStresses.get(anchorId) || 0;
        tensions.set(anchorId, tension);
      }
    }

    return tensions;
  }

  findOptimalAnchorPoints(skeleton: Skeleton, count: number = 2): string[] {
    const topNodes = [...skeleton.nodes]
      .sort((a, b) => b.position.z - a.position.z)
      .slice(0, Math.min(count * 2, skeleton.nodes.length));

    const com = this.stressCalculator.calculateCenterOfMass(skeleton);
    const scoredNodes = topNodes.map(node => {
      const dx = node.position.x - com.x;
      const dy = node.position.y - com.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return { nodeId: node.id, score: distance + node.position.z * 2 };
    });

    scoredNodes.sort((a, b) => b.score - a.score);
    return scoredNodes.slice(0, count).map(n => n.nodeId);
  }

  checkStability(skeleton: Skeleton): { stable: boolean; maxDisplacement: number; problematicNodes: string[] } {
    const stressResult = this.stressCalculator.calculateStress(skeleton);
    const problematicNodes: string[] = [];
    let maxDisplacement = 0;

    for (const [nodeId, stress] of stressResult.nodeStresses) {
      const node = skeleton.nodes.find(n => n.id === nodeId);
      if (node) {
        const stressRatio = stress / node.maxStress;
        if (stressRatio > 0.9) {
          problematicNodes.push(nodeId);
        }
        if (!node.isFixed) {
          const displacement = this.vectorLength(node.velocity);
          maxDisplacement = Math.max(maxDisplacement, displacement);
        }
      }
    }

    const stable = stressResult.isStable && maxDisplacement < 0.1;

    return {
      stable,
      maxDisplacement,
      problematicNodes,
    };
  }

  simulateSwing(skeleton: Skeleton, initialForce: Point, duration: number, stepTime: number = 0.016): Skeleton[] {
    const frames: Skeleton[] = [];
    let currentSkeleton = JSON.parse(JSON.stringify(skeleton));

    const forces = new Map<string, Point>();
    for (const node of currentSkeleton.nodes) {
      if (!node.isFixed) {
        forces.set(node.id, initialForce);
      }
    }

    currentSkeleton = this.stressCalculator.updatePhysics(currentSkeleton, stepTime, forces);
    frames.push(JSON.parse(JSON.stringify(currentSkeleton)));

    const steps = Math.floor(duration / stepTime);
    for (let i = 1; i < steps; i++) {
      currentSkeleton = this.simulateHanging(currentSkeleton, stepTime);
      if (i % 3 === 0) {
        frames.push(JSON.parse(JSON.stringify(currentSkeleton)));
      }
    }

    return frames;
  }

  getLowestPoint(skeleton: Skeleton): Point | null {
    if (skeleton.nodes.length === 0) return null;
    let lowestNode = skeleton.nodes[0];
    for (const node of skeleton.nodes) {
      if (node.position.z < lowestNode.position.z) {
        lowestNode = node;
      }
    }
    return { ...lowestNode.position };
  }

  getHangingHeight(skeleton: Skeleton, groundLevel: number = 0): number {
    const lowestPoint = this.getLowestPoint(skeleton);
    if (!lowestPoint) return 0;
    return lowestPoint.z - groundLevel;
  }

  clearRope(): void {
    this.ropeSegments = [];
  }
}
