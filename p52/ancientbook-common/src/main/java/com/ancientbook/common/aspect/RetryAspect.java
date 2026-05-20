package com.ancientbook.common.aspect;

import com.ancientbook.common.annotation.Retryable;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Slf4j
@Aspect
@Component
public class RetryAspect {

    @Pointcut("@annotation(com.ancientbook.common.annotation.Retryable)")
    public void retryPointcut() {
    }

    @Around("retryPointcut()")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Retryable retryable = method.getAnnotation(Retryable.class);

        int maxAttempts = retryable.maxAttempts();
        long delay = retryable.delay();
        double multiplier = retryable.multiplier();
        Set<Class<? extends Throwable>> retryExceptions =
                new HashSet<>(Arrays.asList(retryable.retryOn()));

        int attempts = 0;
        long currentDelay = delay;
        Throwable lastException = null;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                Object result = joinPoint.proceed();
                if (attempts > 1) {
                    log.info("重试成功: 方法={}, 尝试次数={}", method.getName(), attempts);
                }
                return result;
            } catch (Throwable e) {
                lastException = e;
                boolean shouldRetry = retryExceptions.stream()
                        .anyMatch(ex -> ex.isInstance(e) || e.getClass().isAssignableFrom(ex));

                if (!shouldRetry || attempts >= maxAttempts) {
                    log.error("重试失败: 方法={}, 尝试次数={}, 异常={}",
                            method.getName(), attempts, e.getMessage());
                    break;
                }

                log.warn("调用失败，准备重试: 方法={}, 第{}次尝试, 下次延迟={}ms, 异常={}",
                        method.getName(), attempts, currentDelay, e.getMessage());

                Thread.sleep(currentDelay);
                currentDelay = (long) (currentDelay * multiplier);
            }
        }

        throw lastException != null ? lastException : new RuntimeException("调用失败");
    }
}
