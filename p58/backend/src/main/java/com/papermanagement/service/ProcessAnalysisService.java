package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.ProcessLog;
import com.papermanagement.entity.ProcessNode;
import com.papermanagement.entity.QualityReport;
import com.papermanagement.mapper.ProcessLogMapper;
import com.papermanagement.mapper.ProcessNodeMapper;
import com.papermanagement.mapper.QualityReportMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProcessAnalysisService {

    private static final Logger logger = LoggerFactory.getLogger(ProcessAnalysisService.class);

    @Autowired
    private ProcessLogMapper processLogMapper;

    @Autowired
    private ProcessNodeMapper processNodeMapper;

    @Autowired
    private QualityReportMapper qualityReportMapper;

    @Cacheable(value = "processNodes", key = "'all'", unless = "#result == null")
    public Result<List<ProcessNode>> getCachedProcessNodes() {
        logger.info("从数据库加载工序节点数据");
        LambdaQueryWrapper<ProcessNode> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProcessNode::getStatus, 1);
        wrapper.orderByAsc(ProcessNode::getSortOrder);
        List<ProcessNode> list = processNodeMapper.selectList(wrapper);
        return Result.success(list);
    }

    @Cacheable(value = "batchProgress", key = "#batchNo", unless = "#result == null")
    public Result<Map<String, Object>> getBatchProgress(String batchNo) {
        logger.info("计算批次进度: {}", batchNo);
        LambdaQueryWrapper<ProcessLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProcessLog::getBatchNo, batchNo);
        wrapper.orderByAsc(ProcessLog::getCreateTime);
        List<ProcessLog> logs = processLogMapper.selectList(wrapper);

        Map<String, Object> result = new HashMap<>();
        result.put("batchNo", batchNo);
        result.put("totalProcess", 8);

        long completedCount = logs.stream().filter(p -> "COMPLETED".equals(p.getStatus())).count();
        result.put("completedProcess", completedCount);
        result.put("progress", completedCount * 100.0 / 8);

        List<Map<String, Object>> processList = new ArrayList<>();
        for (ProcessLog log : logs) {
            Map<String, Object> process = new HashMap<>();
            process.put("processCode", log.getProcessCode());
            process.put("processName", log.getProcessName());
            process.put("status", log.getStatus());
            process.put("startTime", log.getStartTime());
            process.put("endTime", log.getEndTime());
            process.put("craftsmanName", log.getCraftsmanName());
            process.put("abnormalFlag", log.getAbnormalFlag());

            if (log.getStartTime() != null && log.getEndTime() != null) {
                Duration duration = Duration.between(log.getStartTime(), log.getEndTime());
                process.put("durationMinutes", duration.toMinutes());
            }

            processList.add(process);
        }
        result.put("processList", processList);

        return Result.success(result);
    }

    public Result<Map<String, Object>> compareBatches(List<String> batchNos) {
        logger.info("多批次对比分析: {}", batchNos);

        List<Map<String, Object>> batchDataList = new ArrayList<>();
        Map<String, Object> summary = new HashMap<>();

        for (String batchNo : batchNos) {
            Map<String, Object> batchData = analyzeSingleBatch(batchNo);
            batchDataList.add(batchData);
        }

        summary.put("batchCount", batchNos.size());
        summary.put("batchData", batchDataList);

        Map<String, Object> avgMetrics = calculateAverageMetrics(batchDataList);
        summary.put("averageMetrics", avgMetrics);

        Map<String, Object> comparisons = findBestAndWorst(batchDataList);
        summary.put("comparisons", comparisons);

        Map<String, Object> chartData = generateChartData(batchDataList);
        summary.put("chartData", chartData);

        return Result.success(summary);
    }

    private Map<String, Object> analyzeSingleBatch(String batchNo) {
        Map<String, Object> result = new HashMap<>();
        result.put("batchNo", batchNo);

        LambdaQueryWrapper<ProcessLog> processWrapper = new LambdaQueryWrapper<>();
        processWrapper.eq(ProcessLog::getBatchNo, batchNo);
        processWrapper.orderByAsc(ProcessLog::getCreateTime);
        List<ProcessLog> logs = processLogMapper.selectList(processWrapper);

        long completedCount = logs.stream().filter(p -> "COMPLETED".equals(p.getStatus())).count();
        result.put("completedProcess", completedCount);
        result.put("totalProcess", 8);
        result.put("progress", completedCount * 100.0 / 8);

        long abnormalCount = logs.stream().filter(p -> "ABNORMAL".equals(p.getAbnormalFlag())).count();
        result.put("abnormalCount", abnormalCount);
        result.put("abnormalRate", logs.size() > 0 ? abnormalCount * 100.0 / logs.size() : 0);

        long totalDurationMinutes = 0;
        Set<String> craftsmen = new HashSet<>();
        for (ProcessLog log : logs) {
            if (log.getCraftsmanName() != null) {
                craftsmen.add(log.getCraftsmanName());
            }
            if (log.getStartTime() != null && log.getEndTime() != null) {
                Duration duration = Duration.between(log.getStartTime(), log.getEndTime());
                totalDurationMinutes += duration.toMinutes();
            }
        }
        result.put("totalDurationMinutes", totalDurationMinutes);
        result.put("craftsmanCount", craftsmen.size());

        LambdaQueryWrapper<QualityReport> qualityWrapper = new LambdaQueryWrapper<>();
        qualityWrapper.eq(QualityReport::getBatchNo, batchNo);
        qualityWrapper.orderByDesc(QualityReport::getInspectTime);
        qualityWrapper.last("LIMIT 1");
        QualityReport report = qualityReportMapper.selectOne(qualityWrapper);

        if (report != null) {
            result.put("qualityLevel", report.getQualityLevel());
            result.put("thickness", report.getThickness());
            result.put("density", report.getDensity());
            result.put("tensileStrength", report.getTensileStrength());
            result.put("whiteness", report.getWhiteness());

            int score = calculateQualityScore(report);
            result.put("qualityScore", score);
        } else {
            result.put("qualityLevel", "未检测");
            result.put("qualityScore", 0);
        }

        return result;
    }

    private int calculateQualityScore(QualityReport report) {
        int score = 0;

        if (report.getThickness() != null) {
            BigDecimal val = report.getThickness();
            if (val.compareTo(new BigDecimal("0.08")) >= 0 && val.compareTo(new BigDecimal("0.15")) <= 0) {
                score += 25;
            } else if (val.compareTo(new BigDecimal("0.05")) >= 0 && val.compareTo(new BigDecimal("0.2")) <= 0) {
                score += 15;
            }
        }

        if (report.getDensity() != null) {
            BigDecimal val = report.getDensity();
            if (val.compareTo(new BigDecimal("0.6")) >= 0 && val.compareTo(new BigDecimal("0.8")) <= 0) {
                score += 25;
            } else if (val.compareTo(new BigDecimal("0.5")) >= 0 && val.compareTo(new BigDecimal("0.9")) <= 0) {
                score += 15;
            }
        }

        if (report.getTensileStrength() != null && report.getTensileStrength().compareTo(new BigDecimal("30")) >= 0) {
            score += 25;
        }

        if (report.getWhiteness() != null && report.getWhiteness().compareTo(new BigDecimal("80")) >= 0) {
            score += 25;
        }

        return score;
    }

    private Map<String, Object> calculateAverageMetrics(List<Map<String, Object>> batchDataList) {
        Map<String, Object> avg = new HashMap<>();

        double avgProgress = batchDataList.stream()
                .mapToDouble(b -> ((Number) b.getOrDefault("progress", 0)).doubleValue())
                .average().orElse(0);

        double avgQualityScore = batchDataList.stream()
                .mapToDouble(b -> ((Number) b.getOrDefault("qualityScore", 0)).doubleValue())
                .average().orElse(0);

        double avgAbnormalRate = batchDataList.stream()
                .mapToDouble(b -> ((Number) b.getOrDefault("abnormalRate", 0)).doubleValue())
                .average().orElse(0);

        double avgDuration = batchDataList.stream()
                .mapToDouble(b -> ((Number) b.getOrDefault("totalDurationMinutes", 0)).doubleValue())
                .average().orElse(0);

        avg.put("avgProgress", Math.round(avgProgress * 100.0) / 100.0);
        avg.put("avgQualityScore", Math.round(avgQualityScore * 100.0) / 100.0);
        avg.put("avgAbnormalRate", Math.round(avgAbnormalRate * 100.0) / 100.0);
        avg.put("avgDurationMinutes", Math.round(avgDuration * 100.0) / 100.0);

        return avg;
    }

    private Map<String, Object> findBestAndWorst(List<Map<String, Object>> batchDataList) {
        Map<String, Object> result = new HashMap<>();

        if (batchDataList.isEmpty()) {
            return result;
        }

        Map<String, Object> bestQuality = Collections.max(batchDataList,
                Comparator.comparingDouble(b -> ((Number) b.getOrDefault("qualityScore", 0)).doubleValue()));
        result.put("bestQualityBatch", bestQuality.get("batchNo"));
        result.put("bestQualityScore", bestQuality.get("qualityScore"));

        Map<String, Object> bestProgress = Collections.max(batchDataList,
                Comparator.comparingDouble(b -> ((Number) b.getOrDefault("progress", 0)).doubleValue()));
        result.put("bestProgressBatch", bestProgress.get("batchNo"));
        result.put("bestProgressRate", bestProgress.get("progress"));

        Map<String, Object> lowestAbnormal = Collections.min(batchDataList,
                Comparator.comparingDouble(b -> ((Number) b.getOrDefault("abnormalRate", 100)).doubleValue()));
        result.put("lowestAbnormalBatch", lowestAbnormal.get("batchNo"));
        result.put("lowestAbnormalRate", lowestAbnormal.get("abnormalRate"));

        return result;
    }

    private Map<String, Object> generateChartData(List<Map<String, Object>> batchDataList) {
        Map<String, Object> chartData = new HashMap<>();

        List<String> labels = batchDataList.stream()
                .map(b -> (String) b.get("batchNo"))
                .collect(Collectors.toList());
        chartData.put("labels", labels);

        List<Double> progressData = batchDataList.stream()
                .map(b -> ((Number) b.getOrDefault("progress", 0)).doubleValue())
                .collect(Collectors.toList());
        chartData.put("progressData", progressData);

        List<Integer> qualityData = batchDataList.stream()
                .map(b -> ((Number) b.getOrDefault("qualityScore", 0)).intValue())
                .collect(Collectors.toList());
        chartData.put("qualityData", qualityData);

        List<Double> abnormalData = batchDataList.stream()
                .map(b -> ((Number) b.getOrDefault("abnormalRate", 0)).doubleValue())
                .collect(Collectors.toList());
        chartData.put("abnormalData", abnormalData);

        List<Double> durationData = batchDataList.stream()
                .map(b -> ((Number) b.getOrDefault("totalDurationMinutes", 0)).doubleValue())
                .collect(Collectors.toList());
        chartData.put("durationData", durationData);

        return chartData;
    }
}
