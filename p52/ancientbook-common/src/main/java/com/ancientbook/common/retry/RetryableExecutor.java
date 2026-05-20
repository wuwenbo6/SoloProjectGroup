package com.ancientbook.common.retry;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Predicate;
import java.util.function.Supplier;

@Slf4j
@Component
public class RetryableExecutor {

    private final Map<String, CircuitBreaker> circuitBreakers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService recoveryExecutor = Executors.newScheduledThreadPool(2);
    private final ThreadLocal<RetryContext> retryContextHolder = new ThreadLocal<>();

    @PostConstruct
    public void init() {
        recoveryExecutor.scheduleAtFixedRate(this::checkAndRecoverCircuits, 30, 30, TimeUnit.SECONDS);
        log.info("可重试执行器初始化完成");
    }

    public <T> T executeWithRetry(Supplier<T> supplier, String operationName) {
        return executeWithRetry(supplier, operationName, defaultRetryStrategy());
    }

    public <T> T executeWithRetry(Supplier<T> supplier, String operationName, RetryStrategy strategy) {
        CircuitBreaker breaker = circuitBreakers.computeIfAbsent(operationName, k -> new CircuitBreaker(operationName));

        if (!breaker.allowRequest()) {
            throw new CircuitBreakerOpenException("熔断器已开启: " + operationName);
        }

        RetryContext context = new RetryContext();
        context.setOperationName(operationName);
        context.setMaxRetries(strategy.maxRetries);
        retryContextHolder.set(context);

        int attempts = 0;
        long startTime = System.currentTimeMillis();

        while (true) {
            try {
                T result = supplier.get();

                context.setSuccess(true);
                context.setTotalTimeMs(System.currentTimeMillis() - startTime);

                breaker.recordSuccess();
                log.debug("操作成功: {}, 尝试次数: {}, 耗时: {}ms",
                        operationName, attempts + 1, context.getTotalTimeMs());

                return result;

            } catch (Exception e) {
                attempts++;
                context.setLastException(e);
                context.setAttempts(attempts);

                if (strategy.retryPredicate.test(e) && attempts <= strategy.maxRetries) {
                    long delay = strategy.backoffFunction.apply(attempts);
                    log.warn("操作失败，准备重试: {}, 第 {} 次重试, 延迟: {}ms, 异常: {}",
                            operationName, attempts, delay, e.getMessage());

                    breaker.recordFailure();

                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("重试被中断", ie);
                    }
                } else {
                    context.setTotalTimeMs(System.currentTimeMillis() - startTime);
                    breaker.recordFailure();

                    log.error("操作最终失败: {}, 总尝试次数: {}, 耗时: {}ms, 最后异常: {}",
                            operationName, attempts, context.getTotalTimeMs(), e.getMessage(), e);

                    throw new RetryExhaustedException("重试次数耗尽: " + operationName, e);
                }
            }
        }
    }

    public void executeWithRetryAsync(Runnable runnable, String operationName) {
        CompletableFuture.runAsync(() -> executeWithRetry(() -> {
            runnable.run();
            return null;
        }, operationName));
    }

    public void executeWithRecovery(Runnable mainTask, Runnable fallbackTask, String operationName) {
        try {
            executeWithRetry(() -> {
                mainTask.run();
                return null;
            }, operationName);
        } catch (Exception e) {
            log.warn("主任务失败，执行降级任务: {}", operationName);
            fallbackTask.run();
        }
    }

    private RetryStrategy defaultRetryStrategy() {
        return RetryStrategy.builder()
                .maxRetries(3)
                .initialDelay(100)
                .maxDelay(5000)
                .backoffStrategy(BackoffStrategy.EXPONENTIAL)
                .retryPredicate(e -> true)
                .build();
    }

    private void checkAndRecoverCircuits() {
        for (CircuitBreaker breaker : circuitBreakers.values()) {
            if (breaker.tryRecovery()) {
                log.info("熔断器尝试恢复: {}", breaker.getOperationName());
            }
        }
    }

    public Map<String, CircuitBreakerStats> getCircuitBreakerStats() {
        Map<String, CircuitBreakerStats> stats = new LinkedHashMap<>();
        for (Map.Entry<String, CircuitBreaker> entry : circuitBreakers.entrySet()) {
            CircuitBreaker breaker = entry.getValue();
            stats.put(entry.getKey(), new CircuitBreakerStats(
                    breaker.getOperationName(),
                    breaker.getState().name(),
                    breaker.getSuccessCount().get(),
                    breaker.getFailureCount().get(),
                    breaker.getTotalRequests().get(),
                    breaker.getFailureRate()
            ));
        }
        return stats;
    }

    public void resetCircuitBreaker(String operationName) {
        CircuitBreaker breaker = circuitBreakers.get(operationName);
        if (breaker != null) {
            breaker.reset();
            log.info("熔断器已重置: {}", operationName);
        }
    }

    public static class RetryStrategy {
        private final int maxRetries;
        private final long initialDelay;
        private final long maxDelay;
        private final BackoffStrategy backoffStrategy;
        private final Predicate<Exception> retryPredicate;
        private final Function<Integer, Long> backoffFunction;

        private RetryStrategy(Builder builder) {
            this.maxRetries = builder.maxRetries;
            this.initialDelay = builder.initialDelay;
            this.maxDelay = builder.maxDelay;
            this.backoffStrategy = builder.backoffStrategy;
            this.retryPredicate = builder.retryPredicate;
            this.backoffFunction = createBackoffFunction();
        }

        private Function<Integer, Long> createBackoffFunction() {
            return switch (backoffStrategy) {
                case FIXED -> attempt -> initialDelay;
                case LINEAR -> attempt -> Math.min(initialDelay * attempt, maxDelay);
                case EXPONENTIAL -> attempt -> Math.min(initialDelay * (long) Math.pow(2, attempt - 1), maxDelay);
                case RANDOM -> attempt -> initialDelay + ThreadLocalRandom.current().nextLong(initialDelay);
            };
        }

        public static Builder builder() {
            return new Builder();
        }

        public static class Builder {
            private int maxRetries = 3;
            private long initialDelay = 100;
            private long maxDelay = 5000;
            private BackoffStrategy backoffStrategy = BackoffStrategy.EXPONENTIAL;
            private Predicate<Exception> retryPredicate = e -> true;

            public Builder maxRetries(int maxRetries) {
                this.maxRetries = maxRetries;
                return this;
            }

            public Builder initialDelay(long initialDelay) {
                this.initialDelay = initialDelay;
                return this;
            }

            public Builder maxDelay(long maxDelay) {
                this.maxDelay = maxDelay;
                return this;
            }

            public Builder backoffStrategy(BackoffStrategy strategy) {
                this.backoffStrategy = strategy;
                return this;
            }

            public Builder retryOn(Predicate<Exception> predicate) {
                this.retryPredicate = predicate;
                return this;
            }

            public RetryStrategy build() {
                return new RetryStrategy(this);
            }
        }
    }

    public enum BackoffStrategy {
        FIXED,
        LINEAR,
        EXPONENTIAL,
        RANDOM
    }

    public enum CircuitState {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    public static class CircuitBreaker {
        private final String operationName;
        private volatile CircuitState state = CircuitState.CLOSED;
        private final AtomicInteger successCount = new AtomicInteger(0);
        private final AtomicInteger failureCount = new AtomicInteger(0);
        private final AtomicLong totalRequests = new AtomicLong(0);
        private volatile long lastFailureTime = 0;
        private final int failureThreshold = 10;
        private final double failureRateThreshold = 0.5;
        private final long recoveryTimeout = 30000;

        public CircuitBreaker(String operationName) {
            this.operationName = operationName;
        }

        public synchronized boolean allowRequest() {
            totalRequests.incrementAndGet();

            if (state == CircuitState.CLOSED) {
                return true;
            }

            if (state == CircuitState.OPEN) {
                if (System.currentTimeMillis() - lastFailureTime > recoveryTimeout) {
                    state = CircuitState.HALF_OPEN;
                    log.info("熔断器进入半开状态: {}", operationName);
                    return true;
                }
                return false;
            }

            return true;
        }

        public void recordSuccess() {
            successCount.incrementAndGet();
            if (state == CircuitState.HALF_OPEN) {
                synchronized (this) {
                    if (state == CircuitState.HALF_OPEN) {
                        state = CircuitState.CLOSED;
                        resetCounters();
                        log.info("熔断器恢复关闭状态: {}", operationName);
                    }
                }
            }
        }

        public void recordFailure() {
            int failures = failureCount.incrementAndGet();
            lastFailureTime = System.currentTimeMillis();

            if (state == CircuitState.HALF_OPEN) {
                synchronized (this) {
                    if (state == CircuitState.HALF_OPEN) {
                        state = CircuitState.OPEN;
                        log.warn("半开状态下失败，熔断器重新打开: {}", operationName);
                    }
                }
            } else if (state == CircuitState.CLOSED && failures >= failureThreshold) {
                double rate = getFailureRate();
                if (rate >= failureRateThreshold) {
                    synchronized (this) {
                        if (state == CircuitState.CLOSED) {
                            state = CircuitState.OPEN;
                            log.warn("熔断器打开: {}, 失败率: {:.2f}%", operationName, rate * 100);
                        }
                    }
                }
            }
        }

        public synchronized boolean tryRecovery() {
            if (state == CircuitState.OPEN &&
                    System.currentTimeMillis() - lastFailureTime > recoveryTimeout) {
                state = CircuitState.HALF_OPEN;
                return true;
            }
            return false;
        }

        public synchronized void reset() {
            state = CircuitState.CLOSED;
            resetCounters();
        }

        private void resetCounters() {
            successCount.set(0);
            failureCount.set(0);
            totalRequests.set(0);
        }

        public double getFailureRate() {
            long total = totalRequests.get();
            if (total == 0) return 0;
            return (double) failureCount.get() / total;
        }

        public String getOperationName() { return operationName; }
        public CircuitState getState() { return state; }
        public AtomicInteger getSuccessCount() { return successCount; }
        public AtomicInteger getFailureCount() { return failureCount; }
        public AtomicLong getTotalRequests() { return totalRequests; }
    }

    public static class RetryContext {
        private String operationName;
        private int attempts;
        private int maxRetries;
        private Exception lastException;
        private boolean success;
        private long totalTimeMs;

        public String getOperationName() { return operationName; }
        public void setOperationName(String operationName) { this.operationName = operationName; }
        public int getAttempts() { return attempts; }
        public void setAttempts(int attempts) { this.attempts = attempts; }
        public int getMaxRetries() { return maxRetries; }
        public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }
        public Exception getLastException() { return lastException; }
        public void setLastException(Exception lastException) { this.lastException = lastException; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public long getTotalTimeMs() { return totalTimeMs; }
        public void setTotalTimeMs(long totalTimeMs) { this.totalTimeMs = totalTimeMs; }
    }

    public record CircuitBreakerStats(
            String operationName,
            String state,
            long successCount,
            long failureCount,
            long totalRequests,
            double failureRate
    ) {}

    public static class RetryExhaustedException extends RuntimeException {
        public RetryExhaustedException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static class CircuitBreakerOpenException extends RuntimeException {
        public CircuitBreakerOpenException(String message) {
            super(message);
        }
    }

    @FunctionalInterface
    public interface Function<T, R> {
        R apply(T t);
    }
}
