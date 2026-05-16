package com.cardbattle.battle.model;

import java.util.*;

public class BattleAction {
    private String actionType;
    private Long playerId;
    private Long cardId;
    private Long targetId;
    private int damage;
    private int healing;
    private int shieldAbsorbed;
    private long timestamp;
    private int turnNumber;
    private List<String> triggeredCombos;
    private List<String> effectMessages;
    private Map<String, Object> stateSnapshot;
    
    public BattleAction() {
        this.triggeredCombos = new ArrayList<>();
        this.effectMessages = new ArrayList<>();
        this.stateSnapshot = new HashMap<>();
    }
    
    public String getActionType() {
        return actionType;
    }
    
    public void setActionType(String actionType) {
        this.actionType = actionType;
    }
    
    public Long getPlayerId() {
        return playerId;
    }
    
    public void setPlayerId(Long playerId) {
        this.playerId = playerId;
    }
    
    public Long getCardId() {
        return cardId;
    }
    
    public void setCardId(Long cardId) {
        this.cardId = cardId;
    }
    
    public Long getTargetId() {
        return targetId;
    }
    
    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }
    
    public int getDamage() {
        return damage;
    }
    
    public void setDamage(int damage) {
        this.damage = damage;
    }
    
    public int getHealing() {
        return healing;
    }
    
    public void setHealing(int healing) {
        this.healing = healing;
    }
    
    public int getShieldAbsorbed() {
        return shieldAbsorbed;
    }
    
    public void setShieldAbsorbed(int shieldAbsorbed) {
        this.shieldAbsorbed = shieldAbsorbed;
    }
    
    public long getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
    
    public int getTurnNumber() {
        return turnNumber;
    }
    
    public void setTurnNumber(int turnNumber) {
        this.turnNumber = turnNumber;
    }
    
    public List<String> getTriggeredCombos() {
        return triggeredCombos;
    }
    
    public void setTriggeredCombos(List<String> triggeredCombos) {
        this.triggeredCombos = triggeredCombos;
    }
    
    public void addTriggeredCombo(String comboName) {
        this.triggeredCombos.add(comboName);
    }
    
    public List<String> getEffectMessages() {
        return effectMessages;
    }
    
    public void setEffectMessages(List<String> effectMessages) {
        this.effectMessages = effectMessages;
    }
    
    public void addEffectMessage(String message) {
        this.effectMessages.add(message);
    }
    
    public Map<String, Object> getStateSnapshot() {
        return stateSnapshot;
    }
    
    public void setStateSnapshot(Map<String, Object> stateSnapshot) {
        this.stateSnapshot = stateSnapshot;
    }
    
    public void addStateSnapshot(String key, Object value) {
        this.stateSnapshot.put(key, value);
    }
}