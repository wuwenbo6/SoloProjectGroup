package com.crafthub.notification.controller;

import com.crafthub.common.result.Result;
import com.crafthub.notification.dto.OrderProgressDTO;
import com.crafthub.notification.entity.Notification;
import com.crafthub.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notification")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/order-progress")
    public Result<Void> pushOrderProgress(@Valid @RequestBody OrderProgressDTO dto) {
        notificationService.pushOrderProgress(dto);
        return Result.success("推送成功");
    }

    @GetMapping("/list")
    public Result<List<Notification>> getUserNotifications(
            @RequestHeader(required = false) Long userId,
            @RequestParam(defaultValue = "1") Integer userType) {
        if (userId == null) {
            userId = 1L;
        }
        return notificationService.getUserNotifications(userId, userType);
    }

    @PutMapping("/{id}/read")
    public Result<Void> markAsRead(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return notificationService.markAsRead(id, userId);
    }

    @PutMapping("/read-all")
    public Result<Void> markAllAsRead(
            @RequestHeader(required = false) Long userId,
            @RequestParam(defaultValue = "1") Integer userType) {
        if (userId == null) {
            userId = 1L;
        }
        return notificationService.markAllAsRead(userId, userType);
    }

    @GetMapping("/unread-count")
    public Result<Integer> getUnreadCount(
            @RequestHeader(required = false) Long userId,
            @RequestParam(defaultValue = "1") Integer userType) {
        if (userId == null) {
            userId = 1L;
        }
        return notificationService.getUnreadCount(userId, userType);
    }
}
