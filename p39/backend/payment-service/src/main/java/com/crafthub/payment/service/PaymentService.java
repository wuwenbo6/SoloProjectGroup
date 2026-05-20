package com.crafthub.payment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.common.feign.OrderFeignClient;
import com.crafthub.common.result.Result;
import com.crafthub.common.service.CacheService;
import com.crafthub.common.service.DataSyncService;
import com.crafthub.payment.dto.PaymentCallbackDTO;
import com.crafthub.payment.dto.PaymentRequestDTO;
import com.crafthub.payment.entity.Payment;
import com.crafthub.payment.entity.PaymentLog;
import com.crafthub.payment.enums.PaymentChannel;
import com.crafthub.payment.enums.PaymentStatus;
import com.crafthub.payment.mapper.PaymentLogMapper;
import com.crafthub.payment.mapper.PaymentMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class PaymentService extends ServiceImpl<PaymentMapper, Payment> {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final OrderFeignClient orderFeignClient;
    private final PaymentLogMapper paymentLogMapper;
    private final CacheService cacheService;
    private final DataSyncService dataSyncService;
    private final ObjectMapper objectMapper;

    private static final String PAYMENT_IDEMPOTENT_KEY = "payment:idempotent:";
    private static final String CALLBACK_COMPENSATE_KEY = "payment:callback:compensate:";

    @Transactional(rollbackFor = Exception.class)
    public Result<String> processPayment(PaymentRequestDTO request) {
        log.info("开始处理支付请求，订单ID: {}", request.getOrderId());

        String idempotentKey = PAYMENT_IDEMPOTENT_KEY + request.getOrderId() + ":" + request.getUserId();
        if (!cacheService.tryLock(idempotentKey, 30, TimeUnit.MINUTES)) {
            return Result.fail("支付请求处理中，请勿重复提交");
        }

        try {
            Payment existingPayment = getOne(
                new LambdaQueryWrapper<Payment>()
                    .eq(Payment::getOrderId, request.getOrderId())
                    .in(Payment::getStatus, PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.SUCCESS)
            );

            if (existingPayment != null) {
                if (existingPayment.getStatus() == PaymentStatus.SUCCESS) {
                    return Result.success("订单已支付", existingPayment.getPaymentNo());
                }
                if (existingPayment.getStatus() == PaymentStatus.PROCESSING) {
                    return Result.fail("支付处理中，请稍后再试");
                }
            }

            String paymentNo = generatePaymentNo();
            Payment payment = new Payment();
            payment.setPaymentNo(paymentNo);
            payment.setOrderId(request.getOrderId());
            payment.setUserId(request.getUserId());
            payment.setAmount(request.getAmount());
            payment.setChannel(PaymentChannel.valueOf(request.getChannel()));
            payment.setStatus(PaymentStatus.PROCESSING);

            save(payment);

            recordPaymentLog(payment, request, "CREATE");

            log.info("创建支付记录成功，支付单号: {}", paymentNo);

            try {
                boolean paymentSuccess = simulateThirdPartyPayment(request);

                if (paymentSuccess) {
                    return handlePaymentSuccess(payment);
                } else {
                    return handlePaymentFailed(payment, "第三方支付失败");
                }
            } catch (Exception e) {
                log.error("支付处理异常，支付单号: {}", paymentNo, e);
                return handlePaymentFailed(payment, e.getMessage());
            }
        } finally {
            cacheService.unlock(idempotentKey);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<String> handlePaymentCallback(PaymentCallbackDTO callback) {
        log.info("收到支付回调，支付单号: {}", callback.getPaymentNo());

        String callbackKey = CALLBACK_COMPENSATE_KEY + callback.getPaymentNo();
        if (!cacheService.tryLock(callbackKey, 10, TimeUnit.MINUTES)) {
            return Result.fail("回调处理中");
        }

        try {
            Payment payment = getOne(
                new LambdaQueryWrapper<Payment>().eq(Payment::getPaymentNo, callback.getPaymentNo())
            );

            if (payment == null) {
                return Result.fail("支付记录不存在");
            }

            if (payment.getStatus() == PaymentStatus.SUCCESS) {
                return Result.success("支付已成功", payment.getPaymentNo());
            }

            updatePaymentLogCallback(payment.getPaymentNo(), callback);

            if (callback.isSuccess()) {
                return handlePaymentSuccess(payment);
            } else {
                return handlePaymentFailed(payment, callback.getFailReason());
            }
        } finally {
            cacheService.unlock(callbackKey);
        }
    }

    @Retry(name = "order-service", fallbackMethod = "handleOrderUpdateFallback")
    private Result<String> handlePaymentSuccess(Payment payment) {
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaidTime(LocalDateTime.now());
        payment.setThirdPartyTransactionId(UUID.randomUUID().toString().replace("-", ""));
        updateById(payment);
        log.info("支付成功，支付单号: {}", payment.getPaymentNo());

        recordPaymentLog(payment, null, "SUCCESS");

        try {
            Result<Void> orderResponse = orderFeignClient.updateOrderStatus(payment.getOrderId(), 2);

            if (orderResponse == null || !orderResponse.isSuccess()) {
                log.error("订单状态更新失败，支付单号: {}", payment.getPaymentNo());
                throw new RuntimeException("订单状态更新失败");
            }
            log.info("订单状态更新成功，订单ID: {}", payment.getOrderId());

            dataSyncService.broadcastPaymentStatusChange(payment.getPaymentNo(), payment.getOrderId(), 2);
        } catch (Exception e) {
            log.error("调用订单服务失败", e);
            throw new RuntimeException("订单状态更新失败", e);
        }

        return Result.success("支付成功", payment.getPaymentNo());
    }

    private Result<String> handleOrderUpdateFallback(Payment payment, Exception e) {
        log.error("订单状态更新熔断降级，支付单号: {}, 错误: {}", payment.getPaymentNo(), e.getMessage());
        payment.setStatus(PaymentStatus.PENDING);
        updateById(payment);

        PaymentLog paymentLog = new PaymentLog();
        paymentLog.setPaymentNo(payment.getPaymentNo());
        paymentLog.setOrderId(payment.getOrderId());
        paymentLog.setStatus(9);
        paymentLog.setRetryCount(0);
        paymentLogMapper.insert(paymentLog);

        return Result.fail("订单状态同步中，请稍后查看支付结果");
    }

    private Result<String> handlePaymentFailed(Payment payment, String failReason) {
        payment.setStatus(PaymentStatus.FAILED);
        payment.setFailReason(failReason);
        updateById(payment);
        log.warn("支付失败，支付单号: {}, 原因: {}", payment.getPaymentNo(), failReason);

        recordPaymentLog(payment, null, "FAILED");

        return Result.fail("支付失败: " + failReason);
    }

    public Result<Payment> getPaymentByOrderId(Long orderId) {
        Payment payment = getOne(
            new LambdaQueryWrapper<Payment>().eq(Payment::getOrderId, orderId)
        );
        return Result.success(payment);
    }

    public Result<Payment> getPaymentByNo(String paymentNo) {
        Payment payment = getOne(
            new LambdaQueryWrapper<Payment>().eq(Payment::getPaymentNo, paymentNo)
        );
        return Result.success(payment);
    }

    private String generatePaymentNo() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        return "PAY" + timestamp + uuid;
    }

    private boolean simulateThirdPartyPayment(PaymentRequestDTO request) {
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return request.getAmount().compareTo(new BigDecimal("1000000")) < 0;
    }

    private void recordPaymentLog(Payment payment, PaymentRequestDTO request, String action) {
        try {
            PaymentLog paymentLog = new PaymentLog();
            paymentLog.setPaymentNo(payment.getPaymentNo());
            paymentLog.setOrderId(payment.getOrderId());
            paymentLog.setOrderNo(payment.getOrderNo());
            paymentLog.setUserId(payment.getUserId());
            paymentLog.setAmount(payment.getAmount());
            paymentLog.setPaymentMethod(payment.getChannel().ordinal());
            paymentLog.setStatus(payment.getStatus().ordinal());

            if (request != null) {
                paymentLog.setRequestParams(objectMapper.writeValueAsString(request).substring(0, 500));
            }

            paymentLogMapper.insert(paymentLog);
        } catch (JsonProcessingException e) {
            log.error("序列化支付日志失败", e);
        }
    }

    private void updatePaymentLogCallback(String paymentNo, PaymentCallbackDTO callback) {
        try {
            LambdaQueryWrapper<PaymentLog> wrapper = new LambdaQueryWrapper<PaymentLog>()
                .eq(PaymentLog::getPaymentNo, paymentNo)
                .orderByDesc(PaymentLog::getCreateTime)
                .last("limit 1");

            PaymentLog paymentLog = paymentLogMapper.selectOne(wrapper);
            if (paymentLog != null) {
                paymentLog.setCallbackData(objectMapper.writeValueAsString(callback).substring(0, 1000));
                paymentLog.setCallbackTime(LocalDateTime.now());
                paymentLogMapper.updateById(paymentLog);
            }
        } catch (JsonProcessingException e) {
            log.error("序列化回调数据失败", e);
        }
    }

    @Scheduled(fixedDelay = 60000)
    public void compensatePendingCallbacks() {
        List<PaymentLog> pendingLogs = paymentLogMapper.selectList(
            new LambdaQueryWrapper<PaymentLog>()
                .eq(PaymentLog::getStatus, 9)
                .lt(PaymentLog::getRetryCount, 5)
                .last("limit 50")
        );

        for (PaymentLog paymentLog : pendingLogs) {
            try {
                compensateSinglePayment(paymentLog);
            } catch (Exception e) {
                log.error("支付回调补偿失败, paymentNo: {}", paymentLog.getPaymentNo(), e);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void compensateSinglePayment(PaymentLog paymentLog) {
        Payment payment = getOne(
            new LambdaQueryWrapper<Payment>().eq(Payment::getPaymentNo, paymentLog.getPaymentNo())
        );

        if (payment == null || payment.getStatus() == PaymentStatus.SUCCESS) {
            paymentLog.setStatus(2);
            paymentLogMapper.updateById(paymentLog);
            return;
        }

        paymentLog.setRetryCount(paymentLog.getRetryCount() + 1);
        paymentLogMapper.updateById(paymentLog);

        try {
            Result<Void> orderResponse = orderFeignClient.updateOrderStatus(payment.getOrderId(), 2);

            if (orderResponse != null && orderResponse.isSuccess()) {
                payment.setStatus(PaymentStatus.SUCCESS);
                payment.setPaidTime(LocalDateTime.now());
                updateById(payment);

                paymentLog.setStatus(2);
                paymentLogMapper.updateById(paymentLog);

                dataSyncService.broadcastPaymentStatusChange(payment.getPaymentNo(), payment.getOrderId(), 2);

                log.info("支付回调补偿成功, paymentNo: {}", payment.getPaymentNo());
            }
        } catch (Exception e) {
            log.warn("支付回调补偿重试失败, paymentNo: {}, 重试次数: {}",
                payment.getPaymentNo(), paymentLog.getRetryCount());
        }
    }

    public long getPendingCompensationCount() {
        return paymentLogMapper.selectCount(
            new LambdaQueryWrapper<PaymentLog>()
                .eq(PaymentLog::getStatus, 9)
        );
    }
}
