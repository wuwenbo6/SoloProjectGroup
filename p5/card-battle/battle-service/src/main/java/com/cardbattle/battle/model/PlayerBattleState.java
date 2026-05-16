package com.cardbattle.battle.model;

import com.cardbattle.battle.logic.Effect;
import java.util.*;

public class PlayerBattleState {
    private Long playerId;
    private int health;
    private int maxHealth;
    private int mana;
    private int maxMana;
    private int attack;
    private List<CardInstance> deck;
    private List<CardInstance> hand;
    private List<CardInstance> graveyard;
    private List<Effect> effects;
    
    public PlayerBattleState(Long playerId, int maxHealth, int maxMana) {
        this.playerId = playerId;
        this.maxHealth = maxHealth;
        this.health = maxHealth;
        this.maxMana = maxMana;
        this.mana = 1;
        this.attack = 0;
        this.deck = new ArrayList<>();
        this.hand = new ArrayList<>();
        this.graveyard = new ArrayList<>();
        this.effects = new ArrayList<>();
    }
    
    public Long getPlayerId() {
        return playerId;
    }
    
    public int getHealth() {
        return health;
    }
    
    public void setHealth(int health) {
        this.health = health;
    }
    
    public int getMaxHealth() {
        return maxHealth;
    }
    
    public int getMana() {
        return mana;
    }
    
    public void setMana(int mana) {
        this.mana = mana;
    }
    
    public int getMaxMana() {
        return maxMana;
    }
    
    public int getAttack() {
        return attack;
    }
    
    public void setAttack(int attack) {
        this.attack = attack;
    }
    
    public List<CardInstance> getDeck() {
        return deck;
    }
    
    public List<CardInstance> getHand() {
        return hand;
    }
    
    public List<CardInstance> getGraveyard() {
        return graveyard;
    }
    
    public List<Effect> getEffects() {
        return effects;
    }
}