export class Position {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public rotation: number = 0
  ) {}

  clone(): Position {
    return new Position(this.x, this.y, this.z, this.rotation);
  }

  equals(other: Position): boolean {
    return (
      Math.abs(this.x - other.x) < 0.001 &&
      Math.abs(this.y - other.y) < 0.001 &&
      Math.abs(this.z - other.z) < 0.001 &&
      Math.abs(this.rotation - other.rotation) < 0.001
    );
  }
}
