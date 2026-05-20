import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { Position } from '../components/Position';
import { Render } from '../components/Render';
import { StationCapture } from '../components/Station';
import { PlayerFaction } from '../components/PlayerFaction';
import { FactionManager } from '../managers/FactionManager';

export class CaptureSystem extends System {
  private readonly captureRange = 150;
  private readonly captureRate = 10;
  private factionManager: FactionManager;

  constructor(world: any, factionManager: FactionManager) {
    super(world);
    this.factionManager = factionManager;
  }

  update(deltaTime: number): void {
    this.factionManager.updateWars();

    const stations = this.getEntitiesWithComponents(Position, Render, StationCapture).filter(
      entity => entity.getComponent(Render)!.type === 'station'
    );

    const players = this.getEntitiesWithComponents(Position, Render, PlayerFaction).filter(
      entity => entity.getComponent(Render)!.type === 'ship'
    );

    for (const station of stations) {
      this.processStationCapture(station, players, deltaTime);
    }
  }

  private processStationCapture(station: Entity, players: Entity[], deltaTime: number): void {
    const stationPos = station.getComponent(Position)!;
    const capture = station.getComponent(StationCapture);
    if (!capture) return;

    const factionPresence: Map<string, number> = new Map();

    for (const player of players) {
      const playerPos = player.getComponent(Position)!;
      const playerFaction = player.getComponent(PlayerFaction);

      if (!playerFaction || !playerFaction.factionId) continue;

      const distance = this.getDistance(stationPos, playerPos);
      if (distance <= this.captureRange) {
        const count = factionPresence.get(playerFaction.factionId) || 0;
        factionPresence.set(playerFaction.factionId, count + 1);
      }
    }

    if (factionPresence.size === 0) {
      this.decayCaptureProgress(capture, deltaTime);
      return;
    }

    let dominantFaction: string | null = null;
    let maxPresence = 0;

    for (const [factionId, presence] of factionPresence) {
      if (presence > maxPresence) {
        maxPresence = presence;
        dominantFaction = factionId;
      } else if (presence === maxPresence) {
        dominantFaction = null;
      }
    }

    if (dominantFaction) {
      const canCapture = this.canCaptureStation(dominantFaction, capture);
      if (canCapture) {
        const progress = this.captureRate * maxPresence * deltaTime;
        capture.addProgress(dominantFaction, progress);

        const capturedFaction = capture.attemptCapture();
        if (capturedFaction) {
          this.handleCapture(station, capturedFaction, capture);
        }
      }
    } else {
      this.decayCaptureProgress(capture, deltaTime * 0.5);
    }
  }

  private canCaptureStation(factionId: string, capture: StationCapture): boolean {
    if (!capture.currentFactionId) return true;
    return this.factionManager.areAtWar(factionId, capture.currentFactionId);
  }

  private handleCapture(station: Entity, factionId: string, capture: StationCapture): void {
    if (capture.previousFactionId) {
      const oldFaction = this.factionManager.getFaction(capture.previousFactionId);
      if (oldFaction) {
        oldFaction.removeStation(station.id);
      }
    }

    const newFaction = this.factionManager.getFaction(factionId);
    if (newFaction) {
      newFaction.addStation(station.id);
      this.factionManager.addWarScore(factionId, 100);
    }
  }

  private decayCaptureProgress(capture: StationCapture, deltaTime: number): void {
    const decayRate = 5 * deltaTime;
    let hasProgress = false;

    for (const [factionId, progress] of capture.captureProgress) {
      const newProgress = Math.max(0, progress - decayRate);
      if (newProgress > 0) {
        capture.captureProgress.set(factionId, newProgress);
        hasProgress = true;
      } else {
        capture.captureProgress.delete(factionId);
      }
    }

    if (!hasProgress && capture.status === 'contested') {
      capture.status = capture.currentFactionId ? 'captured' : 'neutral';
    }
  }

  private getDistance(posA: Position, posB: Position): number {
    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
