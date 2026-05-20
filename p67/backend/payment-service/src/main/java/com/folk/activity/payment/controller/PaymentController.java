package com.folk.activity.payment.controller;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.folk.activity.common.core.result.Result;
import com.folk.activity.payment.annotation.Idempotent;
import com.folk.activity.payment.entity.PaymentRecord;
import com.folk.activity.payment.mapper.PaymentRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/payment")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentRecordMapper paymentRecordMapper;

    @Value("${spring.application.name}")
    private String serviceName;

    @PostMapping("/create")
    @Idempotent(expireTime = 300)
    public Result<Map<String, Object>> createPayment(
            @RequestParam String orderNo,
            @RequestParam BigDecimal amount,
            @RequestParam String paymentMethod,
            @RequestParam Long userId) {
        
        LambdaQueryWrapper<PaymentRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(PaymentRecord::getOrderNo, orderNo)
                    .eq(PaymentRecord::getStatus, 1);
        
        PaymentRecord existingPayment = paymentRecordMapper.selectOne(queryWrapper);
        if (existingPayment != null) {
            return Result.success(Map.of(
                "paymentNo", existingPayment.getPaymentNo(),
                "payUrl", "https://pay.example.com/" + existingPayment.getPaymentNo(),
                "status", existingPayment.getStatus(),
                "message", "该订单已支付成功"
            ));
        }

        LambdaQueryWrapper<PaymentRecord> processingQuery = new LambdaQueryWrapper<>();
        processingQuery.eq(PaymentRecord::getOrderNo, orderNo)
                       .eq(PaymentRecord::getStatus, 0);
        
        PaymentRecord processingPayment = paymentRecordMapper.selectOne(processingQuery);
        if (processingPayment != null) {
            return Result.success(Map.of(
                "paymentNo", processingPayment.getPaymentNo(),
                "payUrl", "https://pay.example.com/" + processingPayment.getPaymentNo(),
                "status", processingPayment.getStatus(),
                "message", "该订单正在支付处理中"
            ));
        }

        PaymentRecord record = new PaymentRecord();
        record.setOrderNo(orderNo);
        record.setPaymentNo("PAY" + IdUtil.getSnowflakeNextIdStr());
        record.setUserId(userId);
        record.setAmount(amount);
        record.setPaymentMethod(paymentMethod);
        record.setStatus(0);
        paymentRecordMapper.insert(record);
        
        return Result.success(Map.of(
            "paymentNo", record.getPaymentNo(),
            "payUrl", "https://pay.example.com/" + record.getPaymentNo()
        ));
    }

    @PostMapping("/callback/{paymentNo}")
    public Result<Boolean> paymentCallback(@PathVariable String paymentNo, 
                                           @RequestBody Map<String, Object> callbackData) {
        LambdaQueryWrapper<PaymentRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(PaymentRecord::getPaymentNo, paymentNo);
        
        PaymentRecord record = paymentRecordMapper.selectOne(queryWrapper);
        if (record == null) {
            return Result.fail("支付记录不存在");
        }
        
        if (record.getStatus() == 1) {
            return Result.success(true);
        }
        
        if (record.getStatus() == 2) {
            return Result.fail("该订单已退款");
        }
        
        record.setStatus(1);
        record.setSuccessTime(LocalDateTime.now());
        record.setCallbackData(callbackData.toString());
        paymentRecordMapper.updateById(record);
        
        return Result.success(true);
    }

    @GetMapping("/{paymentNo}")
    public Result<PaymentRecord> getPaymentRecord(@PathVariable String paymentNo) {
        LambdaQueryWrapper<PaymentRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(PaymentRecord::getPaymentNo, paymentNo);
        return Result.success(paymentRecordMapper.selectOne(queryWrapper));
    }

    @PostMapping("/refund/{paymentNo}")
    public Result<Boolean> refund(@PathVariable String paymentNo, @RequestParam String reason) {
        LambdaQueryWrapper<PaymentRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(PaymentRecord::getPaymentNo, paymentNo);
        
        PaymentRecord record = paymentRecordMapper.selectOne(queryWrapper);
        if (record == null) {
            return Result.fail("支付记录不存在");
        }
        
        if (record.getStatus() == 0) {
            return Result.fail("该订单未支付，不能退款");
        }
        
        if (record.getStatus() == 2) {
            return Result.success(true);
        }
        
        record.setStatus(2);
        record.setRemark(reason);
        paymentRecordMapper.updateById(record);
        
        return Result.success(true);
    }

    @GetMapping("/status/{orderNo}")
    public Result<Integer> getPaymentStatus(@PathVariable String orderNo) {
        LambdaQueryWrapper<PaymentRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(PaymentRecord::getOrderNo, orderNo)
                    .orderByDesc(PaymentRecord::getCreateTime)
                    .last("LIMIT 1");
        
        PaymentRecord record = paymentRecordMapper.selectOne(queryWrapper);
        if (record == null) {
            return Result.success(0);
        }
        return Result.success(record.getStatus());
    }
}
