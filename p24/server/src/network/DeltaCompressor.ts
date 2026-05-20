import { deflateSync } from 'zlib';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Health } from '../components/Health';
import { Cargo } from '../components/Cargo';
import { Render } from '../components/Render';

export const enum ComponentType {
  POSITION = 1,
  VELOCITY = 2,
  HEALTH = 3,
  CARGO = 4,
  RENDER = 5,
}

export interface DeltaField {
  fieldId: number;
  value: number | string | boolean | null;
}

export interface DeltaComponent {
  type: ComponentType;
  fields: DeltaField[];
}

export interface DeltaState {
  entityId: string;
  components: DeltaComponent[];
  removed: boolean;
  timestamp: number;
}

export interface CompressedMessage {
  type: 'delta' | 'fullState';
  data: Buffer;
  encoding: 'deflate';
}

const enum PositionField {
  X = 1,
  Y = 2,
  Z = 3,
  ROTATION = 4,
}

const enum VelocityField {
  VX = 1,
  VY = 2,
  VZ = 3,
  ANGULAR_VELOCITY = 4,
}

const enum HealthField {
  CURRENT = 1,
  MAX = 2,
  SHIELD = 3,
}

const enum CargoField {
  CAPACITY = 1,
  ITEM_BASE = 100,
}

const enum RenderField {
  TYPE = 1,
  COLOR = 2,
  SIZE = 3,
}

export class DeltaCompressor {
  private previousStates: Map<string, Map<ComponentType, any>> = new Map();
  private readonly epsilon = 0.01;

  computeDelta(entities: Entity[]): DeltaState[] {
    const deltas: DeltaState[] = [];
    const currentIds = new Set<string>();

    for (const entity of entities) {
      currentIds.add(entity.id);
      const delta = this.computeEntityDelta(entity);
      if (delta) {
        deltas.push(delta);
      }
    }

    for (const id of this.previousStates.keys()) {
      if (!currentIds.has(id)) {
        deltas.push({
          entityId: id,
          components: [],
          removed: true,
          timestamp: Date.now()
        });
        this.previousStates.delete(id);
      }
    }

    return deltas;
  }

  private computeEntityDelta(entity: Entity): DeltaState | null {
    const previous = this.previousStates.get(entity.id);
    const current = this.serializeEntity(entity);
    const components: DeltaComponent[] = [];

    if (!previous) {
      for (const [type, data] of current) {
        const fields = this.componentToFields(type, data);
        if (fields.length > 0) {
          components.push({ type, fields });
        }
      }
      this.previousStates.set(entity.id, current);
    } else {
      for (const [type, currentData] of current) {
        const prevData = previous.get(type);
        if (!prevData) {
          const fields = this.componentToFields(type, currentData);
          if (fields.length > 0) {
            components.push({ type, fields });
          }
        } else {
          const deltaFields = this.computeFieldDelta(type, prevData, currentData);
          if (deltaFields.length > 0) {
            components.push({ type: type, fields: deltaFields });
          }
        }
      }

      for (const type of previous.keys()) {
        if (!current.has(type)) {
          components.push({ type, fields: [] });
        }
      }

      if (components.length > 0) {
        this.previousStates.set(entity.id, current);
      }
    }

    if (components.length > 0) {
      return {
        entityId: entity.id,
        components,
        removed: false,
        timestamp: Date.now()
      };
    }

    return null;
  }

  private serializeEntity(entity: Entity): Map<ComponentType, any> {
    const result = new Map<ComponentType, any>();

    const pos = entity.getComponent(Position);
    if (pos) {
      result.set(ComponentType.POSITION, {
        x: this.roundFloat(pos.x),
        y: this.roundFloat(pos.y),
        z: this.roundFloat(pos.z),
        rotation: this.roundFloat(pos.rotation)
      });
    }

    const vel = entity.getComponent(Velocity);
    if (vel) {
      result.set(ComponentType.VELOCITY, {
        vx: this.roundFloat(vel.vx),
        vy: this.roundFloat(vel.vy),
        vz: this.roundFloat(vel.vz),
        angularVelocity: this.roundFloat(vel.angularVelocity)
      });
    }

    const health = entity.getComponent(Health);
    if (health) {
      result.set(ComponentType.HEALTH, {
        current: health.current,
        max: health.max,
        shield: health.shield
      });
    }

    const cargo = entity.getComponent(Cargo);
    if (cargo) {
      result.set(ComponentType.CARGO, {
        capacity: cargo.capacity,
        items: Object.fromEntries(cargo.items)
      });
    }

    const render = entity.getComponent(Render);
    if (render) {
      result.set(ComponentType.RENDER, {
        type: render.type,
        color: render.color,
        size: this.roundFloat(render.size)
      });
    }

    return result;
  }

  private roundFloat(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private componentToFields(type: ComponentType, data: any): DeltaField[] {
    const fields: DeltaField[] = [];

    switch (type) {
      case ComponentType.POSITION:
        fields.push({ fieldId: PositionField.X, value: data.x });
        fields.push({ fieldId: PositionField.Y, value: data.y });
        fields.push({ fieldId: PositionField.Z, value: data.z });
        fields.push({ fieldId: PositionField.ROTATION, value: data.rotation });
        break;

      case ComponentType.VELOCITY:
        fields.push({ fieldId: VelocityField.VX, value: data.vx });
        fields.push({ fieldId: VelocityField.VY, value: data.vy });
        fields.push({ fieldId: VelocityField.VZ, value: data.vz });
        fields.push({ fieldId: VelocityField.ANGULAR_VELOCITY, value: data.angularVelocity });
        break;

      case ComponentType.HEALTH:
        fields.push({ fieldId: HealthField.CURRENT, value: data.current });
        fields.push({ fieldId: HealthField.MAX, value: data.max });
        fields.push({ fieldId: HealthField.SHIELD, value: data.shield });
        break;

      case ComponentType.CARGO:
        fields.push({ fieldId: CargoField.CAPACITY, value: data.capacity });
        for (const [key, value] of Object.entries(data.items || {})) {
          fields.push({ fieldId: this.itemNameToId(key), value: value as number });
        }
        break;

      case ComponentType.RENDER:
        fields.push({ fieldId: RenderField.TYPE, value: data.type });
        fields.push({ fieldId: RenderField.COLOR, value: data.color });
        fields.push({ fieldId: RenderField.SIZE, value: data.size });
        break;
    }

    return fields;
  }

  private computeFieldDelta(type: ComponentType, prev: any, current: any): DeltaField[] {
    const fields: DeltaField[] = [];

    switch (type) {
      case ComponentType.POSITION:
        if (Math.abs(current.x - prev.x) > this.epsilon) {
          fields.push({ fieldId: PositionField.X, value: current.x });
        }
        if (Math.abs(current.y - prev.y) > this.epsilon) {
          fields.push({ fieldId: PositionField.Y, value: current.y });
        }
        if (Math.abs(current.z - prev.z) > this.epsilon) {
          fields.push({ fieldId: PositionField.Z, value: current.z });
        }
        if (Math.abs(current.rotation - prev.rotation) > this.epsilon) {
          fields.push({ fieldId: PositionField.ROTATION, value: current.rotation });
        }
        break;

      case ComponentType.VELOCITY:
        if (Math.abs(current.vx - prev.vx) > this.epsilon) {
          fields.push({ fieldId: VelocityField.VX, value: current.vx });
        }
        if (Math.abs(current.vy - prev.vy) > this.epsilon) {
          fields.push({ fieldId: VelocityField.VY, value: current.vy });
        }
        if (Math.abs(current.vz - prev.vz) > this.epsilon) {
          fields.push({ fieldId: VelocityField.VZ, value: current.vz });
        }
        if (Math.abs(current.angularVelocity - prev.angularVelocity) > this.epsilon) {
          fields.push({ fieldId: VelocityField.ANGULAR_VELOCITY, value: current.angularVelocity });
        }
        break;

      case ComponentType.HEALTH:
        if (current.current !== prev.current) {
          fields.push({ fieldId: HealthField.CURRENT, value: current.current });
        }
        if (current.max !== prev.max) {
          fields.push({ fieldId: HealthField.MAX, value: current.max });
        }
        if (current.shield !== prev.shield) {
          fields.push({ fieldId: HealthField.SHIELD, value: current.shield });
        }
        break;

      case ComponentType.CARGO:
        if (current.capacity !== prev.capacity) {
          fields.push({ fieldId: CargoField.CAPACITY, value: current.capacity });
        }
        const prevItems = prev.items || {};
        const currItems = current.items || {};
        const allKeys = new Set([...Object.keys(prevItems), ...Object.keys(currItems)]);
        for (const key of allKeys) {
          const prevVal = prevItems[key] || 0;
          const currVal = currItems[key] || 0;
          if (prevVal !== currVal) {
            fields.push({ fieldId: this.itemNameToId(key), value: currVal || null });
          }
        }
        break;

      case ComponentType.RENDER:
        if (current.type !== prev.type) {
          fields.push({ fieldId: RenderField.TYPE, value: current.type });
        }
        if (current.color !== prev.color) {
          fields.push({ fieldId: RenderField.COLOR, value: current.color });
        }
        if (Math.abs(current.size - prev.size) > this.epsilon) {
          fields.push({ fieldId: RenderField.SIZE, value: current.size });
        }
        break;
    }

    return fields;
  }

  private itemNameToId(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return CargoField.ITEM_BASE + Math.abs(hash) % 10000;
  }

  private getItemNameHash(name: string): number {
    return this.itemNameToId(name);
  }

  compress(deltas: DeltaState[]): CompressedMessage {
    const json = JSON.stringify(deltas);
    const buffer = Buffer.from(json, 'utf-8');
    const compressed = deflateSync(buffer);

    return {
      type: 'delta',
      data: compressed,
      encoding: 'deflate'
    };
  }

  getFullState(entities: Entity[]): CompressedMessage {
    const fullState = {
      entities: entities.map(e => ({
        id: e.id,
        ...Object.fromEntries(this.serializeEntity(e))
      })),
      timestamp: Date.now()
    };

    const json = JSON.stringify(fullState);
    const buffer = Buffer.from(json, 'utf-8');
    const compressed = deflateSync(buffer);

    return {
      type: 'fullState',
      data: compressed,
      encoding: 'deflate'
    };
  }

  getFullStateRaw(entities: Entity[]): any {
    return {
      entities: entities.map(e => ({
        id: e.id,
        ...Object.fromEntries(this.serializeEntity(e))
      })),
      timestamp: Date.now()
    };
  }

  compressJson(data: any): CompressedMessage {
    const json = JSON.stringify(data);
    const buffer = Buffer.from(json, 'utf-8');
    const compressed = deflateSync(buffer);

    return {
      type: data.type || 'delta',
      data: compressed,
      encoding: 'deflate'
    };
  }

  getCompressionStats(original: any): { originalSize: number; compressedSize: number; ratio: number } {
    const json = JSON.stringify(original);
    const originalBuffer = Buffer.from(json, 'utf-8');
    const compressed = deflateSync(originalBuffer);

    return {
      originalSize: originalBuffer.length,
      compressedSize: compressed.length,
      ratio: originalBuffer.length > 0 ? compressed.length / originalBuffer.length : 1
    };
  }
}
