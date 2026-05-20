package com.ancient.book.common.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

@Slf4j
@Configuration
public class RequestCacheConfig {

    @Bean(name = "serviceResponseCache")
    public Cache<String, Object> serviceResponseCache() {
        Cache<String, Object> cache = Caffeine.newBuilder()
                .maximumSize(10000)
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .expireAfterAccess(2, TimeUnit.MINUTES)
                .recordStats()
                .removalListener((key, value, cause) -> {
                    log.debug("缓存移除: key={}, cause={}", key, cause);
                })
                .build();

        log.info("服务响应缓存初始化完成: 最大容量=10000, 写入过期=5分钟, 访问过期=2分钟");
        return cache;
    }

    @Bean(name = "idempotentCache")
    public Cache<String, Long> idempotentCache() {
        Cache<String, Long> cache = Caffeine.newBuilder()
                .maximumSize(50000)
                .expireAfterWrite(1, TimeUnit.HOURS)
                .build();

        log.info("幂等性缓存初始化完成: 最大容量=50000, 过期=1小时");
        return cache;
    }

    @Bean(name = "hotDataCache")
    public Cache<String, Object> hotDataCache() {
        Cache<String, Object> cache = Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(30, TimeUnit.SECONDS)
                .recordStats()
                .build();

        log.info("热点数据缓存初始化完成: 最大容量=1000, 过期=30秒");
        return cache;
    }

    public static class CacheHelper {
        public static <K, V> V getOrLoad(Cache<K, V> cache, K key, Function<K, V> loader) {
            return cache.get(key, loader);
        }

        public static void logStats(String cacheName, CacheStats stats) {
            log.info("{} 统计: 命中={}, 未命中={}, 命中率={}%, 加载时间={}ms",
                    cacheName,
                    stats.hitCount(),
                    stats.missCount(),
                    String.format("%.2f", stats.hitRate() * 100),
                    stats.totalLoadTime() / 1000000);
        }
    }
}
