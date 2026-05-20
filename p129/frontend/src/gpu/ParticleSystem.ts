import * as THREE from 'three';
import { Particle, ParticleState, SimulationConfig } from '../types';
import particleShader from '../shaders/particle.wgsl?raw';

const PARTICLE_SIZE = 40;
const PARTICLE_FLOAT_COUNT = PARTICLE_SIZE / 4;

export class ParticleSystem {
  private device: GPUDevice;
  private pipeline: GPUComputePipeline;
  private bindGroup: GPUBindGroup;
  private particleBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;
  private readBuffer: GPUBuffer;
  private particles: Particle[];
  private config: SimulationConfig;
  private time: number = 0;
  private pendingRead: boolean = false;

  constructor(device: GPUDevice, config: SimulationConfig) {
    this.device = device;
    this.config = config;
    this.particles = this.initializeParticles();
    
    const buffers = this.createBuffers();
    this.particleBuffer = buffers.particleBuffer;
    this.uniformBuffer = buffers.uniformBuffer;
    
    this.pipeline = this.createPipeline();
    this.bindGroup = this.createBindGroup();
  }

  private initializeParticles(): Particle[] {
    const particles: Particle[] = [];
    const halfBoundary = this.config.boundarySize / 2;

    for (let i = 0; i < this.config.particleCount; i++) {
      const position = new Float32Array([
        (Math.random() - 0.5) * this.config.boundarySize * 0.8,
        (Math.random() - 0.5) * this.config.boundarySize * 0.8,
        (Math.random() - 0.5) * this.config.boundarySize * 0.8,
      ]);

      const velocity = new Float32Array(3);
      const length = Math.sqrt(
        velocity[0] * velocity[0] + 
        velocity[1] * velocity[1] + 
        velocity[2] * velocity[2]
      ) || 1;
      velocity[0] /= length;
      velocity[1] /= length;
      velocity[2] /= length;

      const states: ParticleState[] = ['foraging', 'attacking', 'reproducing', 'sleeping'];
      const state = states[Math.floor(Math.random() * 3)];

      particles.push({
        id: `particle-${i}-${Date.now()}`,
        position,
        velocity,
        state,
        energy: 50 + Math.random() * 50,
        age: 0,
        maxAge: 100 + Math.random() * 100,
      });
    }

    return particles;
  }

  private createBuffers() {
    const particleData = new Float32Array(this.config.particleCount * PARTICLE_FLOAT_COUNT);
    
    for (let i = 0; i < this.config.particleCount; i++) {
      const p = this.particles[i];
      const offset = i * PARTICLE_FLOAT_COUNT;
      
      particleData[offset + 0] = p.position[0];
      particleData[offset + 1] = p.position[1];
      particleData[offset + 2] = p.position[2];
      
      particleData[offset + 3] = p.velocity[0];
      particleData[offset + 4] = p.velocity[1];
      particleData[offset + 5] = p.velocity[2];
      
      const stateMap: Record<ParticleState, number> = {
        foraging: 0,
        attacking: 1,
        reproducing: 2,
        sleeping: 3,
      };
      particleData[offset + 6] = stateMap[p.state];
      
      particleData[offset + 7] = p.energy;
      particleData[offset + 8] = p.age;
      particleData[offset + 9] = p.maxAge;
    }

    const particleBuffer = this.device.createBuffer({
      size: particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(particleBuffer.getMappedRange()).set(particleData);
    particleBuffer.unmap();

    const uniformBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.readBuffer = this.device.createBuffer({
      size: particleData.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    return { particleBuffer, uniformBuffer };
  }

  private createPipeline(): GPUComputePipeline {
    const shaderModule = this.device.createShaderModule({
      code: particleShader,
    });

    return this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
  }

  private createBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });
  }

  update(deltaTime: number): void {
    const clampedDelta = Math.min(deltaTime, 0.1);
    this.time += clampedDelta;

    const uniforms = new Float32Array([
      clampedDelta,
      this.config.boundarySize,
      this.config.speed,
      this.config.particleCount,
      this.config.energyDecayRate,
      this.config.sleepThreshold,
      this.config.wakeThreshold,
      this.time,
      this.config.terrainInfluence,
      this.config.energyFieldStrength,
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(this.config.particleCount / 64));
    
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(
      this.particleBuffer, 0,
      this.readBuffer, 0,
      this.particleBuffer.size
    );

    this.device.queue.submit([commandEncoder.finish()]);

    if (!this.pendingRead) {
      this.updateParticleData();
    }
  }

  private async updateParticleData(): Promise<void> {
    this.pendingRead = true;
    
    try {
      await this.readBuffer.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(this.readBuffer.getMappedRange());

      const stateMap: ParticleState[] = ['foraging', 'attacking', 'reproducing', 'sleeping'];
      
      for (let i = 0; i < this.config.particleCount; i++) {
        const offset = i * PARTICLE_FLOAT_COUNT;
        const p = this.particles[i];
        
        p.position[0] = data[offset + 0];
        p.position[1] = data[offset + 1];
        p.position[2] = data[offset + 2];
        
        p.velocity[0] = data[offset + 3];
        p.velocity[1] = data[offset + 4];
        p.velocity[2] = data[offset + 5];
        
        const stateValue = data[offset + 6];
        const stateIndex = Math.max(0, Math.min(3, Math.round(stateValue)));
        p.state = stateMap[stateIndex] || 'foraging';
        
        p.energy = Math.max(0, Math.min(100, data[offset + 7]));
        p.age = Math.max(0, data[offset + 8]);
      }

      this.readBuffer.unmap();
    } catch (error) {
      console.error('Error reading particle data from GPU:', error);
    } finally {
      this.pendingRead = false;
    }
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  getParticleBuffer(): GPUBuffer {
    return this.particleBuffer;
  }

  reset(): void {
    this.particles = this.initializeParticles();
    this.time = 0;
    
    const particleData = new Float32Array(this.config.particleCount * PARTICLE_SIZE / 4);
    
    for (let i = 0; i < this.config.particleCount; i++) {
      const p = this.particles[i];
      const offset = i * (PARTICLE_SIZE / 4);
      
      particleData[offset + 0] = p.position[0];
      particleData[offset + 1] = p.position[1];
      particleData[offset + 2] = p.position[2];
      
      particleData[offset + 3] = p.velocity[0];
      particleData[offset + 4] = p.velocity[1];
      particleData[offset + 5] = p.velocity[2];
      
      const stateMap: Record<ParticleState, number> = {
        foraging: 0,
        attacking: 1,
        reproducing: 2,
        sleeping: 3,
      };
      particleData[offset + 6] = stateMap[p.state];
      
      particleData[offset + 7] = p.energy;
      particleData[offset + 8] = p.age;
      particleData[offset + 9] = p.maxAge;
    }

    this.device.queue.writeBuffer(this.particleBuffer, 0, particleData);
  }

  addEnergy(amount: number): void {
    for (const p of this.particles) {
      p.energy = Math.min(100, p.energy + amount);
    }
  }

  getStats() {
    const stats = {
      total: this.particles.length,
      foraging: 0,
      attacking: 0,
      reproducing: 0,
      sleeping: 0,
      averageEnergy: 0,
    };

    let totalEnergy = 0;
    for (const p of this.particles) {
      totalEnergy += p.energy;
      switch (p.state) {
        case 'foraging': stats.foraging++; break;
        case 'attacking': stats.attacking++; break;
        case 'reproducing': stats.reproducing++; break;
        case 'sleeping': stats.sleeping++; break;
      }
    }
    stats.averageEnergy = totalEnergy / this.particles.length;

    return stats;
  }
}
