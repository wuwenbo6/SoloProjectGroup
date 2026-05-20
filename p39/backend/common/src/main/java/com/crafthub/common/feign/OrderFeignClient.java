package com.crafthub.common.feign;

import com.crafthub.common.dto.OrderStatusUpdateDTO;
import com.crafthub.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient(name = "order-service", fallback = OrderFeignClientFallback.class)
public interface OrderFeignClient {

    @PutMapping("/order/{id}/status")
    Result<Void> updateOrderStatus(@PathVariable("id") Long id, @RequestParam("status") Integer status);

    @PostMapping("/order/status")
    Result<Void> updateOrderStatusByDTO(@RequestBody OrderStatusUpdateDTO dto);

    @GetMapping("/order/{id}")
    Result<?> getOrderById(@PathVariable("id") Long id);

    @PutMapping("/order/{id}/progress")
    Result<Void> updateProgress(@PathVariable("id") Long id,
                                @RequestParam("progress") Integer progress,
                                @RequestParam(value = "progressDesc", required = false) String progressDesc);
}
