package com.crafthub.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.common.dto.OrderProgressDTO;
import com.crafthub.common.result.Result;
import com.crafthub.order.dto.OrderCreateDTO;
import com.crafthub.order.entity.Order;
import com.crafthub.order.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderService extends ServiceImpl<OrderMapper, Order> {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final RestTemplate restTemplate;

    private static final String NOTIFICATION_SERVICE_URL = "http://notification-service/notification/order-progress";

    private static final Map<Integer, String> STATUS_DESC = new HashMap<>();
    static {
        STATUS_DESC.put(1, "待支付");
        STATUS_DESC.put(2, "已支付");
        STATUS_DESC.put(3, "制作中");
        STATUS_DESC.put(4, "配送中");
        STATUS_DESC.put(5, "已完成");
    }

    public Page<Order> getUserOrders(Long userId, Integer page, Integer size) {
        Page<Order> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Order::getUserId, userId)
               .orderByDesc(Order::getCreateTime);
        return page(pageParam, wrapper);
    }

    public Page<Order> getArtisanOrders(Long artisanId, Integer page, Integer size) {
        Page<Order> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Order::getArtisanId, artisanId)
               .orderByDesc(Order::getCreateTime);
        return page(pageParam, wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(OrderCreateDTO dto) {
        Order order = new Order();
        order.setOrderNo(generateOrderNo());
        order.setUserId(dto.getUserId());
        order.setArtisanId(dto.getArtisanId());
        order.setRequirementId(dto.getRequirementId());
        order.setTitle(dto.getTitle());
        order.setDescription(dto.getDescription());
        order.setAmount(dto.getAmount());
        order.setStatus(1);
        order.setProgress(0);
        save(order);
        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateProgress(Long orderId, Integer progress, String progressDesc) {
        Order order = getById(orderId);
        if (order == null) {
            return false;
        }
        order.setProgress(progress);
        if (progress >= 100) {
            order.setStatus(5);
        }
        updateById(order);

        pushOrderProgress(order, progress, progressDesc);

        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateStatus(Long orderId, Integer status) {
        Order order = getById(orderId);
        if (order == null) {
            return false;
        }
        order.setStatus(status);
        updateById(order);

        pushOrderProgress(order, order.getProgress(), STATUS_DESC.getOrDefault(status, "状态更新"));

        return true;
    }

    private void pushOrderProgress(Order order, Integer progress, String progressDesc) {
        try {
            OrderProgressDTO dto = new OrderProgressDTO();
            dto.setOrderId(order.getId());
            dto.setOrderNo(order.getOrderNo());
            dto.setUserId(order.getUserId());
            dto.setArtisanId(order.getArtisanId());
            dto.setProgress(progress);
            dto.setProgressDesc(progressDesc);
            dto.setStatus(order.getStatus());
            dto.setStatusDesc(STATUS_DESC.getOrDefault(order.getStatus(), "未知状态"));
            dto.setUpdateTime(LocalDateTime.now());

            restTemplate.postForObject(NOTIFICATION_SERVICE_URL, dto, Result.class);
            log.info("订单进度推送成功，订单ID: {}", order.getId());
        } catch (Exception e) {
            log.error("订单进度推送失败，订单ID: {}", order.getId(), e);
        }
    }

    private String generateOrderNo() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        int random = (int) ((Math.random() * 9 + 1) * 1000);
        return "ORD" + timestamp + random;
    }
}
