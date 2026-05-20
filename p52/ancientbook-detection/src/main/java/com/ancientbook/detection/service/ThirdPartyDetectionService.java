package com.ancientbook.detection.service;

import com.ancientbook.common.annotation.Idempotent;
import com.ancientbook.common.annotation.Retryable;
import com.ancientbook.common.datasource.DataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.common.exception.BusinessException;
import com.ancientbook.detection.entity.DetectionReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
@DataSource(DataSourceType.DETECTION)
public class ThirdPartyDetectionService {

    private final Map<String, DetectionReport> reportStore = new ConcurrentHashMap<>();

    /**
     * 同步检测报告 - 带超时控制、重试、幂等保护
     */
    @Idempotent(key = "#thirdPartyCode + '_' + #bookCode", expireTime = 2, message = "该善本检测报告正在同步中，请稍后重试")
    @Retryable(maxAttempts = 3, delay = 1000, multiplier = 2.0)
    public Map<String, Object> syncDetectionReport(String thirdPartyCode, Long bookId, String bookCode) {
        log.info("开始同步第三方检测报告: 机构={}, bookId={}, bookCode={}",
                thirdPartyCode, bookId, bookCode);

        ExecutorService executor = Executors.newSingleThreadExecutor();
        Future<Map<String, Object>> future = executor.submit(() ->
                callThirdPartyApi(thirdPartyCode, bookId, bookCode));

        try {
            Map<String, Object> result = future.get(10, TimeUnit.SECONDS);
            executor.shutdown();
            return result;
        } catch (TimeoutException e) {
            future.cancel(true);
            executor.shutdownNow();
            log.error("第三方检测接口调用超时: bookCode={}", bookCode);
            throw new BusinessException(504, "检测服务响应超时，请稍后重试");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("同步被中断");
        } catch (ExecutionException e) {
            log.error("第三方检测接口调用异常", e);
            if (e.getCause() instanceof BusinessException) {
                throw (BusinessException) e.getCause();
            }
            throw new BusinessException("检测服务异常: " + e.getMessage());
        }
    }

    /**
     * 异步同步检测报告
     */
    @Async("thirdPartyExecutor")
    public void asyncSyncDetectionReport(String thirdPartyCode, Long bookId, String bookCode,
                                          CompletableFuture<Map<String, Object>> callback) {
        try {
            Map<String, Object> result = callThirdPartyApi(thirdPartyCode, bookId, bookCode);
            callback.complete(result);
        } catch (Exception e) {
            log.error("异步同步检测报告失败", e);
            callback.completeExceptionally(e);
        }
    }

    /**
     * 模拟调用第三方API
     */
    private Map<String, Object> callThirdPartyApi(String thirdPartyCode, Long bookId, String bookCode) {
        log.debug("调用第三方检测API...");

        // 模拟网络延迟
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 模拟30%概率的随机故障
        if (Math.random() < 0.3) {
            throw new BusinessException("第三方接口临时故障，请重试");
        }

        DetectionReport report = new DetectionReport();
        report.setReportCode("DET_" + System.currentTimeMillis());
        report.setBookId(bookId);
        report.setBookCode(bookCode);
        report.setDetectionType(1);
        report.setThirdPartyCode(thirdPartyCode);
        report.setThirdPartyName(getThirdPartyName(thirdPartyCode));
        report.setReporterId(1L);
        report.setReporterName("系统管理员");
        report.setReportTime(LocalDateTime.now());
        report.setPhValue(BigDecimal.valueOf(6.5 + Math.random() * 2));
        report.setFiberType("宣纸纤维");
        report.setAgingDegree((int) (Math.random() * 4) + 1);
        report.setDamageDetails("{\"damageType\":\"虫蛀\",\"severity\":\"中度\",\"areas\":[\"页边\",\"书口\"]}");
        report.setConclusion("建议采用纸浆修补法进行修复");
        report.setSuggestions("1. 先进行除尘清洁 2. 采用纸浆修补法修复虫蛀部位 3. 注意控制修复湿度");
        report.setSyncStatus(1);
        report.setSyncTime(LocalDateTime.now());
        report.setStatus(1);

        reportStore.put(report.getReportCode(), report);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("message", "同步成功");
        result.put("syncTime", LocalDateTime.now());
        result.put("report", report);

        log.info("第三方检测报告同步成功: reportCode={}", report.getReportCode());
        return result;
    }

    public Map<String, Object> getDetectionOrgList() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", 2);
        result.put("list", List.of(
                createOrg("TEST_ORG_001", "国家图书馆古籍检测中心", "王工", "010-12345678"),
                createOrg("TEST_ORG_002", "故宫博物院文保科技部", "李工", "010-87654321")
        ));
        return result;
    }

    private Map<String, Object> createOrg(String code, String name, String contact, String phone) {
        Map<String, Object> org = new LinkedHashMap<>();
        org.put("orgCode", code);
        org.put("orgName", name);
        org.put("contactPerson", contact);
        org.put("contactPhone", phone);
        return org;
    }

    /**
     * 查询同步状态
     */
    public Map<String, Object> getSyncStatus(String reportCode) {
        DetectionReport report = reportStore.get(reportCode);
        Map<String, Object> result = new LinkedHashMap<>();
        if (report != null) {
            result.put("reportCode", reportCode);
            result.put("syncStatus", report.getSyncStatus());
            result.put("syncTime", report.getSyncTime());
            result.put("statusText", report.getSyncStatus() == 1 ? "已同步" : "同步中");
        } else {
            result.put("syncStatus", 0);
            result.put("statusText", "未找到报告");
        }
        return result;
    }
}
