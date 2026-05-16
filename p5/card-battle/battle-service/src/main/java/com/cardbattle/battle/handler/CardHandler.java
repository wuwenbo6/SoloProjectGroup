package com.cardbattle.battle.handler;

import com.cardbattle.battle.logic.CardCombo;
import com.cardbattle.battle.logic.DamageCalc;
import com.cardbattle.battle.logic.Effect;
import com.cardbattle.battle.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

public class CardHandler {
    private static final Logger logger = LoggerFactory.getLogger(CardHandler.class);
    
    public CardPlayResult playCard(BattleRoom room, Long playerId, Long cardInstanceId, Long targetId) {
        PlayerBattleState playerState = room.getPlayerState(playerId);
        if (playerState == null) {
            return CardPlayResult.failure("Player not in this battle");
        }
        
        CardInstance card = playerState.getHand().stream()
            .filter(c -> c.getInstanceId().equals(cardInstanceId))
            .findFirst()
            .orElse(null);
            
        if (card == null) {
            return CardPlayResult.failure("Card not in hand");
        }
        
        if (playerState.getMana() < card.getCardData().getCost()) {
            return CardPlayResult.failure("Not enough mana");
        }
        
        playerState.setMana(playerState.getMana() - card.getCardData().getCost());
        playerState.getHand().remove(card);
        playerState.getGraveyard().add(card);
        
        room.recordCardPlayed(playerId, card.getCardData().getId());
        
        Effect.EffectResult effectResult = applyCardEffect(room, card, playerId, targetId);
        
        Set<Long> cardsPlayedThisTurn = room.getCardsPlayedThisTurn(playerId);
        CardCombo.ComboResult comboResult = CardCombo.checkCombos(cardsPlayedThisTurn, playerId);
        
        if (comboResult.hasCombo()) {
            for (Effect comboEffect : comboResult.getEffects()) {
                if (comboEffect.getType() == Effect.EffectType.DAMAGE) {
                    Long enemyId = room.getOpponentId(playerId);
                    PlayerBattleState enemyState = room.getPlayerState(enemyId);
                    if (enemyState != null) {
                        Effect.EffectResult damageResult = Effect.applyDamage(enemyId, comboEffect.getValue(), enemyState.getEffects());
                        int actualDamage = damageResult.getDamageDealt().getOrDefault(enemyId, 0);
                        enemyState.setHealth(enemyState.getHealth() - actualDamage);
                        effectResult.getMessages().addAll(damageResult.getMessages());
                    }
                } else if (comboEffect.getType() == Effect.EffectType.SHIELD ||
                           comboEffect.getType() == Effect.EffectType.BUFF_ATTACK ||
                           comboEffect.getType() == Effect.EffectType.BUFF_DEFENSE) {
                    Effect.mergeEffects(playerState.getEffects(), Collections.singletonList(comboEffect));
                } else if (comboEffect.getType() == Effect.EffectType.DRAW_CARD) {
                    for (int i = 0; i < comboEffect.getValue(); i++) {
                        if (!playerState.getDeck().isEmpty()) {
                            CardInstance drawn = playerState.getDeck().remove(0);
                            playerState.getHand().add(drawn);
                            effectResult.addMessage("抽取了一张卡牌: " + drawn.getCardData().getName());
                        }
                    }
                }
            }
            effectResult.getMessages().addAll(comboResult.getMessages());
        }
        
        BattleAction action = new BattleAction();
        action.setActionType("PLAY_CARD");
        action.setPlayerId(playerId);
        action.setCardId(card.getCardData().getId());
        action.setTargetId(targetId);
        action.setTimestamp(System.currentTimeMillis());
        action.setTurnNumber(room.getTurnNumber());
        action.setStateSnapshot(room.getStateSnapshot());
        
        if (comboResult.hasCombo()) {
            for (CardCombo.ComboDefinition combo : comboResult.getTriggeredCombos()) {
                action.addTriggeredCombo(combo.getName());
            }
        }
        
        for (String msg : effectResult.getMessages()) {
            action.addEffectMessage(msg);
        }
        
        room.getBattleLog().add(action);
        
        logger.info("Player {} played card {} targeting {}", playerId, card.getCardData().getName(), targetId);
        return CardPlayResult.success(card, effectResult);
    }
    
    private Effect.EffectResult applyCardEffect(BattleRoom room, CardInstance card, Long casterId, Long targetId) {
        Effect.EffectResult result = new Effect.EffectResult();
        
        String effectType = card.getCardData().getEffect();
        PlayerBattleState casterState = room.getPlayerState(casterId);
        PlayerBattleState targetState = room.getPlayerState(targetId);
        
        switch (effectType) {
            case "DAMAGE":
                int damage = card.getCardData().getAttack();
                if (targetState != null) {
                    Effect.EffectResult damageResult = Effect.applyDamage(targetId, damage, targetState.getEffects());
                    int actualDamage = damageResult.getDamageDealt().getOrDefault(targetId, 0);
                    targetState.setHealth(targetState.getHealth() - actualDamage);
                    
                    result.getAppliedEffects().addAll(damageResult.getAppliedEffects());
                    result.getMessages().addAll(damageResult.getMessages());
                    result.addDamage(targetId, actualDamage);
                }
                break;
                
            case "HEAL":
                int heal = card.getCardData().getHealth();
                if (casterState != null) {
                    int actualHeal = DamageCalc.calculateHeal(heal, 0);
                    casterState.setHealth(Math.min(casterState.getMaxHealth(), casterState.getHealth() + actualHeal));
                    result.addHealing(casterId, actualHeal);
                    result.addMessage("Healed " + actualHeal + " HP");
                }
                break;
                
            case "BUFF_ATTACK":
                Effect attackBuff = new Effect(Effect.EffectType.BUFF_ATTACK, 2, 3);
                attackBuff.setTargetId(casterId);
                if (casterState != null) {
                    Effect.mergeEffects(casterState.getEffects(), Collections.singletonList(attackBuff));
                }
                result.addEffect(attackBuff);
                result.addMessage("Gained attack buff");
                break;
                
            case "BUFF_DEFENSE":
                Effect defenseBuff = new Effect(Effect.EffectType.BUFF_DEFENSE, 3, 2);
                defenseBuff.setTargetId(casterId);
                if (casterState != null) {
                    Effect.mergeEffects(casterState.getEffects(), Collections.singletonList(defenseBuff));
                }
                result.addEffect(defenseBuff);
                result.addMessage("Gained defense buff");
                break;
                
            case "SHIELD":
                int shieldValue = card.getCardData().getHealth();
                Effect.EffectResult shieldResult = Effect.applyShield(casterId, shieldValue, 3);
                if (casterState != null) {
                    Effect.mergeEffects(casterState.getEffects(), shieldResult.getAppliedEffects());
                }
                result.getAppliedEffects().addAll(shieldResult.getAppliedEffects());
                result.getMessages().addAll(shieldResult.getMessages());
                break;
                
            case "DRAW":
                if (casterState != null && !casterState.getDeck().isEmpty()) {
                    CardInstance drawn = casterState.getDeck().remove(0);
                    casterState.getHand().add(drawn);
                    result.addMessage("Drew a card");
                }
                break;
                
            default:
                result.addMessage("Card played with no effect");
        }
        
        return result;
    }
    
    public boolean attackTarget(BattleRoom room, Long attackerId, Long targetId) {
        PlayerBattleState attacker = room.getPlayerState(attackerId);
        PlayerBattleState target = room.getPlayerState(targetId);
        
        if (attacker == null || target == null) {
            return false;
        }
        
        int attackBonus = attacker.getEffects().stream()
            .filter(e -> e.getType() == Effect.EffectType.BUFF_ATTACK)
            .mapToInt(Effect::getValue)
            .sum();
        
        int baseDamage = attacker.getAttack() + attackBonus;
        
        Effect.EffectResult damageResult = Effect.applyDamage(targetId, baseDamage, target.getEffects());
        int actualDamage = damageResult.getDamageDealt().getOrDefault(targetId, 0);
        target.setHealth(target.getHealth() - actualDamage);
        
        BattleAction action = new BattleAction();
        action.setActionType("ATTACK");
        action.setPlayerId(attackerId);
        action.setTargetId(targetId);
        action.setDamage(actualDamage);
        action.setTimestamp(System.currentTimeMillis());
        room.getBattleLog().add(action);
        
        logger.info("Player {} attacked player {} for {} damage (shield absorbed {})", 
            attackerId, targetId, actualDamage, 
            damageResult.getShieldAbsorbed().getOrDefault(targetId, 0));
        return true;
    }
    
    public boolean useSkill(BattleRoom room, Long playerId, String skillId, Long targetId) {
        PlayerBattleState player = room.getPlayerState(playerId);
        if (player == null) {
            return false;
        }
        
        BattleAction action = new BattleAction();
        action.setActionType("SKILL");
        action.setPlayerId(playerId);
        action.setTargetId(targetId);
        action.setTimestamp(System.currentTimeMillis());
        room.getBattleLog().add(action);
        
        logger.info("Player {} used skill {} on {}", playerId, skillId, targetId);
        return true;
    }
    
    public static class CardPlayResult {
        private boolean success;
        private String message;
        private CardInstance card;
        private Effect.EffectResult effectResult;
        
        public static CardPlayResult success(CardInstance card, Effect.EffectResult effectResult) {
            CardPlayResult result = new CardPlayResult();
            result.success = true;
            result.card = card;
            result.effectResult = effectResult;
            return result;
        }
        
        public static CardPlayResult failure(String message) {
            CardPlayResult result = new CardPlayResult();
            result.success = false;
            result.message = message;
            return result;
        }
        
        public boolean isSuccess() {
            return success;
        }
        
        public String getMessage() {
            return message;
        }
        
        public CardInstance getCard() {
            return card;
        }
        
        public Effect.EffectResult getEffectResult() {
            return effectResult;
        }
    }
}