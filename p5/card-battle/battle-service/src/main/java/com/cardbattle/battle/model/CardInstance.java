package com.cardbattle.battle.model;

import com.cardbattle.data.entity.Card;
import java.util.UUID;

public class CardInstance {
    private String instanceId;
    private Card cardData;
    
    public CardInstance(Card cardData) {
        this.instanceId = UUID.randomUUID().toString();
        this.cardData = cardData;
    }
    
    public String getInstanceId() {
        return instanceId;
    }
    
    public Card getCardData() {
        return cardData;
    }
}