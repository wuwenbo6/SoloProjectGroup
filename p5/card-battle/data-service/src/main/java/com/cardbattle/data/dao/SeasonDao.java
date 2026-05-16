package com.cardbattle.data.dao;

import com.cardbattle.data.entity.Season;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface SeasonDao {
    
    @Select("SELECT * FROM season WHERE id = #{id}")
    Season findById(@Param("id") Integer id);
    
    @Select("SELECT * FROM season WHERE status = 1 ORDER BY id DESC LIMIT 1")
    Season findActiveSeason();
    
    @Select("SELECT * FROM season ORDER BY id DESC")
    List<Season> findAll();
    
    @Insert("INSERT INTO season (name, description, start_time, end_time, status, create_time) " +
            "VALUES (#{name}, #{description}, #{startTime}, #{endTime}, #{status}, #{createTime})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Season season);
    
    @Update("UPDATE season SET name = #{name}, description = #{description}, " +
            "start_time = #{startTime}, end_time = #{endTime}, status = #{status} WHERE id = #{id}")
    void update(Season season);
    
    @Update("UPDATE season SET status = #{status} WHERE id = #{id}")
    void updateStatus(@Param("id") Integer id, @Param("status") Integer status);
}