package com.cardbattle.data.dao;

import com.cardbattle.data.entity.Rank;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface RankDao {
    
    @Select("SELECT * FROM rank WHERE id = #{id}")
    Rank findById(Integer id);
    
    @Select("SELECT * FROM rank ORDER BY `order` ASC")
    List<Rank> findAllOrdered();
    
    @Select("SELECT * FROM rank WHERE min_points <= #{points} AND max_points >= #{points}")
    Rank findByPoints(Integer points);
}