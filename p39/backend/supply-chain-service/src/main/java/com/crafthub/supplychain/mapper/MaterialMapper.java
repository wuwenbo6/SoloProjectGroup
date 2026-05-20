package com.crafthub.supplychain.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crafthub.supplychain.entity.Material;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MaterialMapper extends BaseMapper<Material> {
}
