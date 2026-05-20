package com.heritage.database.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.heritage.database.entity.HeritageEquipment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface HeritageEquipmentMapper extends BaseMapper<HeritageEquipment> {
    
    @Select("SELECT * FROM heritage_equipment WHERE sync_status = 0 AND is_deleted = 0 LIMIT #{limit}")
    List<HeritageEquipment> selectPendingSync(@Param("limit") Integer limit);
    
    @Select("SELECT COUNT(*) FROM heritage_equipment WHERE is_deleted = 0")
    Integer countTotal();
    
    @Select("SELECT DISTINCT category FROM heritage_equipment WHERE is_deleted = 0")
    List<String> selectAllCategories();
}