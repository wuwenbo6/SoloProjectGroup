package com.rubbing.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.rubbing.entity.RubbingRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface RubbingRecordMapper extends BaseMapper<RubbingRecord> {

    @Select("SELECT archive_level as level, COUNT(*) as count FROM rubbing_record WHERE deleted = 0 AND archive_level IS NOT NULL GROUP BY archive_level")
    List<Map<String, Object>> countByArchiveLevel();

    @Select("SELECT COUNT(*) FROM rubbing_record WHERE deleted = 0 AND archive_level = #{level}")
    Integer countByLevel(@Param("level") String level);
}
