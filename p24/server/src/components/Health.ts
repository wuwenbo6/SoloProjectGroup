export class Health {
  constructor(
    public current: number = 100,
    public max: number = 100,
    public shield: number = 50
  ) {}

  clone(): Health {
    return new Health(this.current, this.max, this.shield);
  }

  equals(other: Health): boolean {
    return (
      this.current === other.current &&
      this.max === other.max &&
      this.shield === other.shield
    );
  }

  takeDamage(damage: number): void {
    if (this.shield > 0) {
      const shieldDamage = Math.min(this.shield, damage);
      this.shield -= shieldDamage;
      damage -= shieldDamage;
    }
    this.current = Math.max(0, this.current - damage);
  }

  isDead(): boolean {
    return this.current <= 0;
  }
}
