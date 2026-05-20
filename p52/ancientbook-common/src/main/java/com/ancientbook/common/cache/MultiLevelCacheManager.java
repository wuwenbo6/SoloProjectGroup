package com.ancientbook.common.cache;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Component
public class MultiLevelCacheManager {

    private final Map<String, CacheEntry> l1Cache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry> l2Cache = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleanupExecutor = Executors.newScheduledThreadPool(2);

    private final AtomicLong hitCount = new AtomicLong(0);
    private final AtomicLong missCount = new AtomicLong(0);

    @PostConstruct
    public void init() {
        cleanupExecutor.scheduleAtFixedRate(this::cleanExpiredCache, 60, 60, TimeUnit.SECONDS);
        cleanupExecutor.scheduleAtFixedRate(this::printCacheStats, 300, 300, TimeUnit.SECONDS);
        log.info("多级缓存管理器初始化完成，L1容量: 10000, L2容量: 50000");
    }

    public void put(String key, Object value, long ttlSeconds, CacheLevel level) {
        CacheEntry entry = new CacheEntry(value, ttlSeconds * 1000 + System.currentTimeMillis());
        if (level == CacheLevel.L1) {
            if (l1Cache.size() >= 10000) {
                evictOldest(l1Cache, 1000);
            }
            l1Cache.put(key, entry);
        } else {
            if (l2Cache.size() >= 50000) {
                evictOldest(l2Cache, 5000);
            }
            l2Cache.put(key, entry);
        }
        log.debug("缓存写入: key={}, level={}, ttl={}s", key, level, ttlSeconds);
    }

    public Optional<Object> get(String key) {
        CacheEntry entry = l1Cache.get(key);
        if (entry != null && !entry.isExpired()) {
            hitCount.incrementAndGet();
            log.debug("L1缓存命中: key={}", key);
            return Optional.of(entry.getValue());
        }

        if (entry != null) {
            l1Cache.remove(key);
        }

        entry = l2Cache.get(key);
        if (entry != null && !entry.isExpired()) {
            hitCount.incrementAndGet();
            l1Cache.put(key, entry);
            log.debug("L2缓存命中，提升至L1: key={}", key);
            return Optional.of(entry.getValue());
        }

        if (entry != null) {
            l2Cache.remove(key);
        }

        missCount.incrementAndGet();
        log.debug("缓存未命中: key={}", key);
        return Optional.empty();
    }

    public void invalidate(String key) {
        l1Cache.remove(key);
        l2Cache.remove(key);
        log.debug("缓存失效: key={}", key);
    }

    public void invalidatePattern(String pattern) {
        String regex = pattern.replace("*", ".*");
        l1Cache.keySet().removeIf(k -> k.matches(regex));
        l2Cache.keySet().removeIf(k -> k.matches(regex));
        log.info("按模式批量失效缓存: pattern={}", pattern);
    }

    public void clearAll() {
        l1Cache.clear();
        l2Cache.clear();
        log.warn("清空所有缓存");
    }

    private void cleanExpiredCache() {
        int l1Removed = 0, l2Removed = 0;
        long now = System.currentTimeMillis();

        for (var it = l1Cache.entrySet().iterator(); it.hasNext(); ) {
            var entry = it.next();
            if (entry.getValue().isExpired(now)) {
                it.remove();
                l1Removed++;
            }
        }

        for (var it = l2Cache.entrySet().iterator(); it.hasNext(); ) {
            var entry = it.next();
            if (entry.getValue().isExpired(now)) {
                it.remove();
                l2Removed++;
            }
        }

        if (l1Removed > 0 || l2Removed > 0) {
            log.info("过期缓存清理完成，L1移除: {}, L2移除: {}", l1Removed, l2Removed);
        }
    }

    private void evictOldest(Map<String, CacheEntry> cache, int count) {
        long oldestTime = Long.MAX_VALUE;
        String oldestKey = null;

        for (int i = 0; i < count; i++) {
            for (var entry : cache.entrySet()) {
                if (entry.getValue().getCreateTime() < oldestTime) {
                    oldestTime = entry.getValue().getCreateTime();
                    oldestKey = entry.getKey();
                }
            }
            if (oldestKey != null) {
                cache.remove(oldestKey);
            }
        }
    }

    private void printCacheStats() {
        long total = hitCount.get() + missCount.get();
        double hitRate = total > 0 ? (double) hitCount.get() / total * 100 : 0;

        log.info("=== 缓存统计 ===");
        log.info("L1缓存大小: {}", l1Cache.size());
        log.info("L2缓存大小: {}", l2Cache.size());
        log.info("命中次数: {}", hitCount.get());
        log.info("未命中次数: {}", missCount.get());
        log.info("命中率: {:.2f}%", hitRate);
    }

    public CacheStats getStats() {
        long total = hitCount.get() + missCount.get();
        double hitRate = total > 0 ? (double) hitCount.get() / total * 100 : 0;

        return new CacheStats(
                l1Cache.size(),
                l2Cache.size(),
                hitCount.get(),
                missCount.get(),
                hitRate
        );
    }

    public enum CacheLevel {
        L1,
        L2
    }

    public static class CacheEntry {
        private final Object value;
        private final long expireTime;
        private final long createTime;

        public CacheEntry(Object value, long expireTime) {
            this.value = value;
            this.expireTime = expireTime;
            this.createTime = System.currentTimeMillis();
        }

        public boolean isExpired() {
            return System.currentTimeMillis() > expireTime;
        }

        public boolean isExpired(long now) {
            return now > expireTime;
        }

        public Object getValue() {
            return value;
        }

        public long getCreateTime() {
            return createTime;
        }
    }

    public record CacheStats(
            int l1Size,
            int l2Size,
            long hitCount,
            long missCount,
            double hitRate
    ) {}
}
