export type EntityType = 'ship' | 'asteroid' | 'station' | 'projectile';

export class Render {
  constructor(
    public type: EntityType,
    public color: string,
    public size: number
  ) {}

  clone(): Render {
    return new Render(this.type, this.color, this.size);
  }

  equals(other: Render): boolean {
    return (
      this.type === other.type &&
      this.color === other.color &&
      this.size === other.size
    );
  }
}
