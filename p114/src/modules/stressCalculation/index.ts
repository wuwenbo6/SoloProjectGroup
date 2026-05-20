import type { StressConfig, StressResult, Skeleton, Node, Edge, Point } from '../../types';

export class StressCalculator {
  private config: StressConfig;
  private maxVelocity: number = 50;
  private maxStretchRatio: number = 2.0;
  private minCompressionRatio: number = 0.5;

  constructor(config: Partial<StressConfig> = {}) {
    this.config = {
      gravity: 9.8,
      iterationSteps: 10,
      dampingFactor: 0.95,
      ...config,
    };
  }

  updateConfig(config: Partial<StressConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): StressConfig {
    return { ...this.config };
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

  private dotProduct(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private vectorLength(p: Point): number {
    return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  }

  private normalizeVector(p: Point): Point {
    const len = this.vectorLength(p);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return this.multiplyPoint(p, 1 / len);
  }

  calculateStress(skeleton: Skeleton, additionalForces: Map<string, Point> = new Map()): StressResult {
    const nodeStresses = new Map<string, number>();
    const edgeForces = new Map<string, number>();
    let totalPotentialEnergy = 0;
    const nodeMap = new Map<string, Node>();
    skeleton.nodes.forEach(node => nodeMap.set(node.id, { ...node }));

    for (const edge of skeleton.edges) {
      const startNode = nodeMap.get(edge.startNodeId);
      const endNode = nodeMap.get(edge.endNodeId);
      if (!startNode || !endNode) continue;

      const delta = this.subtractPoints(endNode.position, startNode.position);
      const currentLength = this.vectorLength(delta);
      const direction = this.normalizeVector(delta);
      const lengthDiff = currentLength - edge.length;
      const forceMagnitude = edge.stiffness * lengthDiff;
      const force = this.multiplyPoint(direction, forceMagnitude);

      edgeForces.set(edge.id, Math.abs(forceMagnitude));
      totalPotentialEnergy += 0.5 * edge.stiffness * lengthDiff * lengthDiff;

      if (!startNode.isFixed) {
        startNode.acceleration = this.addPoints(
          startNode.acceleration,
          this.multiplyPoint(force, 1 / startNode.mass)
        );
      }
      if (!endNode.isFixed) {
        endNode.acceleration = this.addPoints(
          endNode.acceleration,
          this.multiplyPoint(force, -1 / endNode.mass)
        );
      }
    }

    for (const node of nodeMap.values()) {
      if (!node.isFixed) {
        const gravityForce = { x: 0, y: 0, z: -this.config.gravity * node.mass };
        node.acceleration = this.addPoints(
          node.acceleration,
          this.multiplyPoint(gravityForce, 1 / node.mass)
        );
      }

      const additionalForce = additionalForces.get(node.id);
      if (additionalForce && !node.isFixed) {
        node.acceleration = this.addPoints(
          node.acceleration,
          this.multiplyPoint(additionalForce, 1 / node.mass)
        );
      }
    }

    for (const node of nodeMap.values()) {
      const connectedEdges = skeleton.edges.filter(
        e => e.startNodeId === node.id || e.endNodeId === node.id
      );
      let totalStress = 0;
      for (const edge of connectedEdges) {
        const force = edgeForces.get(edge.id) || 0;
        totalStress += force;
      }
      node.stress = totalStress;
      nodeStresses.set(node.id, totalStress);
    }

    const maxStressRatio = Math.max(
      ...Array.from(nodeStresses.entries()).map(([nodeId, stress]) => {
        const node = nodeMap.get(nodeId);
        return node ? stress / node.maxStress : 0;
      })
    );
    const isStable = maxStressRatio < 1;

    return {
      nodeStresses,
      edgeForces,
      totalPotentialEnergy,
      isStable,
    };
  }

  updatePhysics(skeleton: Skeleton, deltaTime: number, additionalForces: Map<string, Point> = new Map()): Skeleton {
    const updatedSkeleton = JSON.parse(JSON.stringify(skeleton));
    const safeDeltaTime = Math.min(deltaTime, 0.05);

    for (let step = 0; step < this.config.iterationSteps; step++) {
      const nodeMap = new Map<string, Node>();
      updatedSkeleton.nodes.forEach((node: Node) => nodeMap.set(node.id, node));

      for (const node of updatedSkeleton.nodes) {
        node.acceleration = { x: 0, y: 0, z: 0 };
      }

      for (const edge of updatedSkeleton.edges) {
        const startNode = nodeMap.get(edge.startNodeId);
        const endNode = nodeMap.get(edge.endNodeId);
        if (!startNode || !endNode) continue;

        const delta = this.subtractPoints(endNode.position, startNode.position);
        const currentLength = this.vectorLength(delta);
        if (currentLength === 0) continue;

        const maxLength = edge.length * this.maxStretchRatio;
        const minLength = edge.length * this.minCompressionRatio;

        if (currentLength > maxLength) {
          const direction = this.normalizeVector(delta);
          const excessLength = currentLength - maxLength;
          const correction = this.multiplyPoint(direction, excessLength * 0.5);
          if (!endNode.isFixed) {
            endNode.position = this.subtractPoints(endNode.position, correction);
          }
          if (!startNode.isFixed) {
            startNode.position = this.addPoints(startNode.position, correction);
          }
        } else if (currentLength < minLength) {
          const direction = this.normalizeVector(delta);
          const excessLength = minLength - currentLength;
          const correction = this.multiplyPoint(direction, excessLength * 0.5);
          if (!endNode.isFixed) {
            endNode.position = this.addPoints(endNode.position, correction);
          }
          if (!startNode.isFixed) {
            startNode.position = this.subtractPoints(startNode.position, correction);
          }
        }

        const newDelta = this.subtractPoints(endNode.position, startNode.position);
        const newCurrentLength = this.vectorLength(newDelta);
        if (newCurrentLength === 0) continue;

        const direction = this.normalizeVector(newDelta);
        const lengthDiff = newCurrentLength - edge.length;
        const relativeVelocity = this.subtractPoints(endNode.velocity, startNode.velocity);
        const dampingForce = edge.damping * this.dotProduct(relativeVelocity, direction);
        const forceMagnitude = edge.stiffness * lengthDiff + dampingForce;
        const clampedForceMagnitude = Math.max(-edge.maxForce, Math.min(edge.maxForce, forceMagnitude));
        const force = this.multiplyPoint(direction, clampedForceMagnitude);

        edge.currentForce = Math.abs(clampedForceMagnitude);

        if (!startNode.isFixed) {
          startNode.acceleration = this.addPoints(
            startNode.acceleration,
            this.multiplyPoint(force, 1 / startNode.mass)
          );
        }
        if (!endNode.isFixed) {
          endNode.acceleration = this.addPoints(
            endNode.acceleration,
            this.multiplyPoint(force, -1 / endNode.mass)
          );
        }
      }

      for (const node of updatedSkeleton.nodes) {
        if (!node.isFixed) {
          node.acceleration.z -= this.config.gravity;
        }
      }

      for (const [nodeId, force] of additionalForces) {
        const node = nodeMap.get(nodeId);
        if (node && !node.isFixed) {
          const clampedForce = this.clampVector(force, 1000);
          node.acceleration = this.addPoints(
            node.acceleration,
            this.multiplyPoint(clampedForce, 1 / node.mass)
          );
        }
      }

      const dt = safeDeltaTime / this.config.iterationSteps;
      for (const node of updatedSkeleton.nodes) {
        if (node.isFixed) continue;

        node.velocity = this.addPoints(
          node.velocity,
          this.multiplyPoint(node.acceleration, dt)
        );
        node.velocity = this.clampVector(node.velocity, this.maxVelocity);
        node.velocity = this.multiplyPoint(node.velocity, this.config.dampingFactor);
        node.position = this.addPoints(
          node.position,
          this.multiplyPoint(node.velocity, dt)
        );
      }
    }

    return updatedSkeleton;
  }

  private clampVector(v: Point, maxLength: number): Point {
    const len = this.vectorLength(v);
    if (len <= maxLength) return v;
    return this.multiplyPoint(v, maxLength / len);
  }

  getCriticalNodes(skeleton: Skeleton, threshold: number = 0.8): string[] {
    const result = this.calculateStress(skeleton);
    const criticalNodes: string[] = [];
    for (const [nodeId, stress] of result.nodeStresses) {
      const node = skeleton.nodes.find(n => n.id === nodeId);
      if (node && stress >= node.maxStress * threshold) {
        criticalNodes.push(nodeId);
      }
    }
    return criticalNodes;
  }

  getCriticalEdges(skeleton: Skeleton, threshold: number = 0.8): string[] {
    const result = this.calculateStress(skeleton);
    const criticalEdges: string[] = [];
    for (const [edgeId, force] of result.edgeForces) {
      const edge = skeleton.edges.find(e => e.id === edgeId);
      if (edge && force >= edge.maxForce * threshold) {
        criticalEdges.push(edgeId);
      }
    }
    return criticalEdges;
  }

  calculateTotalMass(skeleton: Skeleton): number {
    return skeleton.nodes.reduce((sum, node) => sum + node.mass, 0);
  }

  calculateCenterOfMass(skeleton: Skeleton): Point {
    const totalMass = this.calculateTotalMass(skeleton);
    if (totalMass === 0) return { x: 0, y: 0, z: 0 };

    let com = { x: 0, y: 0, z: 0 };
    for (const node of skeleton.nodes) {
      com.x += node.position.x * node.mass;
      com.y += node.position.y * node.mass;
      com.z += node.position.z * node.mass;
    }
    return this.multiplyPoint(com, 1 / totalMass);
  }
}
