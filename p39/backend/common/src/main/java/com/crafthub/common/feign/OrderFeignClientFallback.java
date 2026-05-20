package com.crafthub.common.feign;

import com.crafthub.common.dto.OrderStatusUpdateDTO;
import com.crafthub.common.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OrderFeignClientFallback implements OrderFeignClient {

    @Override
    public Result<Void> updateOrderStatus(Long id, Integer status) {
        log.error("订单服务熔断 - 更新订单状态失败, orderId: {}, status: {}", id, status);
        return Result.error("订单服务暂时不可用，请稍后重试");
    }

    @Override
    public Result<Void> updateOrderStatusByDTO(OrderStatusUpdateDTO dto) {
        log.error("订单服务熔断 - 更新订单状态失败, orderId: {}", dto.getOrderId());
        return Result.error("订单服务暂时不可用，请稍后重试");
    }

    @Override
    public Result<?> getOrderById(Long id) {
        log.error("订单服务熔断 - 获取订单详情失败, orderId: {}", id);
        return Result.error("订单服务暂时不可用，请稍后重试");
    }

    @Override
    public Result<Void> updateProgress(Long id, Integer progress, String progressDesc) {
        log.error("订单服务熔断 - 更新订单进度失败, orderId: {}", id);
        return Result.error("订单服务暂时不可用，请稍后重试");
    }
}
