package com.ancient.book.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeoutException;

@Slf4j
@Component
public class TimeoutFilter implements GlobalFilter, Ordered {

    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(60);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        Duration timeout = getTimeoutForPath(path);

        return chain.filter(exchange)
                .timeout(timeout)
                .onErrorResume(TimeoutException.class, e -> {
                    log.error("请求超时: {}, 超时时间: {}s", path, timeout.getSeconds());
                    ServerHttpResponse response = exchange.getResponse();
                    response.setStatusCode(HttpStatus.GATEWAY_TIMEOUT);
                    response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                    String errorBody = String.format(
                            "{\"code\":504,\"message\":\"请求超时，超过%d秒\",\"success\":false}",
                            timeout.getSeconds());
                    DataBuffer buffer = response.bufferFactory()
                            .wrap(errorBody.getBytes(StandardCharsets.UTF_8));
                    return response.writeWith(Mono.just(buffer));
                })
                .onErrorResume(Exception.class, e -> {
                    log.error("网关异常: {}", path, e);
                    ServerHttpResponse response = exchange.getResponse();
                    response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                    response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                    String errorBody = String.format(
                            "{\"code\":502,\"message\":\"网关服务异常: %s\",\"success\":false}",
                            e.getMessage());
                    DataBuffer buffer = response.bufferFactory()
                            .wrap(errorBody.getBytes(StandardCharsets.UTF_8));
                    return response.writeWith(Mono.just(buffer));
                });
    }

    private Duration getTimeoutForPath(String path) {
        if (path.contains("/api/ai/")) {
            return Duration.ofSeconds(300);
        }
        if (path.contains("/upload") || path.contains("/image/")) {
            return Duration.ofSeconds(120);
        }
        return DEFAULT_TIMEOUT;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }
}
