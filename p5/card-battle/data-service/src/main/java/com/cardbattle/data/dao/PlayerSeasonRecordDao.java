package com.cardbattle.data.dao;

import com.cardbattle.data.entity.PlayerSeasonRecord;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface PlayerSeasonRecordDao {
    
    @Select("SELECT * FROM player_season_record WHERE id = #{id}")
    PlayerSeasonRecord findById(@Param("id") Long id);
    
    @Select("SELECT * FROM player_season_record WHERE player_id = #{playerId} AND season_id = #{seasonId}")
    PlayerSeasonRecord findByPlayerAndSeason(@Param("playerId") Long playerId, @Param("seasonId") Integer seasonId);
    
    @Select("SELECT * FROM player_season_record WHERE season_id = #{seasonId}")
    List<PlayerSeasonRecord> findBySeasonId(@Param("seasonId") Integer seasonId);
    
    @Select("SELECT * FROM player_season_record WHERE player_id = #{playerId} ORDER BY season_id DESC")
    List<PlayerSeasonRecord> findByPlayerId(@Param("playerId") Long playerId);
    
    @Insert("INSERT INTO player_season_record (player_id, season_id, highest_rank_id, highest_rank_points, " +
            "final_rank_id, final_rank_points, wins, losses, draws, win_streak, max_win_streak, battle_count, " +
            "rewards_claimed, claim_time, create_time, update_time) " +
            "VALUES (#{playerId}, #{seasonId}, #{highestRankId}, #{highestRankPoints}, #{finalRankId}, " +
            "#{finalRankPoints}, #{wins}, #{losses}, #{draws}, #{winStreak}, #{maxWinStreak}, #{battleCount}, " +
            "#{rewardsClaimed}, #{claimTime}, #{createTime}, #{updateTime})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(PlayerSeasonRecord record);
    
    @Update("UPDATE player_season_record SET highest_rank_id = #{highestRankId}, highest_rank_points = #{highestRankPoints}, " +
            "final_rank_id = #{finalRankId}, final_rank_points = #{finalRankPoints}, wins = #{wins}, losses = #{losses}, " +
            "draws = #{draws}, win_streak = #{winStreak}, max_win_streak = #{maxWinStreak}, battle_count = #{battleCount}, " +
            "rewards_claimed = #{rewardsClaimed}, claim_time = #{claimTime}, update_time = #{updateTime} WHERE id = #{id}")
    void update(PlayerSeasonRecord record);
}