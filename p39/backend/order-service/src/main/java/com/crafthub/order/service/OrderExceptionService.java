package com.crafthub.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.common.feign.OrderFeignClient;
import com.crafthub.common.service.CacheService;
import com.crafthub.common.service.DataSyncService;
import com.crafthub.order.entity.Order;
import com.crafthub.order.entity.OrderExceptionLog;
import com.crafthub.order.mapper.OrderExceptionLogMapper;
import com.crafthub.order.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderExceptionService extends ServiceImpl<OrderExceptionLogMapper, OrderExceptionLog> {

    private final OrderMapper orderMapper;
    private final CacheService cacheService;
    private final DataSyncService dataSyncService;

    public enum ExceptionType {
        PAYMENT_TIMEOUT,
        STATUS_SYNC_FAILED,
        PROGRESS_SYNC_FAILED,
        STOCK_SHORTAGE,
        PAYMENT_ABNORMAL
    }

    public enum ExceptionSeverity {
        LOW(1),
        MEDIUM(2),
        HIGH(3),
        CRITICAL(4);

        private final int value;

        ExceptionSeverity(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    public enum ExceptionStatus {
        PENDING(0),
        PROCESSING(1),
        RESOLVED(2),
        FAILED(3);

        private final int value;

        ExceptionStatus(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void recordException(Long orderId, String orderNo, ExceptionType type,
                                 String code, String message, Exception exception) {
        String lockKey = "order:exception:" + orderId;
        if (!cacheService.tryLock(lockKey, 30, TimeUnit.SECONDS)) {
            log.warn("获取异常处理锁失败, orderId: {}", orderId);
            return;
        }

        try {
            OrderExceptionLog exceptionLog = new OrderExceptionLog();
            exceptionLog.setOrderId(orderId);
            exceptionLog.setOrderNo(orderNo);
            exceptionLog.setExceptionType(type.name());
            exceptionLog.setExceptionCode(code);
            exceptionLog.setExceptionMessage(message);

            if (exception != null) {
                StringWriter sw = new StringWriter();
                exception.printStackTrace(new PrintWriter(sw));
                exceptionLog.setExceptionDetail(sw.toString().substring(0, 2000));
            }

            exceptionLog.setSeverity(getSeverityByType(type).getValue());
            exceptionLog.setStatus(ExceptionStatus.PENDING.getValue());
            exceptionLog.setRetryCount(0);

            save(exceptionLog);

            log.error("订单异常已记录, orderId: {}, type: {}, message: {}", orderId, type, message);
        } finally {
            cacheService.unlock(lockKey);
        }
    }

    private ExceptionSeverity getSeverityByType(ExceptionType type) {
        switch (type) {
            case PAYMENT_TIMEOUT:
                return ExceptionSeverity.HIGH;
            case STATUS_SYNC_FAILED:
                return ExceptionSeverity.MEDIUM;
            case PROGRESS_SYNC_FAILED:
                return ExceptionSeverity.MEDIUM;
            case STOCK_SHORTAGE:
                return ExceptionSeverity.HIGH;
            case PAYMENT_ABNORMAL:
                return ExceptionSeverity.CRITICAL;
            default:
                return ExceptionSeverity.LOW;
        }
    }

    @Scheduled(fixedDelay = 60000)
    public void scanAndProcessExceptions() {
        List<OrderExceptionLog> pendingExceptions = list(
            new LambdaQueryWrapper<OrderExceptionLog>()
                .in(OrderExceptionLog::getStatus, ExceptionStatus.PENDING.getValue(), ExceptionStatus.PROCESSING.getValue())
                .lt(OrderExceptionLog::getRetryCount, 5)
                .orderByAsc(OrderExceptionLog::getSeverity)
                .orderByAsc(OrderExceptionLog::getCreateTime)
                .last("limit 100")
        );

        for (OrderExceptionLog exceptionLog : pendingExceptions) {
            try {
                processException(exceptionLog);
            } catch (Exception e) {
                log.error("处理订单异常失败, exceptionId: {}", exceptionLog.getId(), e);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void processException(OrderExceptionLog exceptionLog) {
        exceptionLog.setStatus(ExceptionStatus.PROCESSING.getValue());
        exceptionLog.setRetryCount(exceptionLog.getRetryCount() + 1);
        exceptionLog.setLastRetryTime(LocalDateTime.now());
        updateById(exceptionLog);

        boolean success = executeExceptionHandler(exceptionLog);

        if (success) {
            exceptionLog.setStatus(ExceptionStatus.RESOLVED.getValue());
            exceptionLog.setResolveTime(LocalDateTime.now());
            exceptionLog.setResolveMethod("自动处理成功");
            updateById(exceptionLog);
            log.info("订单异常自动处理成功, exceptionId: {}, orderId: {}",
                exceptionLog.getId(), exceptionLog.getOrderId());
        } else if (exceptionLog.getRetryCount() >= 5) {
            exceptionLog.setStatus(ExceptionStatus.FAILED.getValue());
            exceptionLog.setResolveMethod("重试次数超限，转人工处理");
            updateById(exceptionLog);
            log.error("订单异常自动处理失败，需人工介入, exceptionId: {}, orderId: {}",
                exceptionLog.getId(), exceptionLog.getOrderId());
        }
    }

    private boolean executeExceptionHandler(OrderExceptionLog exceptionLog) {
        ExceptionType type = ExceptionType.valueOf(exceptionLog.getExceptionType());

        try {
            switch (type) {
                case PAYMENT_TIMEOUT:
                    return handlePaymentTimeout(exceptionLog);
                case STATUS_SYNC_FAILED:
                    return handleStatusSyncFailed(exceptionLog);
                case PROGRESS_SYNC_FAILED:
                    return handleProgressSyncFailed(exceptionLog);
                case STOCK_SHORTAGE:
                    return handleStockShortage(exceptionLog);
                case PAYMENT_ABNORMAL:
                    return handlePaymentAbnormal(exceptionLog);
                default:
                    return false;
            }
        } catch (Exception e) {
            log.error("异常处理器执行失败, exceptionId: {}", exceptionLog.getId(), e);
            return false;
        }
    }

    private boolean handlePaymentTimeout(OrderExceptionLog exceptionLog) {
        Order order = orderMapper.selectById(exceptionLog.getOrderId());
        if (order == null) {
            return true;
        }

        if (order.getStatus() == 1) {
            order.setStatus(0);
            orderMapper.updateById(order);
            log.info("支付超时自动取消订单, orderId: {}", exceptionLog.getOrderId());
            return true;
        }

        return true;
    }

    private boolean handleStatusSyncFailed(OrderExceptionLog exceptionLog) {
        Order order = orderMapper.selectById(exceptionLog.getOrderId());
        if (order == null) {
            return true;
        }

        dataSyncService.broadcastOrderStatusChange(order.getId(), order.getStatus(), order.getUserId());

        return true;
    }

    private boolean handleProgressSyncFailed(OrderExceptionLog exceptionLog) {
        Order order = orderMapper.selectById(exceptionLog.getOrderId());
        if (order == null) {
            return true;
        }

        dataSyncService.broadcastOrderProgressChange(order.getId(), order.getProgress(),
            order.getUserId(), order.getArtisanId());

        return true;
    }

    private boolean handleStockShortage(OrderExceptionLog exceptionLog) {
        log.warn("物料短缺告警，通知匠人准备材料, orderId: {}", exceptionLog.getOrderId());
        return true;
    }

    private boolean handlePaymentAbnormal(OrderExceptionLog exceptionLog) {
        Order order = orderMapper.selectById(exceptionLog.getOrderId());
        if (order == null) {
            return true;
        }

        if (order.getStatus() == 2) {
            order.setStatus(1);
            orderMapper.updateById(order);
            dataSyncService.broadcastOrderStatusChange(order.getId(), 1, order.getUserId());
            log.info("支付状态异常自动回滚, orderId: {}", exceptionLog.getOrderId());
            return true;
        }

        return true;
    }

    @Scheduled(fixedDelay = 300000)
    public void scanPaymentTimeoutOrders() {
        LocalDateTime timeout = LocalDateTime.now().minusMinutes(30);
        List<Order> timeoutOrders = orderMapper.selectList(
            new LambdaQueryWrapper<Order>()
                .eq(Order::getStatus, 1)
                .lt(Order::getCreateTime, timeout)
                .last("limit 100")
        );

        for (Order order : timeoutOrders) {
            recordException(order.getId(), order.getOrderNo(),
                ExceptionType.PAYMENT_TIMEOUT, "PAY001", "订单支付超时30分钟", null);
        }
    }

    public List<OrderExceptionLog> getOrderExceptions(Long orderId) {
        return list(
            new LambdaQueryWrapper<OrderExceptionLog>()
                .eq(OrderExceptionLog::getOrderId, orderId)
                .orderByDesc(OrderExceptionLog::getCreateTime)
        );
    }

    public long getPendingExceptionCount() {
        return count(
            new LambdaQueryWrapper<OrderExceptionLog>()
                .eq(OrderExceptionLog::getStatus, ExceptionStatus.PENDING.getValue())
        );
    }
}
