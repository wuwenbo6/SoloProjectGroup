export class PlayerFaction {
  public factionId: string | null = null;
  public joinRequestTime: number | null = null;
  public lastContributionTime: number = 0;

  isInFaction(): boolean {
    return this.factionId !== null;
  }

  joinFaction(factionId: string): void {
    this.factionId = factionId;
    this.joinRequestTime = null;
  }

  leaveFaction(): void {
    this.factionId = null;
  }

  requestJoin(factionId: string): void {
    this.joinRequestTime = Date.now();
  }

  cancelRequest(): void {
    this.joinRequestTime = null;
  }
}
