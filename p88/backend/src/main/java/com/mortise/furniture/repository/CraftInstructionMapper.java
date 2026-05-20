package com.mortise.furniture.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mortise.furniture.entity.CraftInstruction;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CraftInstructionMapper extends BaseMapper<CraftInstruction> {
}
