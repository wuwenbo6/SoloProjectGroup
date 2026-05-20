import { Entity } from '../ecs/Entity';

export type FactionRelation = 'neutral' | 'allied' | 'enemy' | 'war';

export interface FactionMember {
  playerId: string;
  role: 'leader' | 'officer' | 'member';
  joinedAt: number;
}

export interface WarDeclaration {
  warId: string;
  attackerFactionId: string;
  defenderFactionId: string;
  declaredAt: number;
  startTime: number;
  endTime: number | null;
  status: 'pending' | 'active' | 'ended';
  winner: string | null;
}

export interface StationControl {
  stationId: string;
  factionId: string | null;
  capturedAt: number | null;
  controlPoints: number;
  contestingFactions: Map<string, number>;
}

export class Faction {
  public members: Map<string, FactionMember> = new Map();
  public relations: Map<string, FactionRelation> = new Map();
  public stations: Set<string> = new Set();
  public warScore: number = 0;
  public createdAt: number;

  constructor(
    public id: string,
    public name: string,
    public founderId: string
  ) {
    this.createdAt = Date.now();
    this.addMember(founderId, 'leader');
  }

  addMember(playerId: string, role: FactionMember['role'] = 'member'): boolean {
    if (this.members.has(playerId)) return false;
    this.members.set(playerId, {
      playerId,
      role,
      joinedAt: Date.now()
    });
    return true;
  }

  removeMember(playerId: string): boolean {
    if (!this.members.has(playerId)) return false;
    if (this.isLeader(playerId) && this.members.size > 1) {
      return false;
    }
    this.members.delete(playerId);
    return true;
  }

  isMember(playerId: string): boolean {
    return this.members.has(playerId);
  }

  isLeader(playerId: string): boolean {
    const member = this.members.get(playerId);
    return member?.role === 'leader';
  }

  canDeclareWar(playerId: string): boolean {
    const member = this.members.get(playerId);
    return member?.role === 'leader' || member?.role === 'officer';
  }

  getMemberCount(): number {
    return this.members.size;
  }

  setRelation(otherFactionId: string, relation: FactionRelation): void {
    this.relations.set(otherFactionId, relation);
  }

  getRelation(otherFactionId: string): FactionRelation {
    return this.relations.get(otherFactionId) || 'neutral';
  }

  isAtWarWith(otherFactionId: string): boolean {
    return this.getRelation(otherFactionId) === 'war';
  }

  addStation(stationId: string): void {
    this.stations.add(stationId);
  }

  removeStation(stationId: string): void {
    this.stations.delete(stationId);
  }

  getStationCount(): number {
    return this.stations.size;
  }

  addWarScore(points: number): void {
    this.warScore += points;
  }
}
