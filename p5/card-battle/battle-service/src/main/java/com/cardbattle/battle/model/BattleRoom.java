package com.cardbattle.battle.model;

import java.util.*;

public class BattleRoom {
    private String roomId;
    private Long player1Id;
    private Long player2Id;
    private PlayerBattleState player1State;
    private PlayerBattleState player2State;
    private Long currentTurnPlayerId;
    private int turnNumber;
    private long turnStartTime;
    private int turnTimeoutSeconds;
    private List<BattleAction> battleLog;
    private String status;
    private Long winnerId;
    private Date startTime;
    private Date endTime;
    
    private boolean player1Connected;
    private boolean player2Connected;
    private Long player1DisconnectTime;
    private Long player2DisconnectTime;
    private static final int RECONNECT_TIMEOUT_SECONDS = 60;
    
    private Set<Long> player1CardsPlayedThisTurn;
    private Set<Long> player2CardsPlayedThisTurn;
    private int seasonId;
    
    public BattleRoom(String roomId, Long player1Id, Long player2Id) {
        this.roomId = roomId;
        this.player1Id = player1Id;
        this.player2Id = player2Id;
        this.currentTurnPlayerId = player1Id;
        this.turnNumber = 1;
        this.turnStartTime = System.currentTimeMillis();
        this.turnTimeoutSeconds = 60;
        this.battleLog = new ArrayList<>();
        this.status = "PLAYING";
        this.startTime = new Date();
        
        this.player1State = new PlayerBattleState(player1Id, 30, 10);
        this.player2State = new PlayerBattleState(player2Id, 30, 10);
        
        this.player1Connected = true;
        this.player2Connected = true;
        
        this.player1CardsPlayedThisTurn = new HashSet<>();
        this.player2CardsPlayedThisTurn = new HashSet<>();
        this.seasonId = 0;
    }
    
    public PlayerBattleState getPlayerState(Long playerId) {
        if (player1Id.equals(playerId)) {
            return player1State;
        } else if (player2Id.equals(playerId)) {
            return player2State;
        }
        return null;
    }
    
    public Long getOpponentId(Long playerId) {
        if (player1Id.equals(playerId)) {
            return player2Id;
        } else if (player2Id.equals(playerId)) {
            return player1Id;
        }
        return null;
    }
    
    public boolean isPlayerTurn(Long playerId) {
        return currentTurnPlayerId.equals(playerId);
    }
    
    public void switchTurn() {
        if (currentTurnPlayerId.equals(player1Id)) {
            currentTurnPlayerId = player2Id;
        } else {
            currentTurnPlayerId = player1Id;
            turnNumber++;
        }
        turnStartTime = System.currentTimeMillis();
        
        PlayerBattleState currentPlayer = getPlayerState(currentTurnPlayerId);
        if (currentPlayer != null) {
            currentPlayer.setMana(Math.min(currentPlayer.getMaxMana(), currentPlayer.getMana() + 1));
            if (!currentPlayer.getDeck().isEmpty()) {
                CardInstance card = currentPlayer.getDeck().remove(0);
                currentPlayer.getHand().add(card);
            }
        }
    }
    
    public boolean isTurnTimeout() {
        long elapsed = (System.currentTimeMillis() - turnStartTime) / 1000;
        return elapsed >= turnTimeoutSeconds;
    }
    
    public int getRemainingTurnTime() {
        long elapsed = (System.currentTimeMillis() - turnStartTime) / 1000;
        return Math.max(0, turnTimeoutSeconds - (int) elapsed);
    }
    
    public boolean checkBattleEnd() {
        if (player1State.getHealth() <= 0) {
            status = "ENDED";
            winnerId = player2Id;
            endTime = new Date();
            return true;
        }
        if (player2State.getHealth() <= 0) {
            status = "ENDED";
            winnerId = player1Id;
            endTime = new Date();
            return true;
        }
        return false;
    }
    
    public String getRoomId() {
        return roomId;
    }
    
    public Long getPlayer1Id() {
        return player1Id;
    }
    
    public Long getPlayer2Id() {
        return player2Id;
    }
    
    public PlayerBattleState getPlayer1State() {
        return player1State;
    }
    
    public PlayerBattleState getPlayer2State() {
        return player2State;
    }
    
    public Long getCurrentTurnPlayerId() {
        return currentTurnPlayerId;
    }
    
    public int getTurnNumber() {
        return turnNumber;
    }
    
    public List<BattleAction> getBattleLog() {
        return battleLog;
    }
    
    public String getStatus() {
        return status;
    }
    
    public Long getWinnerId() {
        return winnerId;
    }
    
    public Date getStartTime() {
        return startTime;
    }
    
    public Date getEndTime() {
        return endTime;
    }
    
    public int getDurationSeconds() {
        Date end = endTime != null ? endTime : new Date();
        return (int) ((end.getTime() - startTime.getTime()) / 1000);
    }
    
    public void setPlayerDisconnected(Long playerId) {
        if (player1Id.equals(playerId)) {
            player1Connected = false;
            player1DisconnectTime = System.currentTimeMillis();
        } else if (player2Id.equals(playerId)) {
            player2Connected = false;
            player2DisconnectTime = System.currentTimeMillis();
        }
    }
    
    public void setPlayerReconnected(Long playerId) {
        if (player1Id.equals(playerId)) {
            player1Connected = true;
            player1DisconnectTime = null;
        } else if (player2Id.equals(playerId)) {
            player2Connected = true;
            player2DisconnectTime = null;
        }
    }
    
    public boolean isPlayerConnected(Long playerId) {
        if (player1Id.equals(playerId)) {
            return player1Connected;
        } else if (player2Id.equals(playerId)) {
            return player2Connected;
        }
        return false;
    }
    
    public boolean isPlayerReconnectTimeout(Long playerId) {
        Long disconnectTime = null;
        if (player1Id.equals(playerId)) {
            disconnectTime = player1DisconnectTime;
        } else if (player2Id.equals(playerId)) {
            disconnectTime = player2DisconnectTime;
        }
        if (disconnectTime == null) {
            return false;
        }
        long elapsed = (System.currentTimeMillis() - disconnectTime) / 1000;
        return elapsed >= RECONNECT_TIMEOUT_SECONDS;
    }
    
    public boolean isBothPlayersDisconnected() {
        return !player1Connected && !player2Connected;
    }
    
    public void checkDisconnectTimeout() {
        if (!player1Connected && isPlayerReconnectTimeout(player1Id)) {
            status = "ENDED";
            winnerId = player2Id;
            endTime = new Date();
        } else if (!player2Connected && isPlayerReconnectTimeout(player2Id)) {
            status = "ENDED";
            winnerId = player1Id;
            endTime = new Date();
        }
    }
    
    public boolean isPlayer1Connected() {
        return player1Connected;
    }
    
    public boolean isPlayer2Connected() {
        return player2Connected;
    }
    
    public void recordCardPlayed(Long playerId, Long cardId) {
        if (player1Id.equals(playerId)) {
            player1CardsPlayedThisTurn.add(cardId);
        } else if (player2Id.equals(playerId)) {
            player2CardsPlayedThisTurn.add(cardId);
        }
    }
    
    public Set<Long> getCardsPlayedThisTurn(Long playerId) {
        if (player1Id.equals(playerId)) {
            return new HashSet<>(player1CardsPlayedThisTurn);
        } else if (player2Id.equals(playerId)) {
            return new HashSet<>(player2CardsPlayedThisTurn);
        }
        return new HashSet<>();
    }
    
    public void clearCardsPlayedThisTurn() {
        player1CardsPlayedThisTurn.clear();
        player2CardsPlayedThisTurn.clear();
    }
    
    public Map<String, Object> getStateSnapshot() {
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("turnNumber", turnNumber);
        snapshot.put("currentTurnPlayerId", currentTurnPlayerId);
        snapshot.put("player1Health", player1State.getHealth());
        snapshot.put("player1Mana", player1State.getMana());
        snapshot.put("player2Health", player2State.getHealth());
        snapshot.put("player2Mana", player2State.getMana());
        snapshot.put("player1EffectsCount", player1State.getEffects().size());
        snapshot.put("player2EffectsCount", player2State.getEffects().size());
        return snapshot;
    }
    
    public Map<String, Object> getFullReplayState() {
        Map<String, Object> state = new HashMap<>();
        state.put("roomId", roomId);
        state.put("player1Id", player1Id);
        state.put("player2Id", player2Id);
        state.put("turnNumber", turnNumber);
        state.put("currentTurnPlayerId", currentTurnPlayerId);
        state.put("status", status);
        state.put("winnerId", winnerId);
        state.put("battleLog", battleLog);
        
        Map<String, Object> player1StateMap = new HashMap<>();
        player1StateMap.put("health", player1State.getHealth());
        player1StateMap.put("maxHealth", player1State.getMaxHealth());
        player1StateMap.put("mana", player1State.getMana());
        player1StateMap.put("effects", player1State.getEffects());
        state.put("player1State", player1StateMap);
        
        Map<String, Object> player2StateMap = new HashMap<>();
        player2StateMap.put("health", player2State.getHealth());
        player2StateMap.put("maxHealth", player2State.getMaxHealth());
        player2StateMap.put("mana", player2State.getMana());
        player2StateMap.put("effects", player2State.getEffects());
        state.put("player2State", player2StateMap);
        
        return state;
    }
    
    public int getSeasonId() {
        return seasonId;
    }
    
    public void setSeasonId(int seasonId) {
        this.seasonId = seasonId;
    }
}