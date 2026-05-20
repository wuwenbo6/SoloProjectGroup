package com.folk.activity.audit.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.folk.activity.audit.entity.AuditRecord;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuditRecordMapper extends BaseMapper<AuditRecord> {
}
