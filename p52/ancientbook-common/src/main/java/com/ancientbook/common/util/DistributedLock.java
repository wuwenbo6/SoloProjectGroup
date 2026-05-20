package com.ancientbook.common.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.LockSupport;

@Slf4j
@Component
public class DistributedLock {

    private final Map<String, LockHolder> locks = new ConcurrentHashMap<>();

    private static class LockHolder {
        final AtomicBoolean locked = new AtomicBoolean(false);
        final AtomicInteger holdCount = new AtomicInteger(0);
        Thread holder;
        long expireTime;

        boolean tryLock(long timeoutMs) {
            long start = System.nanoTime();
            long timeoutNanos = TimeUnit.MILLISECONDS.toNanos(timeoutMs);

            while (true) {
                if (locked.compareAndSet(false, true)) {
                    holder = Thread.currentThread();
                    expireTime = System.currentTimeMillis() + 30000; // 30秒超时释放
                    holdCount.incrementAndGet();
                    return true;
                }

                // 检查锁是否过期
                if (System.currentTimeMillis() > expireTime && locked.get()) {
                    log.warn("锁超时自动释放: holder={}", holder);
                    locked.set(false);
                    holder = null;
                    continue;
                }

                // 检查是否超时
                if (System.nanoTime() - start > timeoutNanos) {
                    return false;
                }

                LockSupport.parkNanos(100000); // 100微秒
            }
        }

        void unlock() {
            if (holder != Thread.currentThread()) {
                throw new IllegalStateException("不是锁的持有者，不能释放");
            }
            if (holdCount.decrementAndGet() == 0) {
                locked.set(false);
                holder = null;
            }
        }

        boolean isHeldByCurrentThread() {
            return holder == Thread.currentThread();
        }
    }

    public boolean tryLock(String key) {
        return tryLock(key, 5000);
    }

    public boolean tryLock(String key, long timeoutMs) {
        LockHolder holder = locks.computeIfAbsent(key, k -> new LockHolder());
        boolean success = holder.tryLock(timeoutMs);
        if (success) {
            log.debug("获取锁成功: {}", key);
        } else {
            log.warn("获取锁超时: {}, 超时{}ms", key, timeoutMs);
        }
        return success;
    }

    public void lock(String key) {
        tryLock(key, Long.MAX_VALUE);
    }

    public void unlock(String key) {
        LockHolder holder = locks.get(key);
        if (holder != null) {
            try {
                holder.unlock();
                log.debug("释放锁成功: {}", key);
            } catch (Exception e) {
                log.error("释放锁失败: {}", key, e);
            }
        }
    }

    public <T> T executeWithLock(String key, long timeoutMs, LockCallback<T> callback) {
        if (!tryLock(key, timeoutMs)) {
            throw new RuntimeException("获取锁超时: " + key);
        }
        try {
            return callback.execute();
        } finally {
            unlock(key);
        }
    }

    @FunctionalInterface
    public interface LockCallback<T> {
        T execute();
    }

    public void cleanExpiredLocks() {
        long now = System.currentTimeMillis();
        locks.entrySet().removeIf(entry -> {
            LockHolder holder = entry.getValue();
            return holder.locked.get() && now > holder.expireTime;
        });
    }
}
