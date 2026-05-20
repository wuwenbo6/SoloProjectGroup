package com.ancientbook.common.loadbalancer;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Data
@AllArgsConstructor
public class ServerNode {

    private String serverId;
    private String ip;
    private int port;
    private int weight;
    private String status;
    private AtomicInteger activeConnections = new AtomicInteger(0);
    private AtomicLong totalRequests = new AtomicLong(0);
    private AtomicLong totalResponseTime = new AtomicLong(0);
    private AtomicLong errorCount = new AtomicLong(0);

    public ServerNode(String serverId, String ip, int port, int weight, String status) {
        this.serverId = serverId;
        this.ip = ip;
        this.port = port;
        this.weight = weight;
        this.status = status;
    }

    public void incrementActiveConnections() {
        activeConnections.incrementAndGet();
        totalRequests.incrementAndGet();
    }

    public void decrementActiveConnections() {
        activeConnections.decrementAndGet();
    }

    public void recordResponseTime(long responseTimeMs) {
        totalResponseTime.addAndGet(responseTimeMs);
    }

    public void incrementErrorCount() {
        errorCount.incrementAndGet();
    }

    public double getAvgResponseTime() {
        long requests = totalRequests.get();
        if (requests == 0) return 0;
        return (double) totalResponseTime.get() / requests;
    }

    public double getErrorRate() {
        long requests = totalRequests.get();
        if (requests == 0) return 0;
        return (double) errorCount.get() / requests * 100;
    }
}
