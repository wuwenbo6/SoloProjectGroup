package com.folk.activity.payment.aspect;

import com.folk.activity.payment.annotation.Idempotent;
import com.folk.activity.common.core.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.concurrent.TimeUnit;

@Aspect
@Component
public class IdempotentAspect {

    private final RedisTemplate<String, Object> redisTemplate;

    public IdempotentAspect(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Around("@annotation(com.folk.activity.payment.annotation.Idempotent)")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Idempotent idempotent = method.getAnnotation(Idempotent.class);

        String key = generateKey(joinPoint);
        
        Boolean isAbsent = redisTemplate.opsForValue().setIfAbsent(key, "processing", idempotent.expireTime(), TimeUnit.SECONDS);
        
        if (Boolean.FALSE.equals(isAbsent)) {
            return Result.fail(409, "请求正在处理中，请稍后重试");
        }
        
        try {
            return joinPoint.proceed();
        } catch (Exception e) {
            redisTemplate.delete(key);
            throw e;
        }
    }

    private String generateKey(ProceedingJoinPoint joinPoint) {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes != null ? attributes.getRequest() : null;
        
        StringBuilder keyBuilder = new StringBuilder("idempotent:payment:");
        
        if (request != null) {
            String userId = request.getHeader("X-User-Id");
            if (userId != null) {
                keyBuilder.append(userId).append(":");
            }
        }
        
        Object[] args = joinPoint.getArgs();
        for (Object arg : args) {
            if (arg instanceof String) {
                keyBuilder.append(arg).append(":");
            }
        }
        
        return keyBuilder.toString();
    }
}
