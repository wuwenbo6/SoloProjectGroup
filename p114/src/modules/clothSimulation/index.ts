import type { ClothConfig, ClothParticle, ClothConstraint, Point, WindConfig } from '../../types';

export class ClothSimulator {
  private particles: ClothParticle[] = [];
  private constraints: ClothConstraint[] = [];
  private config: ClothConfig;
  private time: number = 0;

  constructor(config: Partial<ClothConfig> = {}) {
    this.config = {
      width: 5,
      height: 5,
      columns: 10,
      rows: 10,
      stiffness: 0.9,
      damping: 0.95,
      mass: 1,
      gravity: { x: 0, y: 0, z: -9.8 },
      windInfluence: 0.3,
      ...config,
    };
    this.initializeCloth();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private getParticleIndex(row: number, col: number): number {
    return row * this.config.columns + col;
  }

  private distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  initializeCloth(): void {
    this.particles = [];
    this.constraints = [];

    const { width, height, columns, rows, mass } = this.config;
    const cellWidth = width / (columns - 1);
    const cellHeight = height / (rows - 1);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const particle: ClothParticle = {
          position: {
            x: (col - columns / 2) * cellWidth,
            y: (row - rows / 2) * cellHeight,
            z: 5,
          },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass,
          isFixed: row === 0 && (col === 0 || col === columns - 1 || col === Math.floor(columns / 2)),
          normal: { x: 0, y: 0, z: 1 },
        };
        this.particles.push(particle);
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const index = this.getParticleIndex(row, col);

        if (col < columns - 1) {
          this.addConstraint(index, index + 1);
        }

        if (row < rows - 1) {
          this.addConstraint(index, index + columns);
        }

        if (col < columns - 1 && row < rows - 1) {
          this.addConstraint(index, index + columns + 1);
        }
        if (col > 0 && row < rows - 1) {
          this.addConstraint(index, index + columns - 1);
        }

        if (col < columns - 2) {
          this.addBendingConstraint(index, index + 2);
        }
        if (row < rows - 2) {
          this.addBendingConstraint(index, index + columns * 2);
        }
      }
    }

    this.updateNormals();
  }

  private addConstraint(indexA: number, indexB: number, stiffness?: number): void {
    const particleA = this.particles[indexA];
    const particleB = this.particles[indexB];

    this.constraints.push({
      particleA: indexA,
      particleB: indexB,
      restLength: this.distance(particleA.position, particleB.position),
      stiffness: stiffness ?? this.config.stiffness,
    });
  }

  private addBendingConstraint(indexA: number, indexB: number): void {
    this.addConstraint(indexA, indexB, this.config.stiffness * 0.3);
  }

  update(deltaTime: number, windConfig?: WindConfig): void {
    this.time += deltaTime;

    this.applyGravity();

    if (windConfig) {
      this.applyWind(windConfig);
    }

    this.integrate(deltaTime);
    this.satisfyConstraints();
    this.updateNormals();
  }

  private applyGravity(): void {
    for (const particle of this.particles) {
      if (particle.isFixed) continue;
      particle.acceleration.x += this.config.gravity.x;
      particle.acceleration.y += this.config.gravity.y;
      particle.acceleration.z += this.config.gravity.z;
    }
  }

  applyWind(windConfig: WindConfig): void {
    const { speed, direction, turbulence, frequency } = windConfig;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.isFixed) continue;

      const row = Math.floor(i / this.config.columns);
      const col = i % this.config.columns;

      const noise = Math.sin(this.time * frequency + row * 0.5 + col * 0.3) * turbulence;
      const windStrength = speed * this.config.windInfluence;

      const windForce = {
        x: (direction.x + noise * 0.5) * windStrength,
        y: (direction.y + noise * 0.5) * windStrength,
        z: (direction.z + noise * 0.3) * windStrength,
      };

      const normalInfluence =
        particle.normal.x * direction.x +
        particle.normal.y * direction.y +
        particle.normal.z * direction.z;

      const influence = Math.max(0, normalInfluence + 0.5);

      particle.acceleration.x += windForce.x * influence / particle.mass;
      particle.acceleration.y += windForce.y * influence / particle.mass;
      particle.acceleration.z += windForce.z * influence / particle.mass;
    }
  }

  private integrate(deltaTime: number): void {
    for (const particle of this.particles) {
      if (particle.isFixed) continue;

      particle.velocity.x += particle.acceleration.x * deltaTime;
      particle.velocity.y += particle.acceleration.y * deltaTime;
      particle.velocity.z += particle.acceleration.z * deltaTime;

      particle.velocity.x *= this.config.damping;
      particle.velocity.y *= this.config.damping;
      particle.velocity.z *= this.config.damping;

      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.position.z += particle.velocity.z * deltaTime;

      particle.acceleration = { x: 0, y: 0, z: 0 };
    }
  }

  private satisfyConstraints(): void {
    const iterations = 5;

    for (let iter = 0; iter < iterations; iter++) {
      for (const constraint of this.constraints) {
        const particleA = this.particles[constraint.particleA];
        const particleB = this.particles[constraint.particleB];

        const dx = particleB.position.x - particleA.position.x;
        const dy = particleB.position.y - particleA.position.y;
        const dz = particleB.position.z - particleA.position.z;
        const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (currentLength === 0) continue;

        const diff = (constraint.restLength - currentLength) / currentLength;
        const correction = constraint.stiffness * diff * 0.5;

        if (!particleA.isFixed) {
          particleA.position.x -= dx * correction;
          particleA.position.y -= dy * correction;
          particleA.position.z -= dz * correction;
        }
        if (!particleB.isFixed) {
          particleB.position.x += dx * correction;
          particleB.position.y += dy * correction;
          particleB.position.z += dz * correction;
        }
      }
    }
  }

  private updateNormals(): void {
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.columns; col++) {
        const index = this.getParticleIndex(row, col);

        if (col > 0 && col < this.config.columns - 1 && row > 0 && row < this.config.rows - 1) {
          const left = this.particles[index - 1].position;
          const right = this.particles[index + 1].position;
          const top = this.particles[index - this.config.columns].position;
          const bottom = this.particles[index + this.config.columns].position;

          const current = this.particles[index].position;

          const tx = right.x - left.x;
          const ty = right.y - left.y;
          const tz = right.z - left.z;

          const bx = bottom.x - top.x;
          const by = bottom.y - top.y;
          const bz = bottom.z - top.z;

          const nx = ty * bz - tz * by;
          const ny = tz * bx - tx * bz;
          const nz = tx * by - ty * bx;

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (len > 0) {
            this.particles[index].normal = {
              x: nx / len,
              y: ny / len,
              z: nz / len,
            };
          }
        }
      }
    }
  }

  setParticleFixed(row: number, col: number, isFixed: boolean): boolean {
    const index = this.getParticleIndex(row, col);
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].isFixed = isFixed;
      return true;
    }
    return false;
  }

  getParticle(row: number, col: number): ClothParticle | null {
    const index = this.getParticleIndex(row, col);
    if (index >= 0 && index < this.particles.length) {
      return { ...this.particles[index] };
    }
    return null;
  }

  getParticles(): ClothParticle[] {
    return JSON.parse(JSON.stringify(this.particles));
  }

  getConstraints(): ClothConstraint[] {
    return JSON.parse(JSON.stringify(this.constraints));
  }

  getConfig(): ClothConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ClothConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.time = 0;
    this.initializeCloth();
  }

  getTime(): number {
    return this.time;
  }

  getBoundingBox(): { min: Point; max: Point } {
    let min = { x: Infinity, y: Infinity, z: Infinity };
    let max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (const particle of this.particles) {
      min.x = Math.min(min.x, particle.position.x);
      min.y = Math.min(min.y, particle.position.y);
      min.z = Math.min(min.z, particle.position.z);
      max.x = Math.max(max.x, particle.position.x);
      max.y = Math.max(max.y, particle.position.y);
      max.z = Math.max(max.z, particle.position.z);
    }

    return { min, max };
  }

  applyForceAtPosition(position: Point, force: Point, radius: number = 1): void {
    for (const particle of this.particles) {
      if (particle.isFixed) continue;

      const dist = this.distance(particle.position, position);
      if (dist < radius) {
        const influence = 1 - dist / radius;
        particle.acceleration.x += (force.x * influence) / particle.mass;
        particle.acceleration.y += (force.y * influence) / particle.mass;
        particle.acceleration.z += (force.z * influence) / particle.mass;
      }
    }
  }
}
