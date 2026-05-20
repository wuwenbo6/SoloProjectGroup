package com.crafthub.common.feign;

import com.crafthub.common.dto.PaymentRequestDTO;
import com.crafthub.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "payment-service", fallback = PaymentFeignClientFallback.class)
public interface PaymentFeignClient {

    @PostMapping("/payment/process")
    Result<String> processPayment(@RequestBody PaymentRequestDTO dto);

    @PostMapping("/payment/callback")
    Result<String> handlePaymentCallback(@RequestBody Object callbackDTO);
}
