package com.folk.activity.order.service;

import com.alibaba.fastjson2.JSON;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.folk.activity.common.core.entity.Order;
import com.folk.activity.order.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderProgressService {
    private final OrderMapper orderMapper;
    private final RabbitTemplate rabbitTemplate;

    public static final String[] PROGRESS_STEPS = {
        "已下单", "已确认", "已支付", "报名成功", "活动进行中", "已完成"
    };

    public void updateOrderProgress(String orderNo, int progressIndex) {
        LambdaQueryWrapper<Order> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Order::getOrderNo, orderNo);
        Order order = orderMapper.selectOne(queryWrapper);
        
        if (order != null) {
            order.setStatus(progressIndex);
            order.setUpdateTime(LocalDateTime.now());
            orderMapper.updateById(order);
            
            pushProgressNotification(order, progressIndex);
        }
    }

    public void pushProgressNotification(Order order, int progressIndex) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "ORDER_PROGRESS");
        message.put("orderNo", order.getOrderNo());
        message.put("userId", order.getUserId());
        message.put("progress", progressIndex);
        message.put("progressText", PROGRESS_STEPS[progressIndex]);
        message.put("title", "订单进度更新");
        message.put("content", String.format("您的「%s」订单状态更新为：%s", 
            order.getActivityName(), PROGRESS_STEPS[progressIndex]));
        message.put("createTime", LocalDateTime.now().toString());

        rabbitTemplate.convertAndSend("message.exchange", "message.send", message);
    }

    public List<Map<String, Object>> getOrderProgressTimeline(String orderNo) {
        LambdaQueryWrapper<Order> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Order::getOrderNo, orderNo);
        Order order = orderMapper.selectOne(queryWrapper);
        
        if (order == null) {
            return List.of();
        }

        int currentProgress = order.getStatus() != null ? order.getStatus() : 0;
        
        return List.of(
            createProgressItem(0, "已下单", currentProgress >= 0, order.getCreateTime()),
            createProgressItem(1, "已确认", currentProgress >= 1, null),
            createProgressItem(2, "已支付", currentProgress >= 2, order.getPaymentTime()),
            createProgressItem(3, "报名成功", currentProgress >= 3, null),
            createProgressItem(4, "活动进行中", currentProgress >= 4, null),
            createProgressItem(5, "已完成", currentProgress >= 5, null)
        );
    }

    private Map<String, Object> createProgressItem(int index, String text, boolean completed, LocalDateTime time) {
        Map<String, Object> item = new HashMap<>();
        item.put("index", index);
        item.put("text", text);
        item.put("completed", completed);
        item.put("time", time != null ? time.toString() : null);
        return item;
    }

    public void simulateProgress(String orderNo) {
        for (int i = 1; i <= 5; i++) {
            try {
                Thread.sleep(2000);
                updateOrderProgress(orderNo, i);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
}
