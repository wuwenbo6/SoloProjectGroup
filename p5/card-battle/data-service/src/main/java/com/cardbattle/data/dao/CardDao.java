package com.cardbattle.data.dao;

import com.cardbattle.data.entity.Card;
import com.cardbattle.data.entity.PlayerCard;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CardDao {
    
    @Select("SELECT * FROM card WHERE id = #{id}")
    Card findById(Long id);
    
    @Select("SELECT * FROM card WHERE status = 1")
    List<Card> findAllActive();
    
    @Select("SELECT * FROM player_card WHERE player_id = #{playerId}")
    List<PlayerCard> findPlayerCards(Long playerId);
    
    @Insert("INSERT INTO player_card(player_id, card_id, count, obtain_time) " +
            "VALUES(#{playerId}, #{cardId}, #{count}, #{obtainTime})")
    int insertPlayerCard(PlayerCard playerCard);
    
    @Update("UPDATE player_card SET count = count + 1 WHERE player_id = #{playerId} AND card_id = #{cardId}")
    int incrementPlayerCard(@Param("playerId") Long playerId, @Param("cardId") Long cardId);
    
    @Select("SELECT c.* FROM card c JOIN player_card pc ON c.id = pc.card_id " +
            "WHERE pc.player_id = #{playerId} AND pc.count > 0")
    List<Card> findPlayerOwnedCards(Long playerId);
}