package com.cardbattle.battle.handler;

import com.cardbattle.battle.logic.Effect;
import com.cardbattle.battle.model.BattleRoom;
import com.cardbattle.battle.model.BattleAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TurnHandler {
    private static final Logger logger = LoggerFactory.getLogger(TurnHandler.class);
    
    public boolean endTurn(BattleRoom room, Long playerId) {
        if (!room.isPlayerTurn(playerId)) {
            logger.warn("Player {} tried to end turn but it's not their turn", playerId);
            return false;
        }
        
        BattleAction action = new BattleAction();
        action.setActionType("END_TURN");
        action.setPlayerId(playerId);
        action.setTimestamp(System.currentTimeMillis());
        action.setTurnNumber(room.getTurnNumber());
        action.setStateSnapshot(room.getStateSnapshot());
        room.getBattleLog().add(action);
        
        room.getPlayerState(playerId).setEffects(
            Effect.decrementEffectDurations(room.getPlayerState(playerId).getEffects())
        );
        
        room.clearCardsPlayedThisTurn();
        room.switchTurn();
        
        BattleAction startTurnAction = new BattleAction();
        startTurnAction.setActionType("START_TURN");
        startTurnAction.setPlayerId(room.getCurrentTurnPlayerId());
        startTurnAction.setTimestamp(System.currentTimeMillis());
        startTurnAction.setTurnNumber(room.getTurnNumber());
        startTurnAction.setStateSnapshot(room.getStateSnapshot());
        room.getBattleLog().add(startTurnAction);
        
        logger.info("Player {} ended turn {}. Now it's player {}'s turn", 
            playerId, room.getTurnNumber(), room.getCurrentTurnPlayerId());
        return true;
    }
    
    public void checkTurnTimeout(BattleRoom room) {
        if (room.isTurnTimeout()) {
            Long currentPlayer = room.getCurrentTurnPlayerId();
            logger.info("Turn timeout for player {} in room {}", currentPlayer, room.getRoomId());
            
            BattleAction action = new BattleAction();
            action.setActionType("TURN_TIMEOUT");
            action.setPlayerId(currentPlayer);
            action.setTimestamp(System.currentTimeMillis());
            action.setTurnNumber(room.getTurnNumber());
            action.setStateSnapshot(room.getStateSnapshot());
            room.getBattleLog().add(action);
            
            room.clearCardsPlayedThisTurn();
            room.switchTurn();
        }
    }
}