package com.ancientbook.common.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Component
public class IdempotentLock {

    private final Map<String, LockHolder> lockMap = new ConcurrentHashMap<>();

    private static class LockHolder {
        long expireTime;
        AtomicBoolean locked;

        LockHolder(long expireTime) {
            this.expireTime = expireTime;
            this.locked = new AtomicBoolean(false);
        }
    }

    public boolean tryLock(String key, int expireTime, TimeUnit timeUnit) {
        long now = System.currentTimeMillis();
        long expire = now + timeUnit.toMillis(expireTime);

        LockHolder holder = lockMap.compute(key, (k, v) -> {
            if (v == null || now > v.expireTime) {
                return new LockHolder(expire);
            }
            return v;
        });

        boolean acquired = holder.locked.compareAndSet(false, true);
        if (acquired) {
            holder.expireTime = expire;
            log.debug("获取幂等锁成功: {}", key);
        } else {
            log.warn("获取幂等锁失败，请求重复: {}", key);
        }
        return acquired;
    }

    public void unlock(String key) {
        LockHolder holder = lockMap.get(key);
        if (holder != null) {
            holder.locked.set(false);
        }
    }

    public void cleanExpiredLocks() {
        long now = System.currentTimeMillis();
        lockMap.entrySet().removeIf(entry -> now > entry.getValue().expireTime);
    }
}
