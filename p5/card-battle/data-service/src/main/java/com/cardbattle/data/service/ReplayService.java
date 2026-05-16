package com.cardbattle.data.service;

import com.cardbattle.data.dao.*;
import com.cardbattle.data.entity.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

public class ReplayService {
    private static final Logger logger = LoggerFactory.getLogger(ReplayService.class);
    
    private SqlSessionFactory sqlSessionFactory;
    private ObjectMapper objectMapper;
    
    public ReplayService(SqlSessionFactory sqlSessionFactory) {
        this.sqlSessionFactory = sqlSessionFactory;
        this.objectMapper = new ObjectMapper();
    }
    
    public void saveBattleReplay(BattleRecord battleRecord, Map<String, Object> battleState) {
        try {
            String replayJson = objectMapper.writeValueAsString(battleState);
            battleRecord.setReplayData(replayJson);
            
            try (SqlSession session = sqlSessionFactory.openSession(true)) {
                BattleDao dao = session.getMapper(BattleDao.class);
                dao.updateReplayData(battleRecord.getBattleId(), replayJson);
            }
            
            logger.info("Saved battle replay for battle {}", battleRecord.getBattleId());
        } catch (Exception e) {
            logger.error("Failed to save battle replay", e);
        }
    }
    
    public Map<String, Object> getBattleReplay(String battleId) {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            BattleDao dao = session.getMapper(BattleDao.class);
            BattleRecord record = dao.findByBattleId(battleId);
            
            if (record == null || record.getReplayData() == null) {
                return null;
            }
            
            Map<String, Object> replayData = objectMapper.readValue(
                record.getReplayData(), 
                Map.class
            );
            replayData.put("player1Id", record.getPlayer1Id());
            replayData.put("player2Id", record.getPlayer2Id());
            replayData.put("winnerId", record.getWinnerId());
            replayData.put("startTime", record.getStartTime());
            replayData.put("endTime", record.getEndTime());
            replayData.put("turnCount", record.getTurnCount());
            replayData.put("duration", record.getDuration());
            
            return replayData;
        } catch (Exception e) {
            logger.error("Failed to get battle replay", e);
            return null;
        }
    }
    
    public List<Map<String, Object>> getPlayerBattleHistory(Long playerId, int limit, int offset) {
        List<Map<String, Object>> history = new ArrayList<>();
        
        try (SqlSession session = sqlSessionFactory.openSession()) {
            BattleDao dao = session.getMapper(BattleDao.class);
            List<BattleRecord> records = dao.findByPlayerId(playerId, limit, offset);
            
            for (BattleRecord record : records) {
                Map<String, Object> battleInfo = new HashMap<>();
                battleInfo.put("battleId", record.getBattleId());
                battleInfo.put("player1Id", record.getPlayer1Id());
                battleInfo.put("player2Id", record.getPlayer2Id());
                battleInfo.put("winnerId", record.getWinnerId());
                battleInfo.put("isWin", record.getWinnerId() != null && record.getWinnerId().equals(playerId));
                battleInfo.put("startTime", record.getStartTime());
                battleInfo.put("endTime", record.getEndTime());
                battleInfo.put("turnCount", record.getTurnCount());
                battleInfo.put("duration", record.getDuration());
                battleInfo.put("hasReplay", record.getReplayData() != null && !record.getReplayData().isEmpty());
                history.add(battleInfo);
            }
        } catch (Exception e) {
            logger.error("Failed to get player battle history", e);
        }
        
        return history;
    }
    
    public Map<String, Object> getReplayAtTurn(String battleId, int turnNumber) {
        Map<String, Object> replayData = getBattleReplay(battleId);
        if (replayData == null) {
            return null;
        }
        
        List<Map<String, Object>> battleLog = (List<Map<String, Object>>) replayData.get("battleLog");
        if (battleLog == null) {
            return null;
        }
        
        List<Map<String, Object>> turnActions = new ArrayList<>();
        for (Map<String, Object> action : battleLog) {
            Object turn = action.get("turnNumber");
            if (turn != null && ((Integer) turn).intValue() == turnNumber) {
                turnActions.add(action);
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("turnNumber", turnNumber);
        result.put("actions", turnActions);
        return result;
    }
    
    public List<String> getReplayEffectLogs(String battleId) {
        Map<String, Object> replayData = getBattleReplay(battleId);
        if (replayData == null) {
            return new ArrayList<>();
        }
        
        List<Map<String, Object>> battleLog = (List<Map<String, Object>>) replayData.get("battleLog");
        if (battleLog == null) {
            return new ArrayList<>();
        }
        
        List<String> allEffects = new ArrayList<>();
        for (Map<String, Object> action : battleLog) {
            List<String> effectMessages = (List<String>) action.get("effectMessages");
            List<String> triggeredCombos = (List<String>) action.get("triggeredCombos");
            
            if (triggeredCombos != null && !triggeredCombos.isEmpty()) {
                for (String combo : triggeredCombos) {
                    allEffects.add("[组合效果触发: " + combo);
                }
            }
            
            if (effectMessages != null) {
                allEffects.addAll(effectMessages);
            }
        }
        
        return allEffects;
    }
    
    public int getPlayerBattleCount(Long playerId) {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            BattleDao dao = session.getMapper(BattleDao.class);
            return dao.countByPlayerId(playerId);
        } catch (Exception e) {
            logger.error("Failed to get player battle count", e);
            return 0;
        }
    }
}