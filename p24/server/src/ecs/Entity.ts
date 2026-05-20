import { v4 as uuidv4 } from 'uuid';

export class Entity {
  public readonly id: string;
  private components: Map<string, any> = new Map();

  constructor(id?: string) {
    this.id = id || uuidv4();
  }

  addComponent<T>(component: T): void {
    const componentName = (component as any).constructor.name;
    this.components.set(componentName, component);
  }

  getComponent<T>(componentType: new (...args: any[]) => T): T | undefined {
    return this.components.get(componentType.name) as T;
  }

  hasComponent(componentType: new (...args: any[]) => any): boolean {
    return this.components.has(componentType.name);
  }

  removeComponent(componentType: new (...args: any[]) => any): void {
    this.components.delete(componentType.name);
  }

  getAllComponents(): Map<string, any> {
    return new Map(this.components);
  }

  toJSON(): any {
    const obj: any = { id: this.id };
    this.components.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}
