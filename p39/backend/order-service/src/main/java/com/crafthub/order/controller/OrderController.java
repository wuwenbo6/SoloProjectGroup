package com.crafthub.order.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crafthub.common.dto.OrderStatusUpdateDTO;
import com.crafthub.common.result.Result;
import com.crafthub.order.dto.OrderCreateDTO;
import com.crafthub.order.entity.Order;
import com.crafthub.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/order")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping("/user/{userId}")
    public Result<Page<Order>> getUserOrders(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        Page<Order> orders = orderService.getUserOrders(userId, page, size);
        return Result.success(orders);
    }

    @GetMapping("/artisan/{artisanId}")
    public Result<Page<Order>> getArtisanOrders(
            @PathVariable Long artisanId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        Page<Order> orders = orderService.getArtisanOrders(artisanId, page, size);
        return Result.success(orders);
    }

    @GetMapping("/{id}")
    public Result<Order> getOrderById(@PathVariable Long id) {
        Order order = orderService.getById(id);
        return order != null ? Result.success(order) : Result.error("订单不存在");
    }

    @PostMapping
    public Result<Order> createOrder(@Valid @RequestBody OrderCreateDTO dto) {
        Order order = orderService.createOrder(dto);
        return Result.success("订单创建成功", order);
    }

    @PutMapping("/{id}/progress")
    public Result<Void> updateProgress(
            @PathVariable Long id,
            @RequestParam Integer progress,
            @RequestParam(required = false, defaultValue = "进度更新") String progressDesc) {
        boolean success = orderService.updateProgress(id, progress, progressDesc);
        return success ? Result.success() : Result.error("更新失败");
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(
            @PathVariable Long id,
            @RequestParam Integer status) {
        boolean success = orderService.updateStatus(id, status);
        return success ? Result.success() : Result.error("更新失败");
    }

    @PostMapping("/status")
    public Result<Void> updateOrderStatus(@Valid @RequestBody OrderStatusUpdateDTO dto) {
        boolean success = orderService.updateStatus(dto.getOrderId(), dto.getStatus());
        return success ? Result.success() : Result.error("订单状态更新失败");
    }
}
