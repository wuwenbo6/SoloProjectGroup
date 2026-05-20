package com.folk.activity.order.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.folk.activity.order.dto.OrderCreateDTO;
import com.folk.activity.order.entity.Order;

import java.util.List;

public interface OrderService extends IService<Order> {
    Order createOrder(OrderCreateDTO dto);
    Order getOrderByNo(String orderNo);
    List<Order> getUserOrders(Long userId);
    boolean cancelOrder(String orderNo);
    boolean payOrder(String orderNo, String paymentMethod);
}
