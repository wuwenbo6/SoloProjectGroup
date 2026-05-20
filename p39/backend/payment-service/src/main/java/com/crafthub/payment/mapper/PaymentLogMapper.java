package com.crafthub.payment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crafthub.payment.entity.PaymentLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PaymentLogMapper extends BaseMapper<PaymentLog> {
}
