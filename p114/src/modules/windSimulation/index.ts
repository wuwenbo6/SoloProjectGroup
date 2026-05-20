import type { WindConfig, Skeleton, Node, Point } from '../../types';
import { StressCalculator } from '../stressCalculation';

export class WindSimulator {
  private config: WindConfig;
  private stressCalculator: StressCalculator;
  private time: number = 0;
  private seed: number = Math.random() * 10000;
  private maxWindForce: number = 500;
  private maxSpeed: number = 100;

  constructor(config: Partial<WindConfig> = {}) {
    this.config = {
      speed: 5,
      direction: { x: 1, y: 0, z: 0 },
      turbulence: 0.3,
      frequency: 2,
      ...config,
    };
    this.stressCalculator = new StressCalculator();
    this.normalizeDirection();
  }

  private normalizeDirection(): void {
    const len = Math.sqrt(
      this.config.direction.x ** 2 +
      this.config.direction.y ** 2 +
      this.config.direction.z ** 2
    );
    if (len > 0) {
      this.config.direction.x /= len;
      this.config.direction.y /= len;
      this.config.direction.z /= len;
    }
  }

  updateConfig(config: Partial<WindConfig>): void {
    this.config = { ...this.config, ...config };
    this.normalizeDirection();
  }

  getConfig(): WindConfig {
    return { ...this.config };
  }

  setDirection(direction: Point): void {
    this.config.direction = { ...direction };
    this.normalizeDirection();
  }

  setSpeed(speed: number): void {
    this.config.speed = Math.max(0, Math.min(this.maxSpeed, speed));
  }

  setTurbulence(turbulence: number): void {
    this.config.turbulence = Math.max(0, Math.min(1, turbulence));
  }

  private noise(x: number, y: number, z: number): number {
    const n = x * 12.9898 + y * 78.233 + z * 45.164 + this.seed;
    return (Math.sin(n) * 43758.5453) % 1 + 0.5;
  }

  private smoothNoise(x: number, y: number, z: number): number {
    const corners = (
      this.noise(x - 1, y - 1, z - 1) + this.noise(x + 1, y - 1, z - 1) +
      this.noise(x - 1, y + 1, z - 1) + this.noise(x + 1, y + 1, z - 1) +
      this.noise(x - 1, y - 1, z + 1) + this.noise(x + 1, y - 1, z + 1) +
      this.noise(x - 1, y + 1, z + 1) + this.noise(x + 1, y + 1, z + 1)
    ) / 8;
    const sides = (
      this.noise(x - 1, y, z) + this.noise(x + 1, y, z) +
      this.noise(x, y - 1, z) + this.noise(x, y + 1, z) +
      this.noise(x, y, z - 1) + this.noise(x, y, z + 1)
    ) / 6;
    const center = this.noise(x, y, z);
    return (corners + sides + center) / 3;
  }

  private interpolatedNoise(x: number, y: number, z: number): number {
    const intX = Math.floor(x);
    const fracX = x - intX;
    const intY = Math.floor(y);
    const fracY = y - intY;
    const intZ = Math.floor(z);
    const fracZ = z - intZ;

    const v000 = this.smoothNoise(intX, intY, intZ);
    const v100 = this.smoothNoise(intX + 1, intY, intZ);
    const v010 = this.smoothNoise(intX, intY + 1, intZ);
    const v110 = this.smoothNoise(intX + 1, intY + 1, intZ);
    const v001 = this.smoothNoise(intX, intY, intZ + 1);
    const v101 = this.smoothNoise(intX + 1, intY, intZ + 1);
    const v011 = this.smoothNoise(intX, intY + 1, intZ + 1);
    const v111 = this.smoothNoise(intX + 1, intY + 1, intZ + 1);

    const iX00 = v000 * (1 - fracX) + v100 * fracX;
    const iX10 = v010 * (1 - fracX) + v110 * fracX;
    const iX01 = v001 * (1 - fracX) + v101 * fracX;
    const iX11 = v011 * (1 - fracX) + v111 * fracX;

    const iXY0 = iX00 * (1 - fracY) + iX10 * fracY;
    const iXY1 = iX01 * (1 - fracY) + iX11 * fracY;

    return iXY0 * (1 - fracZ) + iXY1 * fracZ;
  }

  calculateWindForceAtPoint(position: Point, time: number): Point {
    const baseForce = {
      x: this.config.direction.x * this.config.speed,
      y: this.config.direction.y * this.config.speed,
      z: this.config.direction.z * this.config.speed,
    };

    if (this.config.turbulence > 0) {
      const t = time * this.config.frequency;
      const noiseX = this.interpolatedNoise(position.x * 0.1 + t, position.y * 0.1, position.z * 0.1);
      const noiseY = this.interpolatedNoise(position.x * 0.1, position.y * 0.1 + t, position.z * 0.1);
      const noiseZ = this.interpolatedNoise(position.x * 0.1, position.y * 0.1, position.z * 0.1 + t);

      const turbulenceStrength = this.config.turbulence * this.config.speed * 0.5;
      baseForce.x += (noiseX - 0.5) * turbulenceStrength;
      baseForce.y += (noiseY - 0.5) * turbulenceStrength;
      baseForce.z += (noiseZ - 0.5) * turbulenceStrength * 0.3;
    }

    const forceMagnitude = Math.sqrt(baseForce.x ** 2 + baseForce.y ** 2 + baseForce.z ** 2);
    if (forceMagnitude > this.maxWindForce) {
      const scale = this.maxWindForce / forceMagnitude;
      baseForce.x *= scale;
      baseForce.y *= scale;
      baseForce.z *= scale;
    }

    return baseForce;
  }

  calculateWindForces(skeleton: Skeleton, time: number): Map<string, Point> {
    const forces = new Map<string, Point>();

    for (const node of skeleton.nodes) {
      if (node.isFixed) continue;

      const windForce = this.calculateWindForceAtPoint(node.position, time);
      const forceMultiplier = Math.min(node.mass * 0.5, 10);
      const effectiveForce = {
        x: windForce.x * forceMultiplier,
        y: windForce.y * forceMultiplier,
        z: windForce.z * forceMultiplier * 0.5,
      };

      const forceMag = Math.sqrt(effectiveForce.x ** 2 + effectiveForce.y ** 2 + effectiveForce.z ** 2);
      if (forceMag > this.maxWindForce) {
        const scale = this.maxWindForce / forceMag;
        effectiveForce.x *= scale;
        effectiveForce.y *= scale;
        effectiveForce.z *= scale;
      }

      forces.set(node.id, effectiveForce);
    }

    return forces;
  }

  simulateWindStep(skeleton: Skeleton, deltaTime: number): Skeleton {
    this.time += deltaTime;
    const windForces = this.calculateWindForces(skeleton, this.time);
    return this.stressCalculator.updatePhysics(skeleton, deltaTime, windForces);
  }

  simulateWind(skeleton: Skeleton, duration: number, stepTime: number = 0.016): Skeleton[] {
    const frames: Skeleton[] = [];
    let currentSkeleton = JSON.parse(JSON.stringify(skeleton));
    const steps = Math.floor(duration / stepTime);

    for (let i = 0; i < steps; i++) {
      currentSkeleton = this.simulateWindStep(currentSkeleton, stepTime);
      if (i % 3 === 0) {
        frames.push(JSON.parse(JSON.stringify(currentSkeleton)));
      }
    }

    return frames;
  }

  createGust(intensity: number, duration: number = 1): void {
    const safeIntensity = Math.max(1, Math.min(5, intensity));
    const originalSpeed = this.config.speed;
    this.config.speed = Math.min(this.maxSpeed, this.config.speed * safeIntensity);
    setTimeout(() => {
      this.config.speed = originalSpeed;
    }, duration * 1000);
  }

  getWindDirection(): Point {
    return { ...this.config.direction };
  }

  getWindSpeed(): number {
    return this.config.speed;
  }

  getTime(): number {
    return this.time;
  }

  resetTime(): void {
    this.time = 0;
  }

  calculateWindStress(skeleton: Skeleton): {
    maxNodeForce: number;
    totalWindForce: Point;
    criticalNodes: string[];
  } {
    const forces = this.calculateWindForces(skeleton, this.time);
    let maxNodeForce = 0;
    let totalWindForce = { x: 0, y: 0, z: 0 };

    for (const [, force] of forces) {
      const magnitude = Math.sqrt(force.x ** 2 + force.y ** 2 + force.z ** 2);
      maxNodeForce = Math.max(maxNodeForce, magnitude);
      totalWindForce.x += force.x;
      totalWindForce.y += force.y;
      totalWindForce.z += force.z;
    }

    const stressResult = this.stressCalculator.calculateStress(skeleton, forces);
    const criticalNodes: string[] = [];

    for (const [nodeId, stress] of stressResult.nodeStresses) {
      const node = skeleton.nodes.find(n => n.id === nodeId);
      if (node && stress > node.maxStress * 0.7) {
        criticalNodes.push(nodeId);
      }
    }

    return {
      maxNodeForce,
      totalWindForce,
      criticalNodes,
    };
  }

  testWindResistance(skeleton: Skeleton, maxSpeed: number = 20): {
    breakingSpeed: number;
    firstFailureNode: string | null;
    isStable: boolean;
  } {
    const originalSpeed = this.config.speed;
    let breakingSpeed = maxSpeed;
    let firstFailureNode: string | null = null;

    for (let speed = 0; speed <= maxSpeed; speed += 2) {
      this.config.speed = speed;
      const { criticalNodes } = this.calculateWindStress(skeleton);

      if (criticalNodes.length > 0 && firstFailureNode === null) {
        breakingSpeed = speed;
        firstFailureNode = criticalNodes[0];
        break;
      }
    }

    this.config.speed = originalSpeed;

    return {
      breakingSpeed,
      firstFailureNode,
      isStable: breakingSpeed >= maxSpeed,
    };
  }

  simulateVortexEffect(skeleton: Skeleton, center: Point, radius: number, strength: number): Map<string, Point> {
    const forces = new Map<string, Point>();

    for (const node of skeleton.nodes) {
      if (node.isFixed) continue;

      const dx = node.position.x - center.x;
      const dy = node.position.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const falloff = 1 - dist / radius;
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        const forceMagnitude = strength * falloff * falloff;

        forces.set(node.id, {
          x: Math.cos(angle) * forceMagnitude,
          y: Math.sin(angle) * forceMagnitude,
          z: 0,
        });
      }
    }

    return forces;
  }
}
