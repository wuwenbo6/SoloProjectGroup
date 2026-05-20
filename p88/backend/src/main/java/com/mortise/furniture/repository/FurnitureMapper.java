package com.mortise.furniture.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mortise.furniture.entity.Furniture;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FurnitureMapper extends BaseMapper<Furniture> {
}
