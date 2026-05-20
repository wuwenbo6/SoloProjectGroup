package com.crafthub.common.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataSyncService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final CacheService cacheService;

    private static final String SYNC_QUEUE_KEY = "data:sync:queue";
    private static final String SYNC_STATUS_PREFIX = "data:sync:status:";

    public enum SyncType {
        ORDER_STATUS,
        ORDER_PROGRESS,
        PAYMENT_STATUS,
        MATERIAL_STOCK,
        ARTISAN_INFO
    }

    public void publishSyncEvent(SyncType syncType, Long targetId, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("syncType", syncType.name());
        event.put("targetId", targetId);
        event.put("data", data);
        event.put("timestamp", LocalDateTime.now().toString());

        try {
            String eventJson = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().leftPush(SYNC_QUEUE_KEY, eventJson);
            log.info("数据同步事件已发布, type: {}, targetId: {}", syncType, targetId);
        } catch (JsonProcessingException e) {
            log.error("序列化同步事件失败", e);
        }
    }

    public Object consumeSyncEvent() {
        Object event = redisTemplate.opsForList().rightPop(SYNC_QUEUE_KEY, 5, TimeUnit.SECONDS);
        if (event != null) {
            log.debug("消费同步事件: {}", event);
        }
        return event;
    }

    public void updateSyncStatus(String eventId, boolean success, String message) {
        Map<String, Object> status = new HashMap<>();
        status.put("eventId", eventId);
        status.put("success", success);
        status.put("message", message);
        status.put("timestamp", LocalDateTime.now().toString());

        cacheService.set(SYNC_STATUS_PREFIX + eventId, status, 1, TimeUnit.HOURS);
    }

    public void broadcastOrderStatusChange(Long orderId, Integer status, Long userId) {
        Map<String, Object> data = new HashMap<>();
        data.put("orderId", orderId);
        data.put("status", status);
        data.put("userId", userId);
        data.put("updateTime", LocalDateTime.now().toString());

        publishSyncEvent(SyncType.ORDER_STATUS, orderId, data);

        cacheService.deleteOrder(orderId);
        cacheService.deleteUserOrders(userId);

        log.info("订单状态变更事件已广播, orderId: {}, status: {}", orderId, status);
    }

    public void broadcastOrderProgressChange(Long orderId, Integer progress, Long userId, Long artisanId) {
        Map<String, Object> data = new HashMap<>();
        data.put("orderId", orderId);
        data.put("progress", progress);
        data.put("userId", userId);
        data.put("artisanId", artisanId);
        data.put("updateTime", LocalDateTime.now().toString());

        publishSyncEvent(SyncType.ORDER_PROGRESS, orderId, data);

        cacheService.deleteOrder(orderId);
        cacheService.deleteUserOrders(userId);

        log.info("订单进度变更事件已广播, orderId: {}, progress: {}", orderId, progress);
    }

    public void broadcastPaymentStatusChange(String paymentNo, Long orderId, Integer status) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentNo", paymentNo);
        data.put("orderId", orderId);
        data.put("status", status);
        data.put("updateTime", LocalDateTime.now().toString());

        publishSyncEvent(SyncType.PAYMENT_STATUS, orderId, data);

        log.info("支付状态变更事件已广播, paymentNo: {}, status: {}", paymentNo, status);
    }

    public void broadcastMaterialStockChange(Long materialId, Integer stock) {
        Map<String, Object> data = new HashMap<>();
        data.put("materialId", materialId);
        data.put("stock", stock);
        data.put("updateTime", LocalDateTime.now().toString());

        publishSyncEvent(SyncType.MATERIAL_STOCK, materialId, data);

        cacheService.delete("material:" + materialId);

        log.info("物料库存变更事件已广播, materialId: {}, stock: {}", materialId, stock);
    }

    public Long getPendingEventCount() {
        return redisTemplate.opsForList().size(SYNC_QUEUE_KEY);
    }

    public Object getSyncStatus(String eventId) {
        return cacheService.get(SYNC_STATUS_PREFIX + eventId);
    }
}
