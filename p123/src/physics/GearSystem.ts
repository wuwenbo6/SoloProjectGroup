import { Gear, BaseObject } from '@/types';

const GEAR_FRICTION = 0.98;

export function areGearsMeshed(gear1: Gear, gear2: Gear): boolean {
  const dx = gear2.x - gear1.x;
  const dy = gear2.y - gear1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const expectedDistance = gear1.radius + gear2.radius;
  
  return Math.abs(distance - expectedDistance) < 25;
}

export function getGearRatio(gear1: Gear, gear2: Gear): number {
  return gear1.teeth / gear2.teeth;
}

export function updateConnectedGears(
  allObjects: BaseObject[],
  deltaTime: number
): BaseObject[] {
  const updatedObjects = [...allObjects];
  const visited = new Set<string>();
  
  for (let i = 0; i < updatedObjects.length; i++) {
    const obj = updatedObjects[i];
    if (obj.type !== 'gear' || visited.has(obj.id)) continue;
    
    const sourceGear = obj as Gear;
    propagateGearVelocity(sourceGear, updatedObjects, visited, deltaTime);
  }
  
  for (let i = 0; i < updatedObjects.length; i++) {
    const obj = updatedObjects[i];
    if (obj.type === 'gear') {
      const gear = obj as Gear;
      gear.angularVelocity *= GEAR_FRICTION;
      gear.rotation += gear.angularVelocity * deltaTime;
    }
  }
  
  return updatedObjects;
}

function propagateGearVelocity(
  sourceGear: Gear,
  allObjects: BaseObject[],
  visited: Set<string>,
  deltaTime: number
): void {
  if (visited.has(sourceGear.id)) return;
  visited.add(sourceGear.id);
  
  for (let i = 0; i < allObjects.length; i++) {
    const obj = allObjects[i];
    if (obj.type !== 'gear' || obj.id === sourceGear.id) continue;
    
    const targetGear = obj as Gear;
    if (areGearsMeshed(sourceGear, targetGear) && !visited.has(targetGear.id)) {
      const ratio = getGearRatio(sourceGear, targetGear);
      targetGear.angularVelocity = -sourceGear.angularVelocity * ratio;
      
      propagateGearVelocity(targetGear, allObjects, visited, deltaTime);
    }
  }
}

export function calculateTorque(gear: Gear): number {
  return gear.radius * Math.abs(gear.angularVelocity);
}
