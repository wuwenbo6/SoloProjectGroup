package com.cardbattle.data.dao;

import com.cardbattle.data.entity.SeasonReward;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface SeasonRewardDao {
    
    @Select("SELECT * FROM season_reward WHERE id = #{id}")
    SeasonReward findById(@Param("id") Long id);
    
    @Select("SELECT * FROM season_reward WHERE season_id = #{seasonId} ORDER BY min_rank_id ASC")
    List<SeasonReward> findBySeasonId(@Param("seasonId") Integer seasonId);
    
    @Select("SELECT * FROM season_reward WHERE season_id = #{seasonId} AND min_rank_id <= #{rankId} " +
            "AND max_rank_id >= #{rankId} ORDER BY min_rank_id ASC")
    List<SeasonReward> findByRankRange(@Param("seasonId") Integer seasonId, @Param("rankId") Integer rankId);
    
    @Insert("INSERT INTO season_reward (season_id, min_rank_id, max_rank_id, rank_name, reward_type, " +
            "reward_name, reward_value, reward_description, create_time) " +
            "VALUES (#{seasonId}, #{minRankId}, #{maxRankId}, #{rankName}, #{rewardType}, " +
            "#{rewardName}, #{rewardValue}, #{rewardDescription}, #{createTime})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(SeasonReward reward);
    
    @Delete("DELETE FROM season_reward WHERE id = #{id}")
    void delete(@Param("id") Long id);
}