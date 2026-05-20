import { v4 as uuidv4 } from 'uuid';
import { Faction, FactionRelation, WarDeclaration } from '../components/Faction';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { PlayerFaction } from '../components/PlayerFaction';
import { StationCapture } from '../components/Station';

export class FactionManager {
  private factions: Map<string, Faction> = new Map();
  private wars: Map<string, WarDeclaration> = new Map();
  private playerFactions: Map<string, string> = new Map();
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  createFaction(name: string, founderId: string): Faction | null {
    if (this.playerFactions.has(founderId)) {
      return null;
    }

    const factionId = uuidv4();
    const faction = new Faction(factionId, name, founderId);
    this.factions.set(factionId, faction);
    this.playerFactions.set(founderId, factionId);

    const player = this.getPlayerEntity(founderId);
    if (player) {
      let playerFaction = player.getComponent(PlayerFaction);
      if (!playerFaction) {
        playerFaction = new PlayerFaction();
        player.addComponent(playerFaction);
      }
      playerFaction.joinFaction(factionId);
    }

    return faction;
  }

  disbandFaction(factionId: string, playerId: string): boolean {
    const faction = this.factions.get(factionId);
    if (!faction || !faction.isLeader(playerId)) {
      return false;
    }

    for (const memberId of faction.members.keys()) {
      this.playerFactions.delete(memberId);
      const player = this.getPlayerEntity(memberId);
      if (player) {
        const playerFaction = player.getComponent(PlayerFaction);
        if (playerFaction) {
          playerFaction.leaveFaction();
        }
      }
    }

    this.factions.delete(factionId);
    return true;
  }

  joinFaction(factionId: string, playerId: string): boolean {
    const faction = this.factions.get(factionId);
    if (!faction || this.playerFactions.has(playerId)) {
      return false;
    }

    if (faction.addMember(playerId)) {
      this.playerFactions.set(playerId, factionId);
      const player = this.getPlayerEntity(playerId);
      if (player) {
        let playerFaction = player.getComponent(PlayerFaction);
        if (!playerFaction) {
          playerFaction = new PlayerFaction();
          player.addComponent(playerFaction);
        }
        playerFaction.joinFaction(factionId);
      }
      return true;
    }
    return false;
  }

  leaveFaction(playerId: string): boolean {
    const factionId = this.playerFactions.get(playerId);
    if (!factionId) return false;

    const faction = this.factions.get(factionId);
    if (!faction) return false;

    if (faction.removeMember(playerId)) {
      this.playerFactions.delete(playerId);
      const player = this.getPlayerEntity(playerId);
      if (player) {
        const playerFaction = player.getComponent(PlayerFaction);
        if (playerFaction) {
          playerFaction.leaveFaction();
        }
      }

      if (faction.getMemberCount() === 0) {
        this.factions.delete(factionId);
      }
      return true;
    }
    return false;
  }

  declareWar(attackerFactionId: string, defenderFactionId: string, playerId: string): WarDeclaration | null {
    const attacker = this.factions.get(attackerFactionId);
    const defender = this.factions.get(defenderFactionId);

    if (!attacker || !defender) return null;
    if (!attacker.canDeclareWar(playerId)) return null;
    if (attackerFactionId === defenderFactionId) return null;
    if (attacker.isAtWarWith(defenderFactionId)) return null;

    const warId = uuidv4();
    const now = Date.now();
    const war: WarDeclaration = {
      warId,
      attackerFactionId,
      defenderFactionId,
      declaredAt: now,
      startTime: now + 60000,
      endTime: null,
      status: 'pending',
      winner: null
    };

    this.wars.set(warId, war);
    attacker.setRelation(defenderFactionId, 'war');
    defender.setRelation(attackerFactionId, 'war');

    return war;
  }

  endWar(warId: string, winnerFactionId: string | null): boolean {
    const war = this.wars.get(warId);
    if (!war) return false;

    war.status = 'ended';
    war.endTime = Date.now();
    war.winner = winnerFactionId;

    const attacker = this.factions.get(war.attackerFactionId);
    const defender = this.factions.get(war.defenderFactionId);

    if (attacker) attacker.setRelation(war.defenderFactionId, 'neutral');
    if (defender) defender.setRelation(war.attackerFactionId, 'neutral');

    return true;
  }

  getActiveWars(): WarDeclaration[] {
    return Array.from(this.wars.values()).filter(w => w.status === 'active');
  }

  getFactionWar(factionId: string): WarDeclaration | null {
    for (const war of this.wars.values()) {
      if ((war.attackerFactionId === factionId || war.defenderFactionId === factionId) && war.status === 'active') {
        return war;
      }
    }
    return null;
  }

  addWarScore(factionId: string, points: number): void {
    const faction = this.factions.get(factionId);
    if (faction) {
      faction.addWarScore(points);
    }
  }

  getFaction(factionId: string): Faction | undefined {
    return this.factions.get(factionId);
  }

  getPlayerFactionId(playerId: string): string | undefined {
    return this.playerFactions.get(playerId);
  }

  getAllFactions(): Faction[] {
    return Array.from(this.factions.values());
  }

  areAtWar(factionId1: string, factionId2: string): boolean {
    const f1 = this.factions.get(factionId1);
    return f1?.isAtWarWith(factionId2) || false;
  }

  private getPlayerEntity(playerId: string): Entity | undefined {
    for (const entity of this.world.getEntities()) {
      if (entity.id === playerId) return entity;
    }
    return undefined;
  }

  updateWars(): void {
    const now = Date.now();
    for (const war of this.wars.values()) {
      if (war.status === 'pending' && now >= war.startTime) {
        war.status = 'active';
      }
    }
  }
}
