export class Cargo {
  public items: Map<string, number>;
  private versions: Map<string, number>;

  constructor(public capacity: number = 100, items?: Map<string, number>) {
    this.items = items || new Map();
    this.versions = new Map();
    for (const key of this.items.keys()) {
      this.versions.set(key, 0);
    }
  }

  clone(): Cargo {
    const cargo = new Cargo(this.capacity, new Map(this.items));
    cargo.versions = new Map(this.versions);
    return cargo;
  }

  equals(other: Cargo): boolean {
    if (this.capacity !== other.capacity) return false;
    if (this.items.size !== other.items.size) return false;
    for (const [key, value] of this.items) {
      if (other.items.get(key) !== value) return false;
    }
    return true;
  }

  getVersion(resourceType: string): number {
    return this.versions.get(resourceType) || 0;
  }

  getTotalItems(): number {
    let total = 0;
    for (const count of this.items.values()) {
      total += count;
    }
    return total;
  }

  canAddItem(amount: number = 1): boolean {
    return this.getTotalItems() + amount <= this.capacity;
  }

  addItem(resourceType: string, amount: number = 1): boolean {
    if (!this.canAddItem(amount)) return false;
    const current = this.items.get(resourceType) || 0;
    this.items.set(resourceType, current + amount);
    if (!this.versions.has(resourceType)) {
      this.versions.set(resourceType, 0);
    }
    return true;
  }

  tryRemoveItem(resourceType: string, amount: number, expectedVersion: number): boolean {
    if (amount <= 0) return false;

    const currentVersion = this.versions.get(resourceType) || 0;
    if (currentVersion !== expectedVersion) {
      return false;
    }

    const current = this.items.get(resourceType) || 0;
    if (current < amount) return false;

    const newAmount = current - amount;
    if (newAmount <= 0) {
      this.items.delete(resourceType);
      this.versions.delete(resourceType);
    } else {
      this.items.set(resourceType, newAmount);
      this.versions.set(resourceType, currentVersion + 1);
    }
    return true;
  }

  removeItem(resourceType: string, amount: number = 1): boolean {
    const currentVersion = this.versions.get(resourceType) || 0;
    return this.tryRemoveItem(resourceType, amount, currentVersion);
  }

  tryAcquireResources(resourceType: string, amount: number): number {
    if (amount <= 0) return 0;

    const current = this.items.get(resourceType) || 0;
    const toRemove = Math.min(amount, current);
    
    if (toRemove <= 0) return 0;

    const newAmount = current - toRemove;
    if (newAmount <= 0) {
      this.items.delete(resourceType);
      this.versions.delete(resourceType);
    } else {
      this.items.set(resourceType, newAmount);
      const version = this.versions.get(resourceType) || 0;
      this.versions.set(resourceType, version + 1);
    }
    return toRemove;
  }

  getItemCount(resourceType: string): number {
    return this.items.get(resourceType) || 0;
  }

  getAllVersions(): Map<string, number> {
    return new Map(this.versions);
  }
}
