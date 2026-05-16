package com.cardbattle.data.dao;

import com.cardbattle.data.entity.BattleRecord;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface BattleDao {
    
    @Select("SELECT * FROM battle_record WHERE id = #{id}")
    BattleRecord findById(Long id);
    
    @Select("SELECT * FROM battle_record WHERE battle_id = #{battleId}")
    BattleRecord findByBattleId(String battleId);
    
    @Insert("INSERT INTO battle_record(battle_id, player1_id, player2_id, winner_id, " +
            "duration, turn_count, replay_data, start_time, end_time, status) " +
            "VALUES(#{battleId}, #{player1Id}, #{player2Id}, #{winnerId}, " +
            "#{duration}, #{turnCount}, #{replayData}, #{startTime}, #{endTime}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(BattleRecord record);
    
    @Update("UPDATE battle_record SET winner_id=#{winnerId}, duration=#{duration}, " +
            "turn_count=#{turnCount}, replay_data=#{replayData}, end_time=#{endTime}, " +
            "status=#{status} WHERE battle_id=#{battleId}")
    int update(BattleRecord record);
    
    @Select("SELECT * FROM battle_record WHERE player1_id = #{playerId} OR player2_id = #{playerId} " +
            "ORDER BY start_time DESC LIMIT #{limit} OFFSET #{offset}")
    List<BattleRecord> findByPlayerId(@Param("playerId") Long playerId, @Param("limit") Integer limit, @Param("offset") Integer offset);
    
    @Select("SELECT COUNT(*) FROM battle_record WHERE player1_id = #{playerId} OR player2_id = #{playerId}")
    int countByPlayerId(@Param("playerId") Long playerId);
    
    @Update("UPDATE battle_record SET replay_data = #{replayData} WHERE battle_id = #{battleId}")
    void updateReplayData(@Param("battleId") String battleId, @Param("replayData") String replayData);
}