package com.heritage.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Configuration
public class GatewayConfig {

    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> Mono.just(
            exchange.getRequest().getRemoteAddress() != null ?
            exchange.getRequest().getRemoteAddress().getAddress().getHostAddress() :
            "anonymous"
        );
    }

    @Bean
    public RedisRateLimiter redisRateLimiter() {
        return new RedisRateLimiter(100, 200);
    }

    @Bean
    public org.springframework.cloud.gateway.filter.GlobalFilter globalCacheFilter() {
        return (exchange, chain) -> {
            ServerWebExchange newExchange = exchange.mutate()
                .response(exchange.getResponse())
                .build();
            
            return chain.filter(newExchange);
        };
    }
}

@Configuration
class RedisCacheConfig {
    
    @Bean
    public org.springframework.data.redis.cache.RedisCacheConfiguration cacheConfiguration() {
        return org.springframework.data.redis.cache.RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(1))
            .serializeKeysWith(org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair.fromSerializer(
                new org.springframework.data.redis.serializer.StringRedisSerializer()
            ))
            .serializeValuesWith(org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair.fromSerializer(
                new org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer()
            ))
            .disableCachingNullValues();
    }
}