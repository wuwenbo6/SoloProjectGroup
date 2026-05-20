package com.folk.activity.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.folk.activity.order.entity.Order;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {
}
