package com.cardbattle.battle.logic;

import java.util.*;

public class Effect {
    
    public enum EffectType {
        DAMAGE,
        HEAL,
        SHIELD,
        BUFF_ATTACK,
        BUFF_DEFENSE,
        DEBUFF_ATTACK,
        DEBUFF_DEFENSE,
        STUN,
        DRAW_CARD,
        GAIN_MANA
    }
    
    private EffectType type;
    private int value;
    private int currentValue;
    private int duration;
    private Long targetId;
    private Long sourceId;
    private boolean isUnique;
    
    public Effect(EffectType type, int value, int duration) {
        this.type = type;
        this.value = value;
        this.currentValue = value;
        this.duration = duration;
        this.isUnique = true;
    }
    
    public static class EffectResult {
        private Map<Long, Integer> damageDealt = new HashMap<>();
        private Map<Long, Integer> healingDone = new HashMap<>();
        private Map<Long, Integer> shieldAbsorbed = new HashMap<>();
        private List<Effect> appliedEffects = new ArrayList<>();
        private List<String> messages = new ArrayList<>();
        
        public void addDamage(Long targetId, int damage) {
            damageDealt.put(targetId, damage);
        }
        
        public void addHealing(Long targetId, int heal) {
            healingDone.put(targetId, heal);
        }
        
        public void addShieldAbsorb(Long targetId, int amount) {
            shieldAbsorbed.put(targetId, amount);
        }
        
        public void addEffect(Effect effect) {
            appliedEffects.add(effect);
        }
        
        public void addMessage(String message) {
            messages.add(message);
        }
        
        public List<Effect> getAppliedEffects() {
            return appliedEffects;
        }
        
        public List<String> getMessages() {
            return messages;
        }
    }
    
    public static EffectResult applyDamage(Long targetId, int damage, List<Effect> existingEffects) {
        EffectResult result = new EffectResult();
        int remainingDamage = damage;
        int totalShieldAbsorb = 0;
        
        for (Effect effect : existingEffects) {
            if (effect.getType() == EffectType.SHIELD && remainingDamage > 0) {
                int shieldValue = effect.getCurrentValue();
                if (shieldValue >= remainingDamage) {
                    effect.setCurrentValue(shieldValue - remainingDamage);
                    totalShieldAbsorb += remainingDamage;
                    remainingDamage = 0;
                } else {
                    totalShieldAbsorb += shieldValue;
                    remainingDamage -= shieldValue;
                    effect.setCurrentValue(0);
                }
            }
        }
        
        for (Effect effect : existingEffects) {
            if (effect.getType() == EffectType.BUFF_DEFENSE) {
                remainingDamage = Math.max(0, remainingDamage - effect.getValue());
            } else if (effect.getType() == EffectType.DEBUFF_DEFENSE) {
                remainingDamage += effect.getValue();
            }
        }
        
        existingEffects.removeIf(e -> e.getType() == EffectType.SHIELD && e.getCurrentValue() <= 0);
        
        if (totalShieldAbsorb > 0) {
            result.addShieldAbsorb(targetId, totalShieldAbsorb);
            result.addMessage("Shield absorbed " + totalShieldAbsorb + " damage for target " + targetId);
        }
        
        result.addDamage(targetId, remainingDamage);
        result.addMessage("Target " + targetId + " takes " + remainingDamage + " damage");
        return result;
    }
    
    public static EffectResult applyHeal(Long targetId, int healAmount, List<Effect> existingEffects) {
        EffectResult result = new EffectResult();
        int finalHeal = healAmount;
        
        result.addHealing(targetId, finalHeal);
        result.addMessage("Target " + targetId + " heals " + finalHeal + " HP");
        return result;
    }
    
    public static EffectResult applyBuff(Long targetId, EffectType buffType, int value, int duration) {
        EffectResult result = new EffectResult();
        Effect buff = new Effect(buffType, value, duration);
        buff.setTargetId(targetId);
        result.addEffect(buff);
        result.addMessage("Target " + targetId + " gains " + buffType + " buff for " + duration + " turns");
        return result;
    }
    
    public static EffectResult applyShield(Long targetId, int shieldValue, int duration) {
        EffectResult result = new EffectResult();
        Effect shield = new Effect(EffectType.SHIELD, shieldValue, duration);
        shield.setCurrentValue(shieldValue);
        shield.setTargetId(targetId);
        result.addEffect(shield);
        result.addMessage("Target " + targetId + " gains " + shieldValue + " shield for " + duration + " turns");
        return result;
    }
    
    public static EffectResult applyDebuff(Long targetId, EffectType debuffType, int value, int duration) {
        EffectResult result = new EffectResult();
        Effect debuff = new Effect(debuffType, value, duration);
        debuff.setTargetId(targetId);
        result.addEffect(debuff);
        result.addMessage("Target " + targetId + " suffers " + debuffType + " debuff for " + duration + " turns");
        return result;
    }
    
    public static void mergeEffects(List<Effect> existingEffects, List<Effect> newEffects) {
        for (Effect newEffect : newEffects) {
            if (newEffect.isUnique()) {
                Optional<Effect> existing = existingEffects.stream()
                    .filter(e -> e.getType() == newEffect.getType() && 
                                 (e.getTargetId() == null || e.getTargetId().equals(newEffect.getTargetId())))
                    .findFirst();
                
                if (existing.isPresent()) {
                    Effect existingEffect = existing.get();
                    if (newEffect.getType() == EffectType.SHIELD) {
                        existingEffect.setCurrentValue(existingEffect.getCurrentValue() + newEffect.getCurrentValue());
                        existingEffect.setDuration(Math.max(existingEffect.getDuration(), newEffect.getDuration()));
                    } else {
                        existingEffect.setValue(Math.max(existingEffect.getValue(), newEffect.getValue()));
                        existingEffect.setDuration(Math.max(existingEffect.getDuration(), newEffect.getDuration()));
                    }
                } else {
                    existingEffects.add(newEffect);
                }
            } else {
                existingEffects.add(newEffect);
            }
        }
    }
    
    public static List<Effect> decrementEffectDurations(List<Effect> effects) {
        List<Effect> remainingEffects = new ArrayList<>();
        for (Effect effect : effects) {
            effect.setDuration(effect.getDuration() - 1);
            if (effect.getDuration() > 0) {
                remainingEffects.add(effect);
            }
        }
        return remainingEffects;
    }
    
    public EffectType getType() {
        return type;
    }
    
    public void setType(EffectType type) {
        this.type = type;
    }
    
    public int getValue() {
        return value;
    }
    
    public void setValue(int value) {
        this.value = value;
    }
    
    public int getDuration() {
        return duration;
    }
    
    public void setDuration(int duration) {
        this.duration = duration;
    }
    
    public Long getTargetId() {
        return targetId;
    }
    
    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }
    
    public Long getSourceId() {
        return sourceId;
    }
    
    public void setSourceId(Long sourceId) {
        this.sourceId = sourceId;
    }
    
    public int getCurrentValue() {
        return currentValue;
    }
    
    public void setCurrentValue(int currentValue) {
        this.currentValue = currentValue;
    }
    
    public boolean isUnique() {
        return isUnique;
    }
    
    public void setUnique(boolean unique) {
        isUnique = unique;
    }
}