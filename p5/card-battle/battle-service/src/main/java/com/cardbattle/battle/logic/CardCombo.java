package com.cardbattle.battle.logic;

import java.util.*;

public class CardCombo {
    
    public static class ComboDefinition {
        private String comboId;
        private String name;
        private String description;
        private Set<Long> requiredCards;
        private int minCardsPlayedInTurn;
        private Effect.EffectType effectType;
        private int effectValue;
        private String effectTarget;
        
        public ComboDefinition(String comboId, String name, String description, 
                              Set<Long> requiredCards, int minCardsPlayedInTurn,
                              Effect.EffectType effectType, int effectValue, String effectTarget) {
            this.comboId = comboId;
            this.name = name;
            this.description = description;
            this.requiredCards = requiredCards;
            this.minCardsPlayedInTurn = minCardsPlayedInTurn;
            this.effectType = effectType;
            this.effectValue = effectValue;
            this.effectTarget = effectTarget;
        }
        
        public boolean checkTrigger(Set<Long> cardsPlayedInTurn) {
            int matchCount = 0;
            for (Long cardId : requiredCards) {
                if (cardsPlayedInTurn.contains(cardId)) {
                    matchCount++;
                }
            }
            return matchCount >= minCardsPlayedInTurn;
        }
        
        public String getComboId() { return comboId; }
        public String getName() { return name; }
        public String getDescription() { return description; }
        public Set<Long> getRequiredCards() { return requiredCards; }
        public int getMinCardsPlayedInTurn() { return minCardsPlayedInTurn; }
        public Effect.EffectType getEffectType() { return effectType; }
        public int getEffectValue() { return effectValue; }
        public String getEffectTarget() { return effectTarget; }
    }
    
    private static final Map<String, ComboDefinition> COMBO_DEFINITIONS = new HashMap<>();
    
    static {
        COMBO_DEFINITIONS.put("FIRE_STORM", new ComboDefinition(
            "FIRE_STORM",
            "烈焰风暴",
            "连续使用2张火焰卡牌，造成额外伤害",
            Set.of(1L, 4L, 8L),
            2,
            Effect.EffectType.DAMAGE,
            8,
            "ENEMY"
        ));
        
        COMBO_DEFINITIONS.put("DIVINE_PROTECTION", new ComboDefinition(
            "DIVINE_PROTECTION",
            "神圣守护",
            "使用护盾+治疗卡牌，获得额外护盾",
            Set.of(2L, 5L, 9L, 10L),
            2,
            Effect.EffectType.SHIELD,
            15,
            "SELF"
        ));
        
        COMBO_DEFINITIONS.put("POWER_BOOST", new ComboDefinition(
            "POWER_BOOST",
            "力量爆发",
            "使用攻击buff+攻击卡牌，攻击力额外提升",
            Set.of(3L, 1L, 4L, 8L),
            2,
            Effect.EffectType.BUFF_ATTACK,
            5,
            "SELF"
        ));
        
        COMBO_DEFINITIONS.put("COMBO_DRAW", new ComboDefinition(
            "COMBO_DRAW",
            "连锁抽卡",
            "本回合使用3张卡牌，额外抽1张牌",
            Set.of(),
            3,
            Effect.EffectType.DRAW_CARD,
            1,
            "SELF"
        ));
        
        COMBO_DEFINITIONS.put("ULTIMATE_DEFENSE", new ComboDefinition(
            "ULTIMATE_DEFENSE",
            "终极防御",
            "使用2张防御卡牌，获得大量护盾",
            Set.of(5L, 6L, 10L),
            2,
            Effect.EffectType.SHIELD,
            25,
            "SELF"
        ));
    }
    
    public static class ComboResult {
        private List<ComboDefinition> triggeredCombos = new ArrayList<>();
        private List<Effect> effects = new ArrayList<>();
        private List<String> messages = new ArrayList<>();
        
        public void addTriggeredCombo(ComboDefinition combo) {
            triggeredCombos.add(combo);
        }
        
        public void addEffect(Effect effect) {
            effects.add(effect);
        }
        
        public void addMessage(String message) {
            messages.add(message);
        }
        
        public List<ComboDefinition> getTriggeredCombos() {
            return triggeredCombos;
        }
        
        public List<Effect> getEffects() {
            return effects;
        }
        
        public List<String> getMessages() {
            return messages;
        }
        
        public boolean hasCombo() {
            return !triggeredCombos.isEmpty();
        }
    }
    
    public static ComboResult checkCombos(Set<Long> cardsPlayedInTurn, Long playerId) {
        ComboResult result = new ComboResult();
        
        for (ComboDefinition combo : COMBO_DEFINITIONS.values()) {
            if (combo.checkTrigger(cardsPlayedInTurn)) {
                result.addTriggeredCombo(combo);
                
                Effect effect = new Effect(combo.getEffectType(), combo.getEffectValue(), 3);
                effect.setTargetId("ENEMY".equals(combo.getEffectTarget()) ? null : playerId);
                result.addEffect(effect);
                
                result.addMessage("触发组合效果: " + combo.getName() + " - " + combo.getDescription());
            }
        }
        
        return result;
    }
    
    public static Collection<ComboDefinition> getAllCombos() {
        return COMBO_DEFINITIONS.values();
    }
    
    public static ComboDefinition getCombo(String comboId) {
        return COMBO_DEFINITIONS.get(comboId);
    }
}