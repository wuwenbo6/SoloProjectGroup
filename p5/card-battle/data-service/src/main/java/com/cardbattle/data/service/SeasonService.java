package com.cardbattle.data.service;

import com.cardbattle.data.dao.*;
import com.cardbattle.data.entity.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

public class SeasonService {
    private static final Logger logger = LoggerFactory.getLogger(SeasonService.class);
    
    private SqlSessionFactory sqlSessionFactory;
    private ObjectMapper objectMapper;
    
    public SeasonService(SqlSessionFactory sqlSessionFactory) {
        this.sqlSessionFactory = sqlSessionFactory;
        this.objectMapper = new ObjectMapper();
    }
    
    public Season getCurrentSeason() {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            SeasonDao dao = session.getMapper(SeasonDao.class);
            return dao.findActiveSeason();
        } catch (Exception e) {
            logger.error("Failed to get current season", e);
            return null;
        }
    }
    
    public List<Season> getAllSeasons() {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            SeasonDao dao = session.getMapper(SeasonDao.class);
            return dao.findAll();
        } catch (Exception e) {
            logger.error("Failed to get all seasons", e);
            return new ArrayList<>();
        }
    }
    
    public PlayerSeasonRecord getPlayerSeasonRecord(Long playerId, Integer seasonId) {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            PlayerSeasonRecordDao dao = session.getMapper(PlayerSeasonRecordDao.class);
            PlayerSeasonRecord record = dao.findByPlayerAndSeason(playerId, seasonId);
            if (record == null) {
                record = createNewPlayerRecord(playerId, seasonId);
            }
            return record;
        } catch (Exception e) {
            logger.error("Failed to get player season record", e);
            return null;
        }
    }
    
    private PlayerSeasonRecord createNewPlayerRecord(Long playerId, Integer seasonId) {
        PlayerSeasonRecord record = new PlayerSeasonRecord();
        record.setPlayerId(playerId);
        record.setSeasonId(seasonId);
        record.setHighestRankId(1);
        record.setHighestRankPoints(0);
        record.setFinalRankId(1);
        record.setFinalRankPoints(0);
        record.setWins(0);
        record.setLosses(0);
        record.setDraws(0);
        record.setWinStreak(0);
        record.setMaxWinStreak(0);
        record.setBattleCount(0);
        record.setRewardsClaimed(0);
        record.setCreateTime(new Date());
        record.setUpdateTime(new Date());
        
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            PlayerSeasonRecordDao dao = session.getMapper(PlayerSeasonRecordDao.class);
            dao.insert(record);
        } catch (Exception e) {
            logger.error("Failed to create player season record", e);
        }
        return record;
    }
    
    public void updatePlayerRecordAfterBattle(Long playerId, boolean isWin) {
        Season currentSeason = getCurrentSeason();
        if (currentSeason == null) {
            return;
        }
        
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            PlayerSeasonRecordDao recordDao = session.getMapper(PlayerSeasonRecordDao.class);
            PlayerDao playerDao = session.getMapper(PlayerDao.class);
            
            PlayerSeasonRecord record = recordDao.findByPlayerAndSeason(playerId, currentSeason.getId());
            if (record == null) {
                record = createNewPlayerRecord(playerId, currentSeason.getId());
            }
            
            record.setBattleCount(record.getBattleCount() + 1);
            
            if (isWin) {
                record.setWins(record.getWins() + 1);
                record.setWinStreak(record.getWinStreak() + 1);
                if (record.getWinStreak() > record.getMaxWinStreak()) {
                    record.setMaxWinStreak(record.getWinStreak());
                }
            } else {
                record.setLosses(record.getLosses() + 1);
                record.setWinStreak(0);
            }
            
            Player player = playerDao.findById(playerId);
            if (player != null) {
                if (player.getRankPoints() > record.getHighestRankPoints()) {
                    record.setHighestRankId(player.getRankId());
                    record.setHighestRankPoints(player.getRankPoints());
                }
                record.setFinalRankId(player.getRankId());
                record.setFinalRankPoints(player.getRankPoints());
            }
            
            record.setUpdateTime(new Date());
            recordDao.update(record);
            
        } catch (Exception e) {
            logger.error("Failed to update player season record", e);
        }
    }
    
    public Map<String, Object> settleSeason(Integer seasonId) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            SeasonDao seasonDao = session.getMapper(SeasonDao.class);
            PlayerSeasonRecordDao recordDao = session.getMapper(PlayerSeasonRecordDao.class);
            PlayerDao playerDao = session.getMapper(PlayerDao.class);
            
            Season season = seasonDao.findById(seasonId);
            if (season == null) {
                result.put("message", "Season not found");
                return result;
            }
            
            if (season.getStatus() != Season.STATUS_ACTIVE) {
                result.put("message", "Season is not active");
                return result;
            }
            
            List<PlayerSeasonRecord> records = recordDao.findBySeasonId(seasonId);
            int settledCount = 0;
            
            for (PlayerSeasonRecord record : records) {
                Player player = playerDao.findById(record.getPlayerId());
                if (player != null) {
                    record.setFinalRankId(player.getRankId());
                    record.setFinalRankPoints(player.getRankPoints());
                    record.setRewardsClaimed(0);
                    record.setUpdateTime(new Date());
                    recordDao.update(record);
                    
                    int resetRankId = Math.max(1, player.getRankId() - 2);
                    int resetPoints = getRankStartPoints(resetRankId);
                    playerDao.updateRank(player.getId(), resetRankId, resetPoints);
                    
                    settledCount++;
                }
            }
            
            season.setStatus(Season.STATUS_ENDED);
            seasonDao.update(season);
            
            result.put("success", true);
            result.put("settledPlayers", settledCount);
            result.put("message", "Season settled successfully");
            
            logger.info("Season {} settled successfully, {} players processed", seasonId, settledCount);
            
        } catch (Exception e) {
            logger.error("Failed to settle season", e);
            result.put("message", e.getMessage());
        }
        
        return result;
    }
    
    private int getRankStartPoints(int rankId) {
        switch (rankId) {
            case 1: return 0;
            case 2: return 1000;
            case 3: return 2000;
            case 4: return 3000;
            case 5: return 4000;
            case 6: return 5000;
            case 7: return 6000;
            default: return 0;
        }
    }
    
    public Map<String, Object> claimSeasonRewards(Long playerId, Integer seasonId) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            PlayerSeasonRecordDao recordDao = session.getMapper(PlayerSeasonRecordDao.class);
            SeasonRewardDao rewardDao = session.getMapper(SeasonRewardDao.class);
            PlayerDao playerDao = session.getMapper(PlayerDao.class);
            
            PlayerSeasonRecord record = recordDao.findByPlayerAndSeason(playerId, seasonId);
            if (record == null) {
                result.put("message", "No season record found");
                return result;
            }
            
            if (record.getRewardsClaimed() == 1) {
                result.put("message", "Rewards already claimed");
                return result;
            }
            
            Season season = session.getMapper(SeasonDao.class).findById(seasonId);
            if (season == null || season.getStatus() != Season.STATUS_ENDED) {
                result.put("message", "Season has not ended yet");
                return result;
            }
            
            List<SeasonReward> rewards = rewardDao.findByRankRange(seasonId, record.getFinalRankId());
            List<Map<String, Object>> claimedRewards = new ArrayList<>();
            
            for (SeasonReward reward : rewards) {
                Map<String, Object> rewardInfo = new HashMap<>();
                rewardInfo.put("rewardName", reward.getRewardName());
                rewardInfo.put("rewardType", reward.getRewardType());
                rewardInfo.put("rewardValue", reward.getRewardValue());
                rewardInfo.put("description", reward.getRewardDescription());
                claimedRewards.add(rewardInfo);
                
                if ("TITLE".equals(reward.getRewardType())) {
                    Player player = playerDao.findById(playerId);
                    if (player != null) {
                        playerDao.updateRankTitle(playerId, "S" + seasonId + "_" + reward.getRankName());
                    }
                }
            }
            
            record.setRewardsClaimed(1);
            record.setClaimTime(new Date());
            recordDao.update(record);
            
            result.put("success", true);
            result.put("rewards", claimedRewards);
            result.put("finalRank", record.getFinalRankId());
            result.put("finalPoints", record.getFinalRankPoints());
            
            logger.info("Player {} claimed season {} rewards", playerId, seasonId);
            
        } catch (Exception e) {
            logger.error("Failed to claim season rewards", e);
            result.put("message", e.getMessage());
        }
        
        return result;
    }
    
    public List<SeasonReward> getSeasonRewards(Integer seasonId) {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            SeasonRewardDao dao = session.getMapper(SeasonRewardDao.class);
            return dao.findBySeasonId(seasonId);
        } catch (Exception e) {
            logger.error("Failed to get season rewards", e);
            return new ArrayList<>();
        }
    }
    
    public Map<String, Object> getPlayerSeasonStats(Long playerId, Integer seasonId) {
        Map<String, Object> stats = new HashMap<>();
        
        PlayerSeasonRecord record = getPlayerSeasonRecord(playerId, seasonId);
        if (record != null) {
            stats.put("wins", record.getWins());
            stats.put("losses", record.getLosses());
            stats.put("draws", record.getDraws());
            stats.put("battleCount", record.getBattleCount());
            stats.put("winStreak", record.getWinStreak());
            stats.put("maxWinStreak", record.getMaxWinStreak());
            stats.put("highestRankId", record.getHighestRankId());
            stats.put("highestRankPoints", record.getHighestRankPoints());
            stats.put("currentRankId", record.getFinalRankId());
            stats.put("currentRankPoints", record.getFinalRankPoints());
            stats.put("rewardsClaimed", record.getRewardsClaimed());
            
            double winRate = record.getBattleCount() > 0 ? 
                (double) record.getWins() / record.getBattleCount() * 100 : 0;
            stats.put("winRate", Math.round(winRate * 100) / 100.0);
        }
        
        return stats;
    }
}