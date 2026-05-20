import { WaterWheel, WaterLevel } from '@/types';

const GRAVITY = 9.8;
const WATER_DENSITY = 1000;
const FRICTION = 0.98;

export function calculateWaterForce(
  wheel: WaterWheel,
  waterLevel: WaterLevel,
  canvasHeight: number
): number {
  const waterY = canvasHeight - waterLevel.height;
  
  const wheelBottom = wheel.y + wheel.radius;
  const wheelTop = wheel.y - wheel.radius;
  
  if (wheelBottom < waterY) {
    return 0;
  }
  
  const submergedHeight = Math.min(wheelBottom, canvasHeight) - Math.max(wheelTop, waterY);
  
  if (submergedHeight <= 0) {
    return 0;
  }
  
  const submergedRatio = submergedHeight / (2 * wheel.radius);
  const area = Math.PI * wheel.radius * wheel.radius * submergedRatio;
  const force = WATER_DENSITY * GRAVITY * area * 0.001;
  
  return force;
}

export function updateWaterWheelPhysics(
  wheel: WaterWheel,
  waterForce: number,
  deltaTime: number
): WaterWheel {
  const torque = waterForce * wheel.radius * 2;
  const momentOfInertia = 0.5 * 10 * wheel.radius * wheel.radius;
  
  const angularAcceleration = torque / momentOfInertia;
  let newAngularVelocity = (wheel.angularVelocity + angularAcceleration * deltaTime) * FRICTION;
  
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

export function getRPM(wheel: WaterWheel): number {
  return Math.abs((wheel.angularVelocity * 60) / (2 * Math.PI));
}
