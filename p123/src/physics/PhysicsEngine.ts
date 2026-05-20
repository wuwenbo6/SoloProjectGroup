import { BaseObject, WaterLevel, WaterWheel, Gear, LoadObject, MATERIALS } from '@/types';
import { updateConnectedGears, areGearsMeshed } from './GearSystem';

export class PhysicsEngine {
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  updateSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  update(
    objects: BaseObject[],
    waterLevel: WaterLevel,
    deltaTime: number,
    isPlaying: boolean
  ): { objects: BaseObject[]; waterLevel: WaterLevel; totalPower: number } {
    let updatedObjects = [...objects];
    let totalPower = 0;

    for (let i = 0; i < updatedObjects.length; i++) {
      const obj = updatedObjects[i];
      
      if (obj.type === 'waterwheel') {
        const wheel = obj as WaterWheel;
        const waterForce = this.calculateWaterForce(wheel, waterLevel);
        const updatedWheel = this.updateWaterWheelPhysics(wheel, waterForce, deltaTime, isPlaying);
        updatedObjects[i] = updatedWheel;
        
        for (let j = 0; j < updatedObjects.length; j++) {
          const otherObj = updatedObjects[j];
          if (otherObj.type === 'gear') {
            const gear = otherObj as Gear;
            
            const pseudoGear: Gear = {
              ...gear,
              radius: wheel.radius,
              teeth: Math.round(wheel.radius * 0.8),
            } as Gear;
            
            if (areGearsMeshed(pseudoGear, gear)) {
              const gearRatio = (wheel.radius * 0.3) / gear.teeth;
              gear.angularVelocity = -wheel.angularVelocity * gearRatio;
            }
          }
        }
      }
    }

    updatedObjects = updateConnectedGears(updatedObjects, deltaTime);

    updatedObjects = updatedObjects.map(obj => {
      if (obj.type === 'load') {
        return this.updateLoad(obj as LoadObject, updatedObjects, deltaTime, isPlaying);
      }
      return obj;
    });

    if (isPlaying) {
      updatedObjects = updatedObjects.map(obj => this.applyDurabilityWear(obj, deltaTime));
    }

    updatedObjects.forEach(obj => {
      if (obj.type === 'load') {
        totalPower += (obj as LoadObject).output || 0;
      }
    });

    return {
      objects: updatedObjects,
      waterLevel: waterLevel,
      totalPower,
    };
  }

  private calculateWaterForce(wheel: WaterWheel, waterLevel: WaterLevel): number {
    const waterY = this.canvasHeight - waterLevel.height;
    const wheelBottom = wheel.y + wheel.radius;
    const wheelTop = wheel.y - wheel.radius;

    if (wheelBottom < waterY) {
      return 0;
    }

    const submergedHeight = Math.min(wheelBottom, this.canvasHeight) - Math.max(wheelTop, waterY);
    if (submergedHeight <= 0) {
      return 0;
    }

    const submergedRatio = submergedHeight / (2 * wheel.radius);
    const baseForce = 500 * submergedRatio;

    const material = MATERIALS[wheel.material || 'wood'];
    const materialBonus = material.density * 0.1;

    return baseForce * (1 + materialBonus);
  }

  private updateWaterWheelPhysics(
    wheel: WaterWheel,
    waterForce: number,
    deltaTime: number,
    isPlaying: boolean
  ): WaterWheel {
    const material = MATERIALS[wheel.material || 'wood'];
    const friction = material.friction;

    const momentOfInertia = 0.5 * material.density * wheel.radius * wheel.radius;
    const torque = waterForce * wheel.radius * 0.5;
    const angularAcceleration = torque / momentOfInertia;

    let newAngularVelocity = wheel.angularVelocity;
    
    if (isPlaying) {
      newAngularVelocity = (wheel.angularVelocity + angularAcceleration * deltaTime) * (1 - friction * 0.1);
    }

    const maxVelocity = 15;
    newAngularVelocity = Math.max(-maxVelocity, Math.min(maxVelocity, newAngularVelocity));

    const newRotation = wheel.rotation + newAngularVelocity * deltaTime;

    return {
      ...wheel,
      angularVelocity: newAngularVelocity,
      angularAcceleration: angularAcceleration,
      rotation: newRotation,
    };
  }

  private updateLoad(
    load: LoadObject,
    allObjects: BaseObject[],
    deltaTime: number,
    isPlaying: boolean
  ): LoadObject {
    if (!load.connectedTo || !isPlaying) {
      return { ...load, isRunning: false, output: 0 };
    }

    const connectedGear = allObjects.find(o => o.id === load.connectedTo) as Gear;
    if (!connectedGear) {
      return { ...load, isRunning: false, output: 0, connectedTo: null };
    }

    const rpm = Math.abs((connectedGear.angularVelocity * 60) / (2 * Math.PI));
    const material = MATERIALS[load.material || 'metal'];
    const efficiency = load.efficiency * (1 / material.friction);

    const basePower = this.getLoadBasePower(load.loadType);
    const output = Math.min(rpm * basePower * efficiency * 0.01, basePower * 2);

    return {
      ...load,
      isRunning: rpm > 1,
      output,
      rotation: load.rotation + connectedGear.angularVelocity * deltaTime * 0.5,
    };
  }

  private getLoadBasePower(loadType: string): number {
    const powers: Record<string, number> = {
      generator: 100,
      millstone: 50,
      pump: 75,
      conveyor: 60,
    };
    return powers[loadType] || 50;
  }

  private applyDurabilityWear(obj: BaseObject, deltaTime: number): BaseObject {
    if (obj.durability === undefined || obj.durability <= 0) {
      return obj;
    }

    let wearRate = 0;
    const material = MATERIALS[obj.material || 'wood'];

    if (obj.type === 'waterwheel') {
      const wheel = obj as WaterWheel;
      wearRate = Math.abs(wheel.angularVelocity) * (1 / material.strength) * 0.1;
    } else if (obj.type === 'gear') {
      const gear = obj as Gear;
      wearRate = Math.abs(gear.angularVelocity) * (1 / material.strength) * 0.05;
    } else if (obj.type === 'load') {
      const load = obj as LoadObject;
      if (load.isRunning) {
        wearRate = 0.02 * (1 / material.strength);
      }
    }

    const newDurability = Math.max(0, obj.durability - wearRate * deltaTime);

    return {
      ...obj,
      durability: newDurability,
    };
  }

  static smoothWaterLevel(waterLevel: WaterLevel): WaterLevel {
    const diff = waterLevel.targetHeight - waterLevel.height;
    const smoothedHeight = waterLevel.height + diff * 0.03;

    return {
      ...waterLevel,
      height: Math.max(waterLevel.minHeight, Math.min(waterLevel.maxHeight, smoothedHeight)),
    };
  }
}
