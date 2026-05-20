package com.ancient.book.common.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "service.registry")
public class ServiceRegistryConfig {

    private Map<String, ServiceInstance> instances = new ConcurrentHashMap<>();
    private int healthCheckIntervalSeconds = 30;
    private int connectionTimeoutMs = 5000;
    private int readTimeoutMs = 30000;
    private int maxConnections = 100;
    private int maxConnectionsPerRoute = 20;

    @Data
    public static class ServiceInstance {
        private String name;
        private String host = "localhost";
        private int port;
        private String contextPath = "";
        private boolean enabled = true;
        private int weight = 100;
        private String status = "HEALTHY";
        private long lastHealthCheckTime;
        private int failureCount = 0;
        private int maxFailures = 3;
    }

    @PostConstruct
    public void init() {
        log.info("初始化服务注册中心配置...");

        registerDefaultInstance("gateway-service", "localhost", 8080);
        registerDefaultInstance("image-parser-service", "localhost", 8081);
        registerDefaultInstance("text-segmentation-service", "localhost", 8082);
        registerDefaultInstance("semantic-matching-service", "localhost", 8083);
        registerDefaultInstance("database-service", "localhost", 8084);

        log.info("服务注册中心初始化完成，共注册 {} 个服务", instances.size());
    }

    private void registerDefaultInstance(String name, String host, int port) {
        ServiceInstance instance = new ServiceInstance();
        instance.setName(name);
        instance.setHost(host);
        instance.setPort(port);
        instance.setContextPath("");
        instances.put(name, instance);
    }

    public String getServiceUrl(String serviceName) {
        ServiceInstance instance = instances.get(serviceName);
        if (instance == null || !instance.isEnabled() || !"HEALTHY".equals(instance.getStatus())) {
            return null;
        }
        return "http://" + instance.getHost() + ":" + instance.getPort() + instance.getContextPath();
    }

    public void markServiceUnhealthy(String serviceName) {
        ServiceInstance instance = instances.get(serviceName);
        if (instance != null) {
            instance.setFailureCount(instance.getFailureCount() + 1);
            if (instance.getFailureCount() >= instance.getMaxFailures()) {
                instance.setStatus("UNHEALTHY");
                log.warn("服务 {} 标记为不健康，失败次数: {}", serviceName, instance.getFailureCount());
            }
        }
    }

    public void markServiceHealthy(String serviceName) {
        ServiceInstance instance = instances.get(serviceName);
        if (instance != null) {
            instance.setStatus("HEALTHY");
            instance.setFailureCount(0);
        }
    }

    public List<String> getHealthyServices() {
        List<String> healthy = new ArrayList<>();
        for (Map.Entry<String, ServiceInstance> entry : instances.entrySet()) {
            if ("HEALTHY".equals(entry.getValue().getStatus()) && entry.getValue().isEnabled()) {
                healthy.add(entry.getKey());
            }
        }
        return healthy;
    }
}
