package com.ancient.book.common.service;

import com.ancient.book.common.config.CircuitBreakerConfig;
import com.ancient.book.common.config.RequestCacheConfig;
import com.ancient.book.common.config.ServiceRegistryConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import com.github.benmanes.caffeine.cache.Cache;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Slf4j
@Component
@RequiredArgsConstructor
public class UnifiedServiceCaller {

    private final ServiceRegistryConfig serviceRegistry;
    private final CircuitBreakerConfig circuitBreakerConfig;
    private final Cache<String, Object> serviceResponseCache;
    private final Cache<String, Long> idempotentCache;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, Long> callCounter = new ConcurrentHashMap<>();
    private final Map<String, Long> totalLatency = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("统一服务调用客户端初始化完成");
    }

    public <T> T callService(String serviceName, String path, HttpMethod method,
                              Object body, Class<T> responseType, boolean useCache) {
        long startTime = System.currentTimeMillis();

        String cacheKey = null;
        if (useCache && method == HttpMethod.GET) {
            cacheKey = serviceName + ":" + path;
            Object cached = serviceResponseCache.getIfPresent(cacheKey);
            if (cached != null) {
                log.debug("缓存命中: {}", cacheKey);
                return (T) cached;
            }
        }

        CircuitBreaker circuitBreaker = circuitBreakerConfig.getCircuitBreaker(serviceName);
        if (circuitBreaker == null) {
            throw new RuntimeException("Service not found: " + serviceName);
        }

        try {
            Supplier<T> call = () -> {
                String baseUrl = serviceRegistry.getServiceUrl(serviceName);
                if (baseUrl == null) {
                    throw new RuntimeException("Service unavailable: " + serviceName);
                }

                String fullUrl = baseUrl + path;
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Request-ID", java.util.UUID.randomUUID().toString());

                HttpEntity<Object> entity = body != null ?
                        new HttpEntity<>(body, headers) : new HttpEntity<>(headers);

                ResponseEntity<T> response = restTemplate.exchange(
                        fullUrl, method, entity, responseType);

                serviceRegistry.markServiceHealthy(serviceName);
                return response.getBody();
            };

            T result = circuitBreaker.executeSupplier(call);

            if (useCache && method == HttpMethod.GET && cacheKey != null && result != null) {
                serviceResponseCache.put(cacheKey, result);
            }

            recordMetrics(serviceName, System.currentTimeMillis() - startTime);
            return result;

        } catch (Exception e) {
            serviceRegistry.markServiceUnhealthy(serviceName);
            log.error("服务调用失败: {} {} - {}", serviceName, path, e.getMessage());
            throw e;
        }
    }

    public <T> T callServiceWithIdempotency(String serviceName, String path,
                                              HttpMethod method, Object body,
                                              Class<T> responseType, String idempotencyKey) {
        if (idempotencyCache.getIfPresent(idempotencyKey) != null) {
            log.warn("重复请求检测，直接返回: {}", idempotencyKey);
            return null;
        }

        T result = callService(serviceName, path, method, body, responseType, false);
        idempotencyCache.put(idempotencyKey, System.currentTimeMillis());
        return result;
    }

    public <T> T callServiceWithFallback(String serviceName, String path,
                                          HttpMethod method, Object body,
                                          Class<T> responseType, Supplier<T> fallback) {
        try {
            return callService(serviceName, path, method, body, responseType, true);
        } catch (Exception e) {
            log.warn("服务调用失败，使用降级逻辑: {} - {}", serviceName, e.getMessage());
            return fallback.get();
        }
    }

    private void recordMetrics(String serviceName, long latency) {
        callCounter.merge(serviceName, 1L, Long::sum);
        totalLatency.merge(serviceName, latency, Long::sum);
    }

    public Map<String, Object> getServiceMetrics() {
        Map<String, Object> metrics = new ConcurrentHashMap<>();

        for (String service : callCounter.keySet()) {
            long count = callCounter.get(service);
            long total = totalLatency.get(service);
            double avgLatency = count > 0 ? (double) total / count : 0;

            Map<String, Object> serviceMetrics = new ConcurrentHashMap<>();
            serviceMetrics.put("callCount", count);
            serviceMetrics.put("totalLatencyMs", total);
            serviceMetrics.put("avgLatencyMs", String.format("%.2f", avgLatency));

            metrics.put(service, serviceMetrics);
        }

        metrics.put("cacheStats", serviceResponseCache.stats().toString());
        metrics.put("circuitBreakerStates", circuitBreakerConfig.getAllCircuitBreakerStates());
        metrics.put("healthyServices", serviceRegistry.getHealthyServices());

        return metrics;
    }

    public void evictCache(String pattern) {
        serviceResponseCache.asMap().keySet().removeIf(key -> key.contains(pattern));
        log.info("缓存清理完成，模式: {}", pattern);
    }

    public void clearAllMetrics() {
        callCounter.clear();
        totalLatency.clear();
        log.info("调用指标已重置");
    }
}
