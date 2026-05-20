package com.ancientbook.progress.service;

import com.ancientbook.common.constant.WarningLevel;
import com.ancientbook.common.constant.WarningType;
import com.ancientbook.progress.entity.ProgressWarning;
import com.ancientbook.progress.entity.RepairProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProgressWarningService {

    private final Map<String, ProgressWarning> warningStore = new ConcurrentHashMap<>();
    private final RepairProgressService progressService;

    private static final BigDecimal QUALITY_THRESHOLD = new BigDecimal("70.0");
    private static final int TIMEOUT_THRESHOLD_MINUTES = 60;

    public ProgressWarning createWarning(ProgressWarning warning) {
        String warningCode = "WARN_" + System.currentTimeMillis();
        warning.setWarningCode(warningCode);
        warning.setCreateTime(LocalDateTime.now());
        warning.setStatus(0);

        WarningType type = WarningType.of(warning.getWarningType());
        if (type != null) {
            warning.setWarningTypeName(type.getName());
        }

        WarningLevel level = WarningLevel.values()[warning.getWarningLevel() - 1];
        if (level != null) {
            warning.setWarningLevelName(level.getName());
        }

        warningStore.put(warningCode, warning);
        log.info("创建预警: {}", warningCode);
        return warning;
    }

    public Map<String, Object> autoCheckAndWarn(Long bookId, String bookCode) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<ProgressWarning> generatedWarnings = new ArrayList<>();

        List<RepairProgress> progressList = progressService.getProgressByBookId(bookId);

        for (RepairProgress progress : progressList) {
            ProgressWarning timeoutWarning = checkTimeout(progress, bookCode);
            if (timeoutWarning != null) {
                generatedWarnings.add(timeoutWarning);
            }

            ProgressWarning qualityWarning = checkQuality(progress, bookCode);
            if (qualityWarning != null) {
                generatedWarnings.add(qualityWarning);
            }
        }

        generatedWarnings.forEach(this::createWarning);

        result.put("totalChecked", progressList.size());
        result.put("generatedCount", generatedWarnings.size());
        result.put("warnings", generatedWarnings);

        return result;
    }

    private ProgressWarning checkTimeout(RepairProgress progress, String bookCode) {
        if (progress.getStatus() == null || progress.getStatus() != 1) {
            return null;
        }

        LocalDateTime startTime = progress.getStartTime();
        if (startTime == null) {
            return null;
        }

        long minutes = ChronoUnit.MINUTES.between(startTime, LocalDateTime.now());
        if (minutes > TIMEOUT_THRESHOLD_MINUTES) {
            ProgressWarning warning = new ProgressWarning();
            warning.setBookId(progress.getBookId());
            warning.setBookCode(bookCode);
            warning.setProgressId(progress.getId());
            warning.setProgressCode(progress.getProgressCode());
            warning.setWarningType(WarningType.TIMEOUT.getCode());
            warning.setWarningLevel(WarningLevel.MEDIUM.getCode());
            warning.setWarningTitle("修复进度超时");
            warning.setWarningContent(String.format("工序[%s]已执行%d分钟，超过预期时间%d分钟",
                    progress.getStepName(), minutes, TIMEOUT_THRESHOLD_MINUTES));
            warning.setDetailJson(String.format("{\"elapsedMinutes\":%d,\"thresholdMinutes\":%d}",
                    minutes, TIMEOUT_THRESHOLD_MINUTES));

            return warning;
        }
        return null;
    }

    private ProgressWarning checkQuality(RepairProgress progress, String bookCode) {
        if (progress.getQualityScore() == null) {
            return null;
        }

        if (progress.getQualityScore().compareTo(QUALITY_THRESHOLD) < 0) {
            ProgressWarning warning = new ProgressWarning();
            warning.setBookId(progress.getBookId());
            warning.setBookCode(bookCode);
            warning.setProgressId(progress.getId());
            warning.setProgressCode(progress.getProgressCode());
            warning.setWarningType(WarningType.QUALITY.getCode());
            warning.setWarningLevel(WarningLevel.HIGH.getCode());
            warning.setWarningTitle("修复质量异常");
            warning.setWarningContent(String.format("工序[%s]质量评分%.1f，低于阈值%.1f",
                    progress.getStepName(), progress.getQualityScore(), QUALITY_THRESHOLD));
            warning.setDetailJson(String.format("{\"score\":%.1f,\"threshold\":%.1f}",
                    progress.getQualityScore(), QUALITY_THRESHOLD));

            return warning;
        }
        return null;
    }

    public ProgressWarning handleWarning(String warningCode, String handlerId,
                                         String handlerName, String handleResult) {
        ProgressWarning warning = warningStore.get(warningCode);
        if (warning == null) {
            throw new RuntimeException("预警记录不存在");
        }

        warning.setStatus(1);
        warning.setHandlerId(handlerId);
        warning.setHandlerName(handlerName);
        warning.setHandleTime(LocalDateTime.now());
        warning.setHandleResult(handleResult);

        log.info("处理预警: {}, 处理人: {}", warningCode, handlerName);
        return warning;
    }

    public List<ProgressWarning> getWarningsByBook(String bookCode) {
        return warningStore.values().stream()
                .filter(w -> bookCode.equals(w.getBookCode()))
                .sorted(Comparator.comparing(ProgressWarning::getCreateTime).reversed())
                .collect(Collectors.toList());
    }

    public List<ProgressWarning> getPendingWarnings() {
        return warningStore.values().stream()
                .filter(w -> w.getStatus() == 0)
                .sorted(Comparator.comparing(ProgressWarning::getWarningLevel).reversed()
                        .thenComparing(ProgressWarning::getCreateTime).reversed())
                .collect(Collectors.toList());
    }

    public Map<String, Object> getWarningStatistics() {
        Map<String, Object> stats = new LinkedHashMap<>();

        long total = warningStore.size();
        long pending = warningStore.values().stream().filter(w -> w.getStatus() == 0).count();
        long handled = warningStore.values().stream().filter(w -> w.getStatus() == 1).count();

        Map<String, Long> typeCount = new HashMap<>();
        for (WarningType type : WarningType.values()) {
            long count = warningStore.values().stream()
                    .filter(w -> w.getWarningType() == type.getCode())
                    .count();
            typeCount.put(type.getName(), count);
        }

        Map<String, Long> levelCount = new HashMap<>();
        for (WarningLevel level : WarningLevel.values()) {
            long count = warningStore.values().stream()
                    .filter(w -> w.getWarningLevel() == level.getCode())
                    .count();
            levelCount.put(level.getName(), count);
        }

        stats.put("total", total);
        stats.put("pending", pending);
        stats.put("handled", handled);
        stats.put("typeDistribution", typeCount);
        stats.put("levelDistribution", levelCount);

        return stats;
    }

    public ProgressWarning getWarningByCode(String warningCode) {
        return warningStore.get(warningCode);
    }
}
