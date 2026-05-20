package com.crafthub.payment.controller;

import com.crafthub.common.response.ApiResponse;
import com.crafthub.payment.dto.PaymentCallbackDTO;
import com.crafthub.payment.dto.PaymentRequestDTO;
import com.crafthub.payment.entity.Payment;
import com.crafthub.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payment")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    @Autowired
    private PaymentService paymentService;

    @PostMapping("/process")
    public ApiResponse<String> processPayment(@Valid @RequestBody PaymentRequestDTO request) {
        log.info("收到支付请求，订单ID: {}", request.getOrderId());
        return paymentService.processPayment(request);
    }

    @PostMapping("/callback")
    public ApiResponse<String> handleCallback(@Valid @RequestBody PaymentCallbackDTO callback) {
        log.info("收到支付回调，支付单号: {}", callback.getPaymentNo());
        return paymentService.handlePaymentCallback(callback);
    }

    @GetMapping("/order/{orderId}")
    public ApiResponse<Payment> getPaymentByOrderId(@PathVariable Long orderId) {
        return paymentService.getPaymentByOrderId(orderId);
    }

    @GetMapping("/{paymentNo}")
    public ApiResponse<Payment> getPaymentByNo(@PathVariable String paymentNo) {
        return paymentService.getPaymentByNo(paymentNo);
    }
}
