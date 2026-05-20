package com.ancient.book.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ServiceHealthCheckFilter extends AbstractGatewayFilterFactory<ServiceHealthCheckFilter.Config> {

    private final WebClient webClient = WebClient.create();
    private final Map<String, Boolean> serviceHealthCache = new ConcurrentHashMap<>();
    private final Map<String, Long> lastCheckTime = new ConcurrentHashMap<>();
    private static final long CHECK_INTERVAL_MS = 30000;

    public ServiceHealthCheckFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            String serviceName = config.getServiceName();
            String healthUrl = config.getHealthUrl();

            if (isServiceUnhealthy(serviceName, healthUrl)) {
                log.warn("服务不可用，拒绝请求: {}, URL: {}", serviceName, healthUrl);
                exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
                exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
                String errorBody = String.format(
                        "{\"code\":503,\"message\":\"服务暂时不可用: %s\",\"success\":false}",
                        serviceName);
                DataBuffer buffer = exchange.getResponse().bufferFactory()
                        .wrap(errorBody.getBytes(StandardCharsets.UTF_8));
                return exchange.getResponse().writeWith(Mono.just(buffer));
            }

            return chain.filter(exchange);
        };
    }

    private boolean isServiceUnhealthy(String serviceName, String healthUrl) {
        long now = System.currentTimeMillis();
        Long lastCheck = lastCheckTime.get(serviceName);

        if (lastCheck != null && now - lastCheck < CHECK_INTERVAL_MS) {
            return serviceHealthCache.getOrDefault(serviceName, false);
        }

        try {
            Boolean isHealthy = webClient.get()
                    .uri(healthUrl)
                    .retrieve()
                    .bodyToMono(String.class)
                    .map(response -> true)
                    .onErrorResume(e -> {
                        log.error("服务健康检查失败: {}, URL: {}", serviceName, healthUrl, e);
                        return Mono.just(false);
                    })
                    .block();

            serviceHealthCache.put(serviceName, !isHealthy);
            lastCheckTime.put(serviceName, now);

            return !isHealthy;
        } catch (Exception e) {
            log.error("服务健康检查异常: {}, URL: {}", serviceName, healthUrl, e);
            serviceHealthCache.put(serviceName, true);
            lastCheckTime.put(serviceName, now);
            return true;
        }
    }

    public static class Config {
        private String serviceName;
        private String healthUrl;

        public String getServiceName() {
            return serviceName;
        }

        public void setServiceName(String serviceName) {
            this.serviceName = serviceName;
        }

        public String getHealthUrl() {
            return healthUrl;
        }

        public void setHealthUrl(String healthUrl) {
            this.healthUrl = healthUrl;
        }
    }
}
