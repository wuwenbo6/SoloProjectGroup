package com.ancientbook.common.loadbalancer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Configuration
public class LoadBalancerConfig {

    private static final List<ServerNode> SERVER_POOL = new ArrayList<>();
    private static final AtomicInteger ROUND_ROBIN_COUNTER = new AtomicInteger(0);
    private static final AtomicLong LEAST_CONN_COUNTER = new AtomicLong(0);

    @PostConstruct
    public void initServerPool() {
        SERVER_POOL.add(new ServerNode("server-1", "192.168.1.101", 8080, 100, "healthy"));
        SERVER_POOL.add(new ServerNode("server-2", "192.168.1.102", 8080, 100, "healthy"));
        SERVER_POOL.add(new ServerNode("server-3", "192.168.1.103", 8080, 100, "healthy"));
        SERVER_POOL.add(new ServerNode("server-4", "192.168.1.104", 8080, 50, "degraded"));
        SERVER_POOL.add(new ServerNode("server-5", "192.168.1.105", 8080, 200, "healthy"));
        log.info("负载均衡服务器池初始化完成，共{}台服务器", SERVER_POOL.size());
    }

    @Bean
    public LoadBalancer roundRobinLoadBalancer() {
        return new LoadBalancer() {
            @Override
            public ServerNode selectServer(Request request) {
                List<ServerNode> healthyServers = getHealthyServers();
                if (healthyServers.isEmpty()) {
                    throw new RuntimeException("无可用服务器");
                }
                int index = Math.abs(ROUND_ROBIN_COUNTER.incrementAndGet() % healthyServers.size());
                ServerNode selected = healthyServers.get(index);
                selected.incrementActiveConnections();
                log.debug("轮询负载均衡选择: server={}, index={}", selected.getServerId(), index);
                return selected;
            }

            @Override
            public String getStrategyName() {
                return "ROUND_ROBIN";
            }
        };
    }

    @Bean
    public LoadBalancer leastConnectionsLoadBalancer() {
        return new LoadBalancer() {
            @Override
            public ServerNode selectServer(Request request) {
                List<ServerNode> healthyServers = getHealthyServers();
                if (healthyServers.isEmpty()) {
                    throw new RuntimeException("无可用服务器");
                }

                ServerNode leastConnServer = healthyServers.get(0);
                for (ServerNode server : healthyServers) {
                    if (server.getActiveConnections() < leastConnServer.getActiveConnections()) {
                        leastConnServer = server;
                    }
                }
                leastConnServer.incrementActiveConnections();
                log.debug("最少连接负载均衡选择: server={}, connections={}",
                        leastConnServer.getServerId(), leastConnServer.getActiveConnections());
                return leastConnServer;
            }

            @Override
            public String getStrategyName() {
                return "LEAST_CONNECTIONS";
            }
        };
    }

    @Bean
    public LoadBalancer ipHashLoadBalancer() {
        return new LoadBalancer() {
            @Override
            public ServerNode selectServer(Request request) {
                List<ServerNode> healthyServers = getHealthyServers();
                if (healthyServers.isEmpty()) {
                    throw new RuntimeException("无可用服务器");
                }

                String clientIp = request.getClientIp();
                int hash = Math.abs(clientIp.hashCode());
                int index = hash % healthyServers.size();
                ServerNode selected = healthyServers.get(index);
                selected.incrementActiveConnections();
                log.debug("IP哈希负载均衡选择: ip={}, server={}, index={}", clientIp, selected.getServerId(), index);
                return selected;
            }

            @Override
            public String getStrategyName() {
                return "IP_HASH";
            }
        };
    }

    @Bean
    public LoadBalancer weightedLeastConnectionsLoadBalancer() {
        return new LoadBalancer() {
            @Override
            public ServerNode selectServer(Request request) {
                List<ServerNode> healthyServers = getHealthyServers();
                if (healthyServers.isEmpty()) {
                    throw new RuntimeException("无可用服务器");
                }

                ServerNode bestServer = null;
                double bestWeightedConn = Double.MAX_VALUE;

                for (ServerNode server : healthyServers) {
                    double weightedConnections = (double) server.getActiveConnections() / server.getWeight();
                    if (weightedConnections < bestWeightedConn) {
                        bestWeightedConn = weightedConnections;
                        bestServer = server;
                    }
                }

                if (bestServer != null) {
                    bestServer.incrementActiveConnections();
                    log.debug("加权最少连接负载均衡选择: server={}, weightedConns={}",
                            bestServer.getServerId(), bestWeightedConn);
                }
                return bestServer;
            }

            @Override
            public String getStrategyName() {
                return "WEIGHTED_LEAST_CONNECTIONS";
            }
        };
    }

    public static List<ServerNode> getHealthyServers() {
        return SERVER_POOL.stream()
                .filter(s -> "healthy".equals(s.getStatus()))
                .toList();
    }

    public static List<ServerNode> getAllServers() {
        return new ArrayList<>(SERVER_POOL);
    }

    public static void updateServerStatus(String serverId, String status) {
        SERVER_POOL.stream()
                .filter(s -> s.getServerId().equals(serverId))
                .findFirst()
                .ifPresent(s -> s.setStatus(status));
    }
}
