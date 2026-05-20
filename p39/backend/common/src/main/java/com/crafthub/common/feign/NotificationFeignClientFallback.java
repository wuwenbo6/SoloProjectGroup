package com.crafthub.common.feign;

import com.crafthub.common.dto.OrderProgressDTO;
import com.crafthub.common.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class NotificationFeignClientFallback implements NotificationFeignClient {

    @Override
    public Result<Void> pushOrderProgress(OrderProgressDTO dto) {
        log.error("通知服务熔断 - 推送订单进度失败, orderId: {}", dto.getOrderId());
        return Result.error("通知服务暂时不可用");
    }
}
