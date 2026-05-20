package com.crafthub.common.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String ORDER_PREFIX = "order:";
    private static final String USER_ORDERS_PREFIX = "user:orders:";
    private static final String MATERIAL_PREFIX = "material:";
    private static final String ARTISAN_PREFIX = "artisan:";
    private static final String PAYMENT_PREFIX = "payment:";
    private static final String LOCK_PREFIX = "lock:";

    public void set(String key, Object value) {
        redisTemplate.opsForValue().set(key, value);
    }

    public void set(String key, Object value, long timeout, TimeUnit unit) {
        redisTemplate.opsForValue().set(key, value, timeout, unit);
    }

    public Object get(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    public Boolean delete(String key) {
        return redisTemplate.delete(key);
    }

    public Long delete(Collection<String> keys) {
        return redisTemplate.delete(keys);
    }

    public Boolean hasKey(String key) {
        return redisTemplate.hasKey(key);
    }

    public Boolean expire(String key, long timeout, TimeUnit unit) {
        return redisTemplate.expire(key, timeout, unit);
    }

    public Long getExpire(String key) {
        return redisTemplate.getExpire(key);
    }

    public void setOrder(Long orderId, Object order) {
        set(ORDER_PREFIX + orderId, order, 30, TimeUnit.MINUTES);
    }

    public Object getOrder(Long orderId) {
        return get(ORDER_PREFIX + orderId);
    }

    public void deleteOrder(Long orderId) {
        delete(ORDER_PREFIX + orderId);
    }

    public void setUserOrders(Long userId, List<?> orders) {
        set(USER_ORDERS_PREFIX + userId, orders, 15, TimeUnit.MINUTES);
    }

    public Object getUserOrders(Long userId) {
        return get(USER_ORDERS_PREFIX + userId);
    }

    public void deleteUserOrders(Long userId) {
        delete(USER_ORDERS_PREFIX + userId);
    }

    public void setMaterial(Long materialId, Object material) {
        set(MATERIAL_PREFIX + materialId, material, 1, TimeUnit.HOURS);
    }

    public Object getMaterial(Long materialId) {
        return get(MATERIAL_PREFIX + materialId);
    }

    public void setArtisan(Long artisanId, Object artisan) {
        set(ARTISAN_PREFIX + artisanId, artisan, 1, TimeUnit.HOURS);
    }

    public Object getArtisan(Long artisanId) {
        return get(ARTISAN_PREFIX + artisanId);
    }

    public void setPayment(String paymentNo, Object payment) {
        set(PAYMENT_PREFIX + paymentNo, payment, 1, TimeUnit.HOURS);
    }

    public Object getPayment(String paymentNo) {
        return get(PAYMENT_PREFIX + paymentNo);
    }

    public Boolean tryLock(String key, long timeout, TimeUnit unit) {
        String lockKey = LOCK_PREFIX + key;
        Boolean result = redisTemplate.opsForValue().setIfAbsent(lockKey, "locked", timeout, unit);
        return Boolean.TRUE.equals(result);
    }

    public void unlock(String key) {
        delete(LOCK_PREFIX + key);
    }

    public void evictOrderCache(Long orderId, Long userId) {
        deleteOrder(orderId);
        deleteUserOrders(userId);
        log.info("订单缓存已清除, orderId: {}, userId: {}", orderId, userId);
    }

    public Set<String> keys(String pattern) {
        return redisTemplate.keys(pattern);
    }

    public void setHash(String key, Map<String, Object> map) {
        redisTemplate.opsForHash().putAll(key, map);
    }

    public Object getHashValue(String key, String hashKey) {
        return redisTemplate.opsForHash().get(key, hashKey);
    }

    public Map<Object, Object> getHash(String key) {
        return redisTemplate.opsForHash().entries(key);
    }
}
