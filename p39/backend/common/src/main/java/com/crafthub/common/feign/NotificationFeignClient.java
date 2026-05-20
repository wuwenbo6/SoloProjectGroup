package com.crafthub.common.feign;

import com.crafthub.common.dto.OrderProgressDTO;
import com.crafthub.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "notification-service", fallback = NotificationFeignClientFallback.class)
public interface NotificationFeignClient {

    @PostMapping("/notification/order-progress")
    Result<Void> pushOrderProgress(@RequestBody OrderProgressDTO dto);
}
