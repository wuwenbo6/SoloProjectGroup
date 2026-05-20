import { BaseObject, WaterWheel, Gear, WaterLevel, LoadObject, MATERIALS, USER_COLORS } from '@/types';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  clear(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1e3a5f');
    gradient.addColorStop(0.5, '#2d5a87');
    gradient.addColorStop(1, '#3d7ab5');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  renderWater(waterLevel: WaterLevel): void {
    const waterY = this.height - waterLevel.height;

    this.ctx.fillStyle = 'rgba(30, 144, 255, 0.3)';
    this.ctx.fillRect(0, waterY, this.width, waterLevel.height);

    this.ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, waterY);

    for (let x = 0; x <= this.width; x += 10) {
      const waveY = waterY + Math.sin((x + Date.now() * 0.002) * 0.05) * 5;
      this.ctx.lineTo(x, waveY);
    }

    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.closePath();
    this.ctx.fill();

    this.updateAndDrawParticles(waterY);
  }

  private updateAndDrawParticles(waterY: number): void {
    if (Math.random() < 0.1) {
      this.particles.push({
        x: Math.random() * this.width,
        y: this.height - 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 2 - 1,
        life: 1,
      });
    }

    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.02;
      p.life -= 0.01;

      if (p.life > 0 && p.y > waterY) {
        this.ctx.fillStyle = `rgba(200, 230, 255, ${p.life * 0.5})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
        return true;
      }
      return false;
    });
  }

  private getMaterialColor(obj: BaseObject): string {
    const material = MATERIALS[obj.material || 'wood'];
    return material.color;
  }

  private renderCreatorIndicator(obj: BaseObject): void {
    if (!obj.creatorId) return;
    const userColor = USER_COLORS[obj.creatorId.replace('user-', '')] || '#888';
    this.ctx.strokeStyle = userColor;
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([5, 5]);
  }

  renderWaterWheel(wheel: WaterWheel, isSelected: boolean): void {
    this.ctx.save();
    this.ctx.translate(wheel.x, wheel.y);
    this.ctx.rotate(wheel.rotation);

    if (wheel.creatorId) {
      this.renderCreatorIndicator(wheel);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, wheel.radius + 15, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    if (isSelected) {
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, wheel.radius + 10, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    const materialColor = this.getMaterialColor(wheel);
    const darkMaterialColor = this.adjustColor(materialColor, -30);

    this.ctx.fillStyle = materialColor;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, wheel.radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = darkMaterialColor;
    this.ctx.lineWidth = 8;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, wheel.radius - 4, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.fillStyle = darkMaterialColor;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, wheel.radius * 0.15, 0, Math.PI * 2);
    this.ctx.fill();

    const bladeWidth = wheel.radius * 0.4;
    const bladeHeight = wheel.radius * 0.15;

    for (let i = 0; i < wheel.bladeCount; i++) {
      const angle = (i / wheel.bladeCount) * Math.PI * 2;
      const x = Math.cos(angle) * wheel.radius * 0.7;
      const y = Math.sin(angle) * wheel.radius * 0.7;

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle + Math.PI / 2);

      this.ctx.fillStyle = this.adjustColor(materialColor, 15);
      this.ctx.fillRect(-bladeWidth / 2, -bladeHeight / 2, bladeWidth, bladeHeight);

      this.ctx.strokeStyle = darkMaterialColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-bladeWidth / 2, -bladeHeight / 2, bladeWidth, bladeHeight);

      this.ctx.restore();
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * wheel.radius * 0.15, Math.sin(angle) * wheel.radius * 0.15);
      this.ctx.lineTo(Math.cos(angle) * wheel.radius * 0.6, Math.sin(angle) * wheel.radius * 0.6);
      this.ctx.strokeStyle = darkMaterialColor;
      this.ctx.lineWidth = 4;
      this.ctx.stroke();
    }

    if (wheel.durability !== undefined && wheel.maxDurability) {
      const durabilityRatio = wheel.durability / wheel.maxDurability;
      const barWidth = wheel.radius * 1.5;
      const barHeight = 6;
      const barX = -barWidth / 2;
      const barY = -wheel.radius - 20;

      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(barX, barY, barWidth, barHeight);

      const durabilityColor = durabilityRatio > 0.5 ? '#4ade80' : durabilityRatio > 0.25 ? '#fbbf24' : '#ef4444';
      this.ctx.fillStyle = durabilityColor;
      this.ctx.fillRect(barX, barY, barWidth * durabilityRatio, barHeight);
    }

    this.ctx.restore();
  }

  renderGear(gear: Gear, isSelected: boolean): void {
    this.ctx.save();
    this.ctx.translate(gear.x, gear.y);
    this.ctx.rotate(gear.rotation);

    if (gear.creatorId) {
      this.renderCreatorIndicator(gear);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, gear.radius + 25, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    if (isSelected) {
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, gear.radius + 20, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    const materialColor = this.getMaterialColor(gear);
    const darkMaterialColor = this.adjustColor(materialColor, -20);

    this.ctx.fillStyle = materialColor;
    this.ctx.beginPath();

    const toothHeight = gear.radius * 0.15;
    const toothWidth = (Math.PI * 2) / (gear.teeth * 2);

    for (let i = 0; i < gear.teeth; i++) {
      const angle = (i / gear.teeth) * Math.PI * 2;
      const innerRadius = gear.radius - toothHeight;

      const x1 = Math.cos(angle - toothWidth) * innerRadius;
      const y1 = Math.sin(angle - toothWidth) * innerRadius;
      const x2 = Math.cos(angle - toothWidth / 2) * gear.radius;
      const y2 = Math.sin(angle - toothWidth / 2) * gear.radius;
      const x3 = Math.cos(angle + toothWidth / 2) * gear.radius;
      const y3 = Math.sin(angle + toothWidth / 2) * gear.radius;
      const x4 = Math.cos(angle + toothWidth) * innerRadius;
      const y4 = Math.sin(angle + toothWidth) * innerRadius;

      if (i === 0) {
        this.ctx.moveTo(x1, y1);
      }
      this.ctx.lineTo(x2, y2);
      this.ctx.lineTo(x3, y3);
      this.ctx.lineTo(x4, y4);
    }

    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = darkMaterialColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.fillStyle = darkMaterialColor;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, gear.radius * 0.25, 0, Math.PI * 2);
    this.ctx.fill();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const holeRadius = gear.radius * 0.1;
      const holeDistance = gear.radius * 0.5;

      this.ctx.fillStyle = this.adjustColor(darkMaterialColor, -10);
      this.ctx.beginPath();
      this.ctx.arc(
        Math.cos(angle) * holeDistance,
        Math.sin(angle) * holeDistance,
        holeRadius,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }

    if (gear.durability !== undefined && gear.maxDurability) {
      const durabilityRatio = gear.durability / gear.maxDurability;
      const barWidth = gear.radius * 1.5;
      const barHeight = 6;
      const barX = -barWidth / 2;
      const barY = -gear.radius - 25;

      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(barX, barY, barWidth, barHeight);

      const durabilityColor = durabilityRatio > 0.5 ? '#4ade80' : durabilityRatio > 0.25 ? '#fbbf24' : '#ef4444';
      this.ctx.fillStyle = durabilityColor;
      this.ctx.fillRect(barX, barY, barWidth * durabilityRatio, barHeight);
    }

    this.ctx.restore();
  }

  renderLoad(load: LoadObject, isSelected: boolean, allObjects: BaseObject[]): void {
    this.ctx.save();
    this.ctx.translate(load.x, load.y);

    const loadSize = 40;

    if (load.creatorId) {
      this.renderCreatorIndicator(load);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, loadSize + 15, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    if (isSelected) {
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, loadSize + 10, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    if (load.connectedTo) {
      const connectedGear = allObjects.find(o => o.id === load.connectedTo);
      if (connectedGear) {
        this.ctx.restore();
        this.ctx.save();
        this.ctx.strokeStyle = load.isRunning ? '#4ade80' : '#666';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(load.x, load.y);
        this.ctx.lineTo(connectedGear.x, connectedGear.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
        this.ctx.save();
        this.ctx.translate(load.x, load.y);
      }
    }

    const materialColor = this.getMaterialColor(load);
    const loadColors: Record<string, string> = {
      generator: '#ffd700',
      millstone: '#8b7355',
      pump: '#4169e1',
      conveyor: '#32cd32',
    };
    const loadIcons: Record<string, string> = {
      generator: '⚡',
      millstone: '🌾',
      pump: '💧',
      conveyor: '⚙️',
    };

    this.ctx.rotate(load.rotation);
    this.ctx.fillStyle = loadColors[load.loadType] || materialColor;
    this.ctx.fillRect(-loadSize / 2, -loadSize / 2, loadSize, loadSize);

    this.ctx.strokeStyle = this.adjustColor(loadColors[load.loadType] || materialColor, -30);
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(-loadSize / 2, -loadSize / 2, loadSize, loadSize);

    this.ctx.restore();
    this.ctx.save();
    this.ctx.translate(load.x, load.y);

    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(loadIcons[load.loadType] || '?', 0, 0);

    if (load.output !== undefined) {
      this.ctx.font = '12px Arial';
      this.ctx.fillStyle = load.isRunning ? '#4ade80' : '#888';
      this.ctx.fillText(`${Math.round(load.output)}W`, 0, loadSize / 2 + 15);
    }

    if (load.durability !== undefined && load.maxDurability) {
      const durabilityRatio = load.durability / load.maxDurability;
      const barWidth = loadSize * 1.2;
      const barHeight = 4;
      const barX = -barWidth / 2;
      const barY = -loadSize / 2 - 15;

      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(barX, barY, barWidth, barHeight);

      const durabilityColor = durabilityRatio > 0.5 ? '#4ade80' : durabilityRatio > 0.25 ? '#fbbf24' : '#ef4444';
      this.ctx.fillStyle = durabilityColor;
      this.ctx.fillRect(barX, barY, barWidth * durabilityRatio, barHeight);
    }

    this.ctx.restore();
  }

  render(objects: BaseObject[], waterLevel: WaterLevel, selectedObjectId: string | null): void {
    this.clear();
    this.renderWater(waterLevel);

    objects.forEach((obj) => {
      const isSelected = obj.id === selectedObjectId;

      if (obj.type === 'waterwheel') {
        this.renderWaterWheel(obj as WaterWheel, isSelected);
      } else if (obj.type === 'gear') {
        this.renderGear(obj as Gear, isSelected);
      } else if (obj.type === 'load') {
        this.renderLoad(obj as LoadObject, isSelected, objects);
      }
    });
  }

  getObjectAtPoint(x: number, y: number, objects: BaseObject[]): BaseObject | null {
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const dx = x - obj.x;
      const dy = y - obj.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let radius = 0;
      if (obj.type === 'waterwheel') {
        radius = (obj as WaterWheel).radius;
      } else if (obj.type === 'gear') {
        radius = (obj as Gear).radius;
      } else if (obj.type === 'load') {
        radius = 45;
      }

      if (distance <= radius + 10) {
        return obj;
      }
    }
    return null;
  }

  private adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
