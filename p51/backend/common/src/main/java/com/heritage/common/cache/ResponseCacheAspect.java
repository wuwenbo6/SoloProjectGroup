package com.heritage.common.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

@Aspect
@Component
public class ResponseCacheAspect {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String CACHE_PREFIX = "heritage:api:";

    @Around("@annotation(com.heritage.common.cache.ResponseCache)")
    public Object cacheResponse(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        ResponseCache cacheAnnotation = method.getAnnotation(ResponseCache.class);

        String cacheKey = generateCacheKey(joinPoint, cacheAnnotation);

        Object cachedResult = redisTemplate.opsForValue().get(cacheKey);
        if (cachedResult != null) {
            return cachedResult;
        }

        Object result = joinPoint.proceed();

        if (result != null) {
            redisTemplate.opsForValue().set(
                cacheKey,
                result,
                cacheAnnotation.ttl(),
                cacheAnnotation.timeUnit()
            );
        }

        return result;
    }

    @Around("@annotation(com.heritage.common.cache.CacheEvict)")
    public Object evictCache(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        CacheEvict evictAnnotation = method.getAnnotation(CacheEvict.class);

        Object result = joinPoint.proceed();

        if (evictAnnotation.allEntries()) {
            redisTemplate.delete(redisTemplate.keys(CACHE_PREFIX + "*"));
        } else {
            String cacheKey = generateCacheKey(joinPoint, null);
            redisTemplate.delete(cacheKey);
        }

        return result;
    }

    private String generateCacheKey(ProceedingJoinPoint joinPoint, ResponseCache annotation) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String methodName = signature.getDeclaringTypeName() + "." + signature.getName();
        
        String params = Arrays.toString(joinPoint.getArgs());
        
        if (annotation != null && !annotation.key().isEmpty()) {
            return CACHE_PREFIX + annotation.key() + ":" + params.hashCode();
        }
        
        return CACHE_PREFIX + methodName + ":" + params.hashCode();
    }
}