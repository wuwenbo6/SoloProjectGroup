package com.cardbattle.battle.logic;

public class DamageCalc {
    
    public static int calculateAttackDamage(int attackerAttack, int targetHealth, int targetDefense) {
        int damage = Math.max(0, attackerAttack - targetDefense);
        return Math.min(damage, targetHealth);
    }
    
    public static int calculateSpellDamage(int baseDamage, int spellPower) {
        return baseDamage + spellPower;
    }
    
    public static int calculateHeal(int baseHeal, int healPower) {
        return baseHeal + healPower;
    }
    
    public static int calculateTrueDamage(int damage) {
        return damage;
    }
}