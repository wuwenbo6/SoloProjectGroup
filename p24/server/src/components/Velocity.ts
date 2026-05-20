export class Velocity {
  constructor(
    public vx: number = 0,
    public vy: number = 0,
    public vz: number = 0,
    public angularVelocity: number = 0
  ) {}

  clone(): Velocity {
    return new Velocity(this.vx, this.vy, this.vz, this.angularVelocity);
  }

  equals(other: Velocity): boolean {
    return (
      Math.abs(this.vx - other.vx) < 0.001 &&
      Math.abs(this.vy - other.vy) < 0.001 &&
      Math.abs(this.vz - other.vz) < 0.001 &&
      Math.abs(this.angularVelocity - other.angularVelocity) < 0.001
    );
  }
}
