package com.folk.activity.order.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.folk.activity.order.dto.OrderCreateDTO;
import com.folk.activity.order.entity.Order;
import com.folk.activity.order.mapper.OrderMapper;
import com.folk.activity.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl extends ServiceImpl<OrderMapper, Order> implements OrderService {

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(OrderCreateDTO dto) {
        Order order = new Order();
        order.setOrderNo("ORD" + IdUtil.getSnowflakeNextIdStr());
        order.setUserId(dto.getUserId());
        order.setUserName(dto.getUserName());
        order.setUserPhone(dto.getUserPhone());
        order.setActivityId(dto.getActivityId());
        order.setActivityName(dto.getActivityName());
        order.setQuantity(dto.getQuantity());
        order.setUnitPrice(dto.getUnitPrice());
        order.setTotalAmount(dto.getUnitPrice().multiply(BigDecimal.valueOf(dto.getQuantity())));
        order.setStatus(0);
        order.setRemark(dto.getRemark());
        order.setDeleted(0);
        save(order);
        return order;
    }

    @Override
    public Order getOrderByNo(String orderNo) {
        return getOne(new LambdaQueryWrapper<Order>().eq(Order::getOrderNo, orderNo));
    }

    @Override
    public List<Order> getUserOrders(Long userId) {
        return list(new LambdaQueryWrapper<Order>()
            .eq(Order::getUserId, userId)
            .orderByDesc(Order::getCreateTime));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean cancelOrder(String orderNo) {
        Order order = getOrderByNo(orderNo);
        if (order != null && order.getStatus() == 0) {
            order.setStatus(3);
            return updateById(order);
        }
        return false;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean payOrder(String orderNo, String paymentMethod) {
        Order order = getOrderByNo(orderNo);
        if (order != null && order.getStatus() == 0) {
            order.setStatus(1);
            order.setPaymentMethod(paymentMethod);
            order.setPaymentTime(LocalDateTime.now());
            return updateById(order);
        }
        return false;
    }
}
