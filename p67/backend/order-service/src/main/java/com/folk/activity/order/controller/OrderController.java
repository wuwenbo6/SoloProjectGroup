package com.folk.activity.order.controller;

import com.folk.activity.common.core.result.Result;
import com.folk.activity.order.dto.OrderCreateDTO;
import com.folk.activity.order.entity.Order;
import com.folk.activity.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/order")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;

    @PostMapping("/create")
    public Result<Order> createOrder(@Valid @RequestBody OrderCreateDTO dto) {
        return Result.success(orderService.createOrder(dto));
    }

    @GetMapping("/{orderNo}")
    public Result<Order> getOrder(@PathVariable String orderNo) {
        return Result.success(orderService.getOrderByNo(orderNo));
    }

    @GetMapping("/user/{userId}")
    public Result<List<Order>> getUserOrders(@PathVariable Long userId) {
        return Result.success(orderService.getUserOrders(userId));
    }

    @PostMapping("/cancel/{orderNo}")
    public Result<Boolean> cancelOrder(@PathVariable String orderNo) {
        return Result.success(orderService.cancelOrder(orderNo));
    }

    @PostMapping("/pay/{orderNo}")
    public Result<Boolean> payOrder(@PathVariable String orderNo, @RequestParam String paymentMethod) {
        return Result.success(orderService.payOrder(orderNo, paymentMethod));
    }
}
