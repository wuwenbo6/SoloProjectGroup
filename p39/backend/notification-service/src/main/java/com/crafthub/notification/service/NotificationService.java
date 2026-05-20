package com.crafthub.notification.service;

import com.crafthub.common.result.Result;
import com.crafthub.notification.dto.OrderProgressDTO;
import com.crafthub.notification.entity.Notification;
import com.crafthub.notification.mapper.NotificationMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationMapper notificationMapper;

    @Transactional(rollbackFor = Exception.class)
    public void pushOrderProgress(OrderProgressDTO dto) {
        log.info("推送订单进度，订单ID: {}, 进度: {}", dto.getOrderId(), dto.getProgress());

        Notification userNotification = createNotification(
            dto.getUserId(), 1, "ORDER_PROGRESS",
            "订单进度更新",
            String.format("您的订单%s进度已更新为%d%% - %s",
                dto.getOrderNo(), dto.getProgress(), dto.getProgressDesc()),
            dto.getOrderId(), "ORDER"
        );

        Notification artisanNotification = createNotification(
            dto.getArtisanId(), 2, "ORDER_PROGRESS",
            "订单进度更新",
            String.format("订单%s进度已更新为%d%% - %s",
                dto.getOrderNo(), dto.getProgress(), dto.getProgressDesc()),
            dto.getOrderId(), "ORDER"
        );

        notificationMapper.insert(userNotification);
        notificationMapper.insert(artisanNotification);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "ORDER_PROGRESS");
        message.put("orderId", dto.getOrderId());
        message.put("orderNo", dto.getOrderNo());
        message.put("progress", dto.getProgress());
        message.put("progressDesc", dto.getProgressDesc());
        message.put("status", dto.getStatus());
        message.put("statusDesc", dto.getStatusDesc());
        message.put("remark", dto.getRemark());
        message.put("updateTime", dto.getUpdateTime());
        message.put("notificationId", userNotification.getId());

        messagingTemplate.convertAndSendToUser(
            String.valueOf(dto.getUserId()),
            "/queue/notifications",
            message
        );

        messagingTemplate.convertAndSendToUser(
            String.valueOf(dto.getArtisanId()),
            "/queue/notifications",
            message
        );

        log.info("订单进度推送完成");
    }

    private Notification createNotification(Long userId, Integer userType, String type,
                                            String title, String content,
                                            Long relatedId, String relatedType) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setUserType(userType);
        notification.setType(type);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setRelatedId(relatedId);
        notification.setRelatedType(relatedType);
        notification.setIsRead(0);
        notification.setCreateTime(LocalDateTime.now());
        return notification;
    }

    public Result<List<Notification>> getUserNotifications(Long userId, Integer userType) {
        List<Notification> notifications = notificationMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .eq(Notification::getUserType, userType)
                .orderByDesc(Notification::getCreateTime)
                .last("limit 50")
        );
        return Result.success(notifications);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> markAsRead(Long notificationId, Long userId) {
        Notification notification = notificationMapper.selectById(notificationId);
        if (notification != null && notification.getUserId().equals(userId)) {
            notification.setIsRead(1);
            notification.setReadTime(LocalDateTime.now());
            notificationMapper.updateById(notification);
        }
        return Result.success();
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> markAllAsRead(Long userId, Integer userType) {
        List<Notification> notifications = notificationMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .eq(Notification::getUserType, userType)
                .eq(Notification::getIsRead, 0)
        );

        for (Notification notification : notifications) {
            notification.setIsRead(1);
            notification.setReadTime(LocalDateTime.now());
            notificationMapper.updateById(notification);
        }
        return Result.success();
    }

    public Result<Integer> getUnreadCount(Long userId, Integer userType) {
        Long count = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .eq(Notification::getUserType, userType)
                .eq(Notification::getIsRead, 0)
        );
        return Result.success(count.intValue());
    }
}
