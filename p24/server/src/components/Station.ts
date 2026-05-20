export class StationCapture {
  public currentFactionId: string | null = null;
  public previousFactionId: string | null = null;
  public captureProgress: Map<string, number> = new Map();
  public lastCaptureTime: number | null = null;
  public status: 'neutral' | 'contested' | 'captured' = 'neutral';
  public controlPoints: number = 1000;
  public maxControlPoints: number = 1000;

  addProgress(factionId: string, points: number): void {
    const current = this.captureProgress.get(factionId) || 0;
    this.captureProgress.set(factionId, current + points);
    this.status = 'contested';
  }

  getLeadingFaction(): string | null {
    let maxPoints = 0;
    let leadingFaction: string | null = null;
    
    for (const [factionId, points] of this.captureProgress) {
      if (points > maxPoints) {
        maxPoints = points;
        leadingFaction = factionId;
      }
    }
    return leadingFaction;
  }

  attemptCapture(): string | null {
    const leading = this.getLeadingFaction();
    if (!leading) return null;

    const leadingPoints = this.captureProgress.get(leading) || 0;
    
    let otherMaxPoints = 0;
    for (const [factionId, points] of this.captureProgress) {
      if (factionId !== leading && points > otherMaxPoints) {
        otherMaxPoints = points;
      }
    }

    if (leadingPoints - otherMaxPoints >= this.maxControlPoints) {
      this.previousFactionId = this.currentFactionId;
      this.currentFactionId = leading;
      this.lastCaptureTime = Date.now();
      this.status = 'captured';
      this.captureProgress.clear();
      return leading;
    }

    return null;
  }

  resetProgress(): void {
    this.captureProgress.clear();
    this.status = this.currentFactionId ? 'captured' : 'neutral';
  }

  getProgressForFaction(factionId: string): number {
    return this.captureProgress.get(factionId) || 0;
  }
}
