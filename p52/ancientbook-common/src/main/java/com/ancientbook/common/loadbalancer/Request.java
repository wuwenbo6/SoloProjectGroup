package com.ancientbook.common.loadbalancer;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Request {

    private String requestId;
    private String clientIp;
    private String apiPath;
    private String method;
    private Map<String, String> headers;
    private long requestTime;
}
