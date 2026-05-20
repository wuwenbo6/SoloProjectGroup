package com.crafthub.common.feign;

import com.crafthub.common.dto.PaymentRequestDTO;
import com.crafthub.common.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class PaymentFeignClientFallback implements PaymentFeignClient {

    @Override
    public Result<String> processPayment(PaymentRequestDTO dto) {
        log.error("支付服务熔断 - 支付处理失败, orderId: {}", dto.getOrderId());
        return Result.error("支付服务繁忙，请稍后重试");
    }

    @Override
    public Result<String> handlePaymentCallback(Object callbackDTO) {
        log.error("支付服务熔断 - 支付回调处理失败");
        return Result.error("支付服务暂时不可用");
    }
}
