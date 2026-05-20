import * as THREE from 'three';
import { Particle, ParticleState } from '../types';

const STATE_COLORS: Record<ParticleState, THREE.Color> = {
  foraging: new THREE.Color(0x00ff00),
  attacking: new THREE.Color(0xff0000),
  reproducing: new THREE.Color(0xff00ff),
  sleeping: new THREE.Color(0x00ffff),
};

function hash(p: THREE.Vector3): number {
  const p3 = new THREE.Vector3(
    (p.x * 0.1031) % 1,
    (p.y * 0.1031) % 1,
    (p.z * 0.1031) % 1
  );
  const dot = p3.x * (p3.y + 33.33) + p3.y * (p3.z + 33.33) + p3.z * (p3.x + 33.33);
  return (dot * 0.1031) % 1;
}

function noise3D(p: THREE.Vector3): number {
  const i = new THREE.Vector3(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  const f = new THREE.Vector3(p.x % 1, p.y % 1, p.z % 1);
  const u = new THREE.Vector3(
    f.x * f.x * (3.0 - 2.0 * f.x),
    f.y * f.y * (3.0 - 2.0 * f.y),
    f.z * f.z * (3.0 - 2.0 * f.z)
  );

  const mix = (a: number, b: number, t: number) => a + (b - a) * t;

  const v000 = hash(i.clone());
  const v100 = hash(i.clone().add(new THREE.Vector3(1, 0, 0)));
  const v010 = hash(i.clone().add(new THREE.Vector3(0, 1, 0)));
  const v110 = hash(i.clone().add(new THREE.Vector3(1, 1, 0)));
  const v001 = hash(i.clone().add(new THREE.Vector3(0, 0, 1)));
  const v101 = hash(i.clone().add(new THREE.Vector3(1, 0, 1)));
  const v011 = hash(i.clone().add(new THREE.Vector3(0, 1, 1)));
  const v111 = hash(i.clone().add(new THREE.Vector3(1, 1, 1)));

  const x00 = mix(v000, v100, u.x);
  const x10 = mix(v010, v110, u.x);
  const x01 = mix(v001, v101, u.x);
  const x11 = mix(v011, v111, u.x);

  const y0 = mix(x00, x10, u.y);
  const y1 = mix(x01, x11, u.y);

  return mix(y0, y1, u.z);
}

function fbmNoise(pos: THREE.Vector3, octaves: number, time: number = 0): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(pos.clone().multiplyScalar(frequency).addScalar(time * 0.01));
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / maxValue;
}

function getTerrainHeight(pos: THREE.Vector3, time: number = 0): number {
  const scale = 0.08;
  const p = pos.clone().multiplyScalar(scale).addScalar(time * 0.01);
  return fbmNoise(p, 4, time) * 2.0 - 1.0;
}

function getEnergyFieldValue(pos: THREE.Vector3, boundarySize: number, time: number = 0): number {
  const centerDist = pos.length() / (boundarySize * 0.5);
  const centerEnergy = Math.max(0, 1 - centerDist * 0.5);

  const fieldScale = 0.15;
  const p = pos.clone().multiplyScalar(fieldScale).addScalar(time * 0.005);
  const noiseEnergy = fbmNoise(p, 3, time);

  const pulseEnergy = Math.sin(time * 0.5 + pos.length() * 0.2) * 0.3 + 0.7;

  return (centerEnergy * 0.4 + noiseEnergy * 0.4 + pulseEnergy * 0.2);
}

export class SceneRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private particles: THREE.Points;
  private boundary: THREE.Mesh;
  private heatmapPlane: THREE.Mesh;
  private terrainPlane: THREE.Mesh;
  private energyFieldVolume: THREE.Mesh;
  private heatmapData: Float32Array;
  private container: HTMLElement;
  private boundarySize: number;
  private time: number = 0;

  constructor(container: HTMLElement, particleCount: number, boundarySize: number) {
    this.container = container;
    this.boundarySize = boundarySize;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = boundarySize * 0.8;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.particles = this.createParticleSystem(particleCount);
    this.boundary = this.createBoundary(boundarySize);
    this.heatmapPlane = this.createHeatmapPlane();
    this.terrainPlane = this.createTerrainPlane();
    this.energyFieldVolume = this.createEnergyFieldVolume();
    this.heatmapData = new Float32Array(256 * 256 * 4);

    this.setupControls();
    this.setupLights();
    this.createFog();
    window.addEventListener('resize', () => this.onResize());
  }

  private createParticleSystem(count: number): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    return points;
  }

  private createBoundary(size: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshBasicMaterial({
      color: 0x333333,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const boundary = new THREE.Mesh(geometry, material);
    this.scene.add(boundary);
    return boundary;
  }

  private createHeatmapPlane(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(this.boundarySize, this.boundarySize);
    const texture = new THREE.DataTexture(
      this.heatmapData,
      256,
      256,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -this.boundarySize / 2 - 0.05;
    this.scene.add(plane);

    return plane;
  }

  private createTerrainPlane(): THREE.Mesh {
    const resolution = 64;
    const geometry = new THREE.PlaneGeometry(
      this.boundarySize,
      this.boundarySize,
      resolution,
      resolution
    );

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const height = getTerrainHeight(new THREE.Vector3(x, 0, z), 0) * 2;
      positions.setZ(i, height);
    }

    geometry.computeVertexNormals();
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x1a472a,
      wireframe: false,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      metalness: 0.3,
      roughness: 0.8,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.position.y = -this.boundarySize / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    return plane;
  }

  private createEnergyFieldVolume(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(
      this.boundarySize * 0.9,
      this.boundarySize * 0.9,
      this.boundarySize * 0.9,
      16,
      16,
      16
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        boundarySize: { value: this.boundarySize },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float boundarySize;
        varying vec3 vWorldPosition;
        
        float hash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        
        float noise3D(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(
              mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
              mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
              u.y
            ),
            mix(
              mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
              mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
              u.y
            ),
            u.z
          );
        }
        
        float fbmNoise(vec3 p, float time) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          float maxValue = 0.0;
          for (int i = 0; i < 3; i++) {
            value += amplitude * noise3D(p * frequency + time * 0.01);
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          return value / maxValue;
        }
        
        void main() {
          float centerDist = length(vWorldPosition) / (boundarySize * 0.5);
          float centerEnergy = max(0.0, 1.0 - centerDist * 0.5);
          
          float fieldScale = 0.15;
          float noiseEnergy = fbmNoise(vWorldPosition * fieldScale, time);
          
          float pulseEnergy = sin(time * 0.5 + length(vWorldPosition) * 0.2) * 0.3 + 0.7;
          
          float energy = centerEnergy * 0.4 + noiseEnergy * 0.4 + pulseEnergy * 0.2;
          
          vec3 color = mix(vec3(0.1, 0.2, 0.5), vec3(0.3, 0.8, 1.0), energy);
          float alpha = energy * 0.15 * (1.0 - centerDist * 0.5);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const volume = new THREE.Mesh(geometry, material);
    this.scene.add(volume);

    return volume;
  }

  private createFog(): void {
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);
  }

  private setupControls(): void {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      this.camera.position.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        deltaX * 0.01
      );
      this.camera.position.applyAxisAngle(
        new THREE.Vector3(1, 0, 0).cross(this.camera.position).normalize(),
        deltaY * 0.01
      );
      this.camera.lookAt(0, 0, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const direction = e.deltaY > 0 ? 1 : -1;
      this.camera.position.multiplyScalar(1 + direction * zoomSpeed);
    });
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    this.scene.add(pointLight);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateParticles(particles: Particle[]): void {
    const positions = this.particles.geometry.attributes.position.array as Float32Array;
    const colors = this.particles.geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      positions[i * 3] = p.position[0];
      positions[i * 3 + 1] = p.position[1];
      positions[i * 3 + 2] = p.position[2];

      const baseColor = STATE_COLORS[p.state];
      const energyMod = p.energy / 100;
      
      const finalColor = baseColor.clone();
      if (p.state === 'sleeping') {
        finalColor.multiplyScalar(0.5 + energyMod * 0.5);
      } else {
        finalColor.multiplyScalar(0.3 + energyMod * 0.7);
      }

      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  updateTerrain(time: number): void {
    const positions = this.terrainPlane.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const height = getTerrainHeight(new THREE.Vector3(x, 0, z), time) * 2;
      positions.setZ(i, height);
    }
    positions.needsUpdate = true;
    this.terrainPlane.geometry.computeVertexNormals();
  }

  updateEnergyField(time: number): void {
    (this.energyFieldVolume.material as THREE.ShaderMaterial).uniforms.time.value = time;
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.updateTerrain(this.time);
    this.updateEnergyField(this.time);
  }

  updateHeatmap(particles: Particle[]): void {
    const size = 256;
    const data = this.heatmapData;
    const halfBoundary = this.boundarySize / 2;

    data.fill(0);

    for (const p of particles) {
      const x = Math.floor(((p.position[0] + halfBoundary) / this.boundarySize) * size);
      const z = Math.floor(((p.position[2] + halfBoundary) / this.boundarySize) * size);

      if (x >= 0 && x < size && z >= 0 && z < size) {
        const intensity = p.state === 'attacking' ? 1.0 : 0.3;
        
        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const px = x + dx;
            const pz = z + dz;
            if (px >= 0 && px < size && pz >= 0 && pz < size) {
              const dist = Math.sqrt(dx * dx + dz * dz);
              const falloff = Math.max(0, 1 - dist / 4);
              const idx = (pz * size + px) * 4;
              data[idx] = Math.min(1, data[idx] + intensity * falloff);
              data[idx + 1] = Math.min(1, data[idx + 1] + intensity * falloff * 0.5);
              data[idx + 3] = 1;
            }
          }
        }
      }
    }

    (this.heatmapPlane.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    window.removeEventListener('resize', () => this.onResize());
  }
}
