import type { Light, Material, RenderState, RenderConfig, Color, Point, Skeleton, Node } from '../../types';

export class LightRenderer {
  private state: RenderState;
  private skeleton?: Skeleton;

  constructor() {
    this.state = {
      lights: [],
      materials: new Map(),
      config: {
        ambientIntensity: 0.3,
        backgroundColor: { r: 20, g: 20, b: 40 },
        enableShadows: true,
        enableReflections: false,
        exposure: 1.0,
      },
      cameraPosition: { x: 0, y: -10, z: 5 },
      cameraTarget: { x: 0, y: 0, z: 0 },
    };

    this.initializeDefaultLights();
    this.initializeDefaultMaterials();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private initializeDefaultLights(): void {
    const ambientLight: Light = {
      id: this.generateId(),
      type: 'ambient',
      position: { x: 0, y: 0, z: 10 },
      color: { r: 255, g: 255, b: 255 },
      intensity: 0.5,
    };

    const keyLight: Light = {
      id: this.generateId(),
      type: 'point',
      position: { x: -5, y: -5, z: 8 },
      color: { r: 255, g: 200, b: 150 },
      intensity: 1.0,
      range: 20,
      castShadows: true,
    };

    const fillLight: Light = {
      id: this.generateId(),
      type: 'point',
      position: { x: 5, y: -3, z: 5 },
      color: { r: 150, g: 200, b: 255 },
      intensity: 0.6,
      range: 15,
    };

    const rimLight: Light = {
      id: this.generateId(),
      type: 'directional',
      position: { x: 0, y: 5, z: 10 },
      direction: { x: 0, y: -1, z: -0.5 },
      color: { r: 255, g: 220, b: 200 },
      intensity: 0.4,
    };

    this.state.lights = [ambientLight, keyLight, fillLight, rimLight];
  }

  private initializeDefaultMaterials(): void {
    const lanternMaterial: Material = {
      id: 'lantern_paper',
      name: '花灯纸',
      color: { r: 255, g: 180, b: 100 },
      emissiveColor: { r: 255, g: 200, b: 120 },
      emissiveIntensity: 0.3,
      roughness: 0.8,
      metalness: 0.1,
      transparency: 0.3,
    };

    const frameMaterial: Material = {
      id: 'bamboo_frame',
      name: '竹制骨架',
      color: { r: 180, g: 140, b: 80 },
      roughness: 0.6,
      metalness: 0.0,
      transparency: 0,
    };

    const goldMaterial: Material = {
      id: 'gold_decoration',
      name: '金色装饰',
      color: { r: 255, g: 215, b: 0 },
      emissiveColor: { r: 255, g: 220, b: 50 },
      emissiveIntensity: 0.2,
      roughness: 0.3,
      metalness: 0.9,
      transparency: 0,
    };

    const redPaper: Material = {
      id: 'red_paper',
      name: '红纸',
      color: { r: 220, g: 50, b: 50 },
      emissiveColor: { r: 255, g: 100, b: 80 },
      emissiveIntensity: 0.4,
      roughness: 0.7,
      metalness: 0.0,
      transparency: 0.2,
    };

    this.state.materials.set(lanternMaterial.id, lanternMaterial);
    this.state.materials.set(frameMaterial.id, frameMaterial);
    this.state.materials.set(goldMaterial.id, goldMaterial);
    this.state.materials.set(redPaper.id, redPaper);
  }

  setSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton;
  }

  addLight(light: Partial<Light>): Light {
    const newLight: Light = {
      id: this.generateId(),
      type: light.type || 'point',
      position: light.position || { x: 0, y: 0, z: 5 },
      direction: light.direction,
      color: light.color || { r: 255, g: 255, b: 255 },
      intensity: light.intensity ?? 1.0,
      range: light.range,
      angle: light.angle,
      castShadows: light.castShadows,
    };

    this.state.lights.push(newLight);
    return newLight;
  }

  removeLight(lightId: string): boolean {
    const index = this.state.lights.findIndex(l => l.id === lightId);
    if (index === -1) return false;
    this.state.lights.splice(index, 1);
    return true;
  }

  updateLight(lightId: string, updates: Partial<Light>): boolean {
    const light = this.state.lights.find(l => l.id === lightId);
    if (!light) return false;

    Object.assign(light, updates);
    return true;
  }

  getLights(): Light[] {
    return JSON.parse(JSON.stringify(this.state.lights));
  }

  getLight(lightId: string): Light | undefined {
    return this.state.lights.find(l => l.id === lightId);
  }

  addMaterial(material: Partial<Material>): Material {
    const newMaterial: Material = {
      id: material.id || this.generateId(),
      name: material.name || 'Unnamed Material',
      color: material.color || { r: 200, g: 200, b: 200 },
      emissiveColor: material.emissiveColor,
      emissiveIntensity: material.emissiveIntensity,
      roughness: material.roughness ?? 0.5,
      metalness: material.metalness ?? 0.0,
      transparency: material.transparency ?? 0,
    };

    this.state.materials.set(newMaterial.id, newMaterial);
    return newMaterial;
  }

  removeMaterial(materialId: string): boolean {
    return this.state.materials.delete(materialId);
  }

  updateMaterial(materialId: string, updates: Partial<Material>): boolean {
    const material = this.state.materials.get(materialId);
    if (!material) return false;

    Object.assign(material, updates);
    return true;
  }

  getMaterials(): Material[] {
    return Array.from(this.state.materials.values()).map(m => ({ ...m }));
  }

  getMaterial(materialId: string): Material | undefined {
    const material = this.state.materials.get(materialId);
    return material ? { ...material } : undefined;
  }

  updateRenderConfig(config: Partial<RenderConfig>): void {
    this.state.config = { ...this.state.config, ...config };
  }

  getRenderConfig(): RenderConfig {
    return { ...this.state.config };
  }

  setCamera(position: Point, target: Point): void {
    this.state.cameraPosition = { ...position };
    this.state.cameraTarget = { ...target };
  }

  getCamera(): { position: Point; target: Point } {
    return {
      position: { ...this.state.cameraPosition },
      target: { ...this.state.cameraTarget },
    };
  }

  calculateNodeLighting(nodePosition: Point, nodeNormal?: Point): { diffuse: Color; specular: Color; ambient: Color } {
    const ambient: Color = {
      r: 255 * this.state.config.ambientIntensity,
      g: 255 * this.state.config.ambientIntensity,
      b: 255 * this.state.config.ambientIntensity,
    };

    let diffuse: Color = { r: 0, g: 0, b: 0 };
    let specular: Color = { r: 0, g: 0, b: 0 };

    for (const light of this.state.lights) {
      if (light.type === 'ambient') {
        ambient.r += light.color.r * light.intensity * 0.1;
        ambient.g += light.color.g * light.intensity * 0.1;
        ambient.b += light.color.b * light.intensity * 0.1;
        continue;
      }

      const lightDir = this.normalizeVector({
        x: light.position.x - nodePosition.x,
        y: light.position.y - nodePosition.y,
        z: light.position.z - nodePosition.z,
      });

      const distance = Math.sqrt(
        Math.pow(light.position.x - nodePosition.x, 2) +
        Math.pow(light.position.y - nodePosition.y, 2) +
        Math.pow(light.position.z - nodePosition.z, 2)
      );

      let attenuation = 1.0;
      if (light.range) {
        attenuation = Math.max(0, 1 - distance / light.range);
      }

      const normal = nodeNormal || { x: 0, y: 0, z: 1 };
      const diffuseFactor = Math.max(0, this.dotProduct(normal, lightDir));

      diffuse.r += light.color.r * light.intensity * diffuseFactor * attenuation;
      diffuse.g += light.color.g * light.intensity * diffuseFactor * attenuation;
      diffuse.b += light.color.b * light.intensity * diffuseFactor * attenuation;

      const viewDir = this.normalizeVector({
        x: this.state.cameraPosition.x - nodePosition.x,
        y: this.state.cameraPosition.y - nodePosition.y,
        z: this.state.cameraPosition.z - nodePosition.z,
      });

      const halfDir = this.normalizeVector({
        x: (lightDir.x + viewDir.x) / 2,
        y: (lightDir.y + viewDir.y) / 2,
        z: (lightDir.z + viewDir.z) / 2,
      });

      const specularFactor = Math.pow(Math.max(0, this.dotProduct(normal, halfDir)), 32);
      specular.r += light.color.r * light.intensity * specularFactor * attenuation * 0.5;
      specular.g += light.color.g * light.intensity * specularFactor * attenuation * 0.5;
      specular.b += light.color.b * light.intensity * specularFactor * attenuation * 0.5;
    }

    return { diffuse, specular, ambient };
  }

  private dotProduct(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private normalizeVector(v: Point): Point {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  calculateFinalColor(baseColor: Color, lighting: { diffuse: Color; specular: Color; ambient: Color }, material?: Material): Color {
    const roughness = material?.roughness ?? 0.5;
    const metalness = material?.metalness ?? 0.0;
    const emissiveIntensity = material?.emissiveIntensity ?? 0;
    const emissiveColor = material?.emissiveColor || { r: 0, g: 0, b: 0 };

    const diffuseFactor = (1 - metalness) * (1 - roughness * 0.5);
    const specularFactor = (1 - roughness) * (0.04 + metalness * 0.96);

    const finalColor: Color = {
      r: Math.min(255,
        baseColor.r * (lighting.ambient.r / 255 + lighting.diffuse.r / 255 * diffuseFactor) +
        lighting.specular.r * specularFactor +
        emissiveColor.r * emissiveIntensity
      ),
      g: Math.min(255,
        baseColor.g * (lighting.ambient.g / 255 + lighting.diffuse.g / 255 * diffuseFactor) +
        lighting.specular.g * specularFactor +
        emissiveColor.g * emissiveIntensity
      ),
      b: Math.min(255,
        baseColor.b * (lighting.ambient.b / 255 + lighting.diffuse.b / 255 * diffuseFactor) +
        lighting.specular.b * specularFactor +
        emissiveColor.b * emissiveIntensity
      ),
    };

    return finalColor;
  }

  getNodeColors(materialId?: string): Map<string, Color> {
    const nodeColors = new Map<string, Color>();

    if (!this.skeleton) return nodeColors;

    const material = materialId ? this.state.materials.get(materialId) : undefined;
    const baseColor = material?.color || { r: 200, g: 150, b: 100 };

    for (const node of this.skeleton.nodes) {
      const lighting = this.calculateNodeLighting(node.position);
      const finalColor = this.calculateFinalColor(baseColor, lighting, material);
      nodeColors.set(node.id, finalColor);
    }

    return nodeColors;
  }

  createLanternGlow(intensity: number = 1.0): Light {
    return this.addLight({
      type: 'point',
      position: { x: 0, y: 0, z: 0 },
      color: { r: 255, g: 180, b: 100 },
      intensity: 0.8 * intensity,
      range: 10,
      castShadows: false,
    });
  }

  setLightColorTemperature(lightId: string, temperature: number): boolean {
    const kelvin = Math.max(1000, Math.min(40000, temperature));
    let r, g, b;

    if (kelvin <= 6600) {
      r = 255;
      g = Math.min(255, 99.4708025861 * Math.log(kelvin / 100) - 161.1195681661);
      if (kelvin <= 1900) {
        b = 0;
      } else {
        b = Math.min(255, 138.5177312231 * Math.log((kelvin - 1000) / 100) - 305.0447927307);
      }
    } else {
      r = Math.min(255, 351.97690566805693 * Math.pow((kelvin / 100 - 60), -0.1332047592));
      g = Math.min(255, 325.4494125797563 + 104.4527982093 * Math.log((kelvin / 100) - 2));
      b = 255;
    }

    return this.updateLight(lightId, { color: { r: Math.max(0, r), g: Math.max(0, g), b: Math.max(0, b) } });
  }

  getRenderState(): RenderState {
    return {
      lights: JSON.parse(JSON.stringify(this.state.lights)),
      materials: new Map(this.state.materials.entries()),
      config: { ...this.state.config },
      cameraPosition: { ...this.state.cameraPosition },
      cameraTarget: { ...this.state.cameraTarget },
    };
  }

  reset(): void {
    this.state.lights = [];
    this.state.materials.clear();
    this.initializeDefaultLights();
    this.initializeDefaultMaterials();
  }
}
