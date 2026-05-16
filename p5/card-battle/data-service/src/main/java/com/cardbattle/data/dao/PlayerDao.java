package com.cardbattle.data.dao;

import com.cardbattle.data.entity.Player;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface PlayerDao {
    
    @Select("SELECT * FROM player WHERE id = #{id}")
    Player findById(Long id);
    
    @Select("SELECT * FROM player WHERE username = #{username}")
    Player findByUsername(String username);
    
    @Insert("INSERT INTO player(username, password, nickname, level, exp, rank_id, rank_points, " +
            "wins, losses, draws, create_time, update_time, status) " +
            "VALUES(#{username}, #{password}, #{nickname}, #{level}, #{exp}, #{rankId}, #{rankPoints}, " +
            "#{wins}, #{losses}, #{draws}, #{createTime}, #{updateTime}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Player player);
    
    @Update("UPDATE player SET nickname=#{nickname}, level=#{level}, exp=#{exp}, rank_id=#{rankId}, " +
            "rank_points=#{rankPoints}, wins=#{wins}, losses=#{losses}, draws=#{draws}, " +
            "update_time=#{updateTime}, status=#{status} WHERE id=#{id}")
    int update(Player player);
    
    @Update("UPDATE player SET rank_points = rank_points + #{points}, update_time = NOW() WHERE id = #{id}")
    int addRankPoints(@Param("id") Long id, @Param("points") Integer points);
    
    @Update("UPDATE player SET wins = wins + 1, update_time = NOW() WHERE id = #{id}")
    int addWin(Long id);
    
    @Update("UPDATE player SET losses = losses + 1, update_time = NOW() WHERE id = #{id}")
    int addLoss(Long id);
    
    @Select("SELECT * FROM player WHERE rank_id = #{rankId}")
    List<Player> findByRankId(Integer rankId);
    
    @Update("UPDATE player SET rank_id = #{rankId}, rank_points = #{rankPoints}, update_time = NOW() WHERE id = #{id}")
    void updateRank(@Param("id") Long id, @Param("rankId") Integer rankId, @Param("rankPoints") Integer rankPoints);
    
    @Update("UPDATE player SET rank_title = #{rankTitle}, update_time = NOW() WHERE id = #{id}")
    void updateRankTitle(@Param("id") Long id, @Param("rankTitle") String rankTitle);
}