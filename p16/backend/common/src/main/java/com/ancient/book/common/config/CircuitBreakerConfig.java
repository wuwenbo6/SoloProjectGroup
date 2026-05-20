package com.ancient.book.common.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Configuration
public class CircuitBreakerConfig {

    private final Map<String, CircuitBreaker> circuitBreakers = new ConcurrentHashMap<>();
    private final Map<String, RateLimiter> rateLimiters = new ConcurrentHashMap<>();

    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        io.github.resilience4j.circuitbreaker.CircuitBreakerConfig config =
                io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.custom()
                        .failureRateThreshold(50)
                        .slowCallRateThreshold(50)
                        .slowCallDurationThreshold(Duration.ofSeconds(5))
                        .permittedNumberOfCallsInHalfOpenState(3)
                        .maxWaitDurationInHalfOpenState(Duration.ofSeconds(10))
                        .slidingWindowSize(100)
                        .minimumNumberOfCalls(20)
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .automaticTransitionFromOpenToHalfOpenEnabled(true)
                        .build();

        log.info("熔断器配置完成: 失败率阈值=50%, 慢调用阈值=5秒, 半开放允许调用数=3");
        return CircuitBreakerRegistry.of(config);
    }

    @Bean
    public RateLimiterRegistry rateLimiterRegistry() {
        io.github.resilience4j.ratelimiter.RateLimiterConfig config =
                io.github.resilience4j.ratelimiter.RateLimiterConfig.custom()
                        .limitForPeriod(1000)
                        .limitRefreshPeriod(Duration.ofSeconds(1))
                        .timeoutDuration(Duration.ofMillis(500))
                        .build();

        log.info("限流器配置完成: 速率限制=1000次/秒, 超时=500ms");
        return RateLimiterRegistry.of(config);
    }

    @PostConstruct
    public void initCircuitBreakers() {
        String[] services = {
                "image-parser-service",
                "text-segmentation-service",
                "semantic-matching-service",
                "database-service",
                "ai-inference-service"
        };

        for (String service : services) {
            CircuitBreaker cb = circuitBreakerRegistry().circuitBreaker(service);
            circuitBreakers.put(service, cb);

            cb.getEventPublisher()
                    .onStateTransition(event -> {
                        log.warn("熔断器状态变化: {} - {} -> {}",
                                service,
                                event.getStateTransition().getFromState(),
                                event.getStateTransition().getToState());
                    })
                    .onError(event -> {
                        log.debug("熔断器错误事件: {} - {}", service, event.getThrowable().getMessage());
                    });

            RateLimiter rl = rateLimiterRegistry().rateLimiter(service);
            rateLimiters.put(service, rl);
        }

        log.info("熔断器初始化完成: 共 {} 个服务熔断器", circuitBreakers.size());
    }

    public CircuitBreaker getCircuitBreaker(String serviceName) {
        return circuitBreakers.get(serviceName);
    }

    public RateLimiter getRateLimiter(String serviceName) {
        return rateLimiters.get(serviceName);
    }

    public Map<String, CircuitBreaker.State> getAllCircuitBreakerStates() {
        Map<String, CircuitBreaker.State> states = new ConcurrentHashMap<>();
        circuitBreakers.forEach((name, cb) -> {
            states.put(name, cb.getState());
        });
        return states;
    }

    public void resetCircuitBreaker(String serviceName) {
        CircuitBreaker cb = circuitBreakers.get(serviceName);
        if (cb != null) {
            cb.reset();
            log.info("熔断器重置: {}", serviceName);
        }
    }
}
