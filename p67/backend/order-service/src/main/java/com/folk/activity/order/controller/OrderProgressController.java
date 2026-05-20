package com.folk.activity.order.controller;

import com.folk.activity.common.core.result.Result;
import com.folk.activity.order.service.OrderProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/order/progress")
@RequiredArgsConstructor
public class OrderProgressController {
    private final OrderProgressService orderProgressService;

    @GetMapping("/{orderNo}")
    public Result<List<Map<String, Object>>> getOrderProgress(@PathVariable String orderNo) {
        return Result.success(orderProgressService.getOrderProgressTimeline(orderNo));
    }

    @PostMapping("/update/{orderNo}")
    public Result<Boolean> updateProgress(@PathVariable String orderNo, @RequestParam int progress) {
        orderProgressService.updateOrderProgress(orderNo, progress);
        return Result.success(true);
    }

    @PostMapping("/simulate/{orderNo}")
    public Result<Boolean> simulateProgress(@PathVariable String orderNo) {
        new Thread(() -> orderProgressService.simulateProgress(orderNo)).start();
        return Result.success(true);
    }
}
