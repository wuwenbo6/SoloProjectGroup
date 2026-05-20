package com.ancientbook.common.loadbalancer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/loadbalancer")
@RequiredArgsConstructor
public class LoadBalancerController {

    private final Map<String, LoadBalancer> loadBalancerMap;

    @GetMapping("/servers")
    public Map<String, Object> getAllServers() {
        List<ServerNode> servers = LoadBalancerConfig.getAllServers();
        List<Map<String, Object>> serverStats = new ArrayList<>();

        for (ServerNode server : servers) {
            Map<String, Object> stat = new LinkedHashMap<>();
            stat.put("serverId", server.getServerId());
            stat.put("ip", server.getIp());
            stat.put("port", server.getPort());
            stat.put("weight", server.getWeight());
            stat.put("status", server.getStatus());
            stat.put("activeConnections", server.getActiveConnections());
            stat.put("totalRequests", server.getTotalRequests());
            stat.put("avgResponseTimeMs", String.format("%.2f", server.getAvgResponseTime()));
            stat.put("errorRate", String.format("%.2f%%", server.getErrorRate()));
            serverStats.add(stat);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("servers", serverStats);
        result.put("totalServers", servers.size());
        result.put("healthyServers", LoadBalancerConfig.getHealthyServers().size());
        return result;
    }

    @GetMapping("/strategies")
    public List<String> getStrategies() {
        return List.of("ROUND_ROBIN", "LEAST_CONNECTIONS", "IP_HASH", "WEIGHTED_LEAST_CONNECTIONS");
    }

    @PostMapping("/select")
    public Map<String, Object> selectServer(
            @RequestParam(defaultValue = "ROUND_ROBIN") String strategy,
            @RequestParam String clientIp,
            @RequestParam(defaultValue = "/api/test") String apiPath) {

        LoadBalancer loadBalancer = loadBalancerMap.get(strategy.toLowerCase() + "LoadBalancer");
        if (loadBalancer == null) {
            loadBalancer = loadBalancerMap.get("roundRobinLoadBalancer");
        }

        Request request = new Request();
        request.setRequestId(UUID.randomUUID().toString());
        request.setClientIp(clientIp);
        request.setApiPath(apiPath);
        request.setRequestTime(System.currentTimeMillis());

        ServerNode selected = loadBalancer.selectServer(request);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("strategy", loadBalancer.getStrategyName());
        result.put("selectedServer", selected.getServerId());
        result.put("serverIp", selected.getIp());
        result.put("serverPort", selected.getPort());
        result.put("activeConnections", selected.getActiveConnections());
        return result;
    }

    @PostMapping("/server/{serverId}/status")
    public Map<String, Object> updateServerStatus(
            @PathVariable String serverId,
            @RequestParam String status) {

        LoadBalancerConfig.updateServerStatus(serverId, status);
        log.info("更新服务器状态: serverId={}, status={}", serverId, status);

        return Map.of(
                "success", true,
                "serverId", serverId,
                "newStatus", status
        );
    }

    @GetMapping("/statistics")
    public Map<String, Object> getStatistics() {
        List<ServerNode> servers = LoadBalancerConfig.getAllServers();
        long totalRequests = servers.stream().mapToLong(s -> s.getTotalRequests().get()).sum();
        long totalErrors = servers.stream().mapToLong(s -> s.getErrorCount().get()).sum();
        double avgResponseTime = servers.stream().mapToDouble(ServerNode::getAvgResponseTime).average().orElse(0);
        int totalActiveConnections = servers.stream().mapToInt(s -> s.getActiveConnections().get()).sum();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalServers", servers.size());
        stats.put("healthyServers", LoadBalancerConfig.getHealthyServers().size());
        stats.put("totalRequests", totalRequests);
        stats.put("totalErrors", totalErrors);
        stats.put("totalActiveConnections", totalActiveConnections);
        stats.put("avgResponseTimeMs", String.format("%.2f", avgResponseTime));
        stats.put("overallErrorRate", totalRequests > 0 ? String.format("%.2f%%", (double) totalErrors / totalRequests * 100) : "0.00%");
        return stats;
    }
}
