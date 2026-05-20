package com.ancientbook.common.loadbalancer;

public interface LoadBalancer {

    ServerNode selectServer(Request request);

    String getStrategyName();
}
