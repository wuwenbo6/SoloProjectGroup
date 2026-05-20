package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.QualityReport;
import com.papermanagement.mapper.QualityReportMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Service
public class QualityService {

    private static final Logger logger = LoggerFactory.getLogger(QualityService.class);

    private static final BigDecimal THICKNESS_MIN = new BigDecimal("0.08");
    private static final BigDecimal THICKNESS_MAX = new BigDecimal("0.15");
    private static final BigDecimal DENSITY_MIN = new BigDecimal("0.6");
    private static final BigDecimal DENSITY_MAX = new BigDecimal("0.8");
    private static final BigDecimal TENSILE_STRENGTH_MIN = new BigDecimal("30");
    private static final BigDecimal WHITENESS_GOOD = new BigDecimal("80");
    private static final BigDecimal WHITENESS_EXCELLENT = new BigDecimal("88");

    @Autowired
    private QualityReportMapper qualityReportMapper;

    public Result<QualityReport> createReport(QualityReport report) {
        report.setReportNo("QR" + System.currentTimeMillis());
        report.setInspectTime(LocalDateTime.now());
        report.setQualityLevel(judgeQualityLevel(report));
        report.setResult("FAIL".equals(report.getQualityLevel()) ? "FAIL" : "PASS");
        qualityReportMapper.insert(report);
        logger.info("质检报告创建成功，批次号: {}, 质量等级: {}", report.getBatchNo(), report.getQualityLevel());
        return Result.success("质检报告创建成功", report);
    }

    private String judgeQualityLevel(QualityReport report) {
        BigDecimal totalScore = BigDecimal.ZERO;

        BigDecimal thicknessScore = calculateThicknessScore(report.getThickness());
        BigDecimal densityScore = calculateDensityScore(report.getDensity());
        BigDecimal tensileScore = calculateTensileStrengthScore(report.getTensileStrength());
        BigDecimal whitenessScore = calculateWhitenessScore(report.getWhiteness());
        BigDecimal fiberScore = calculateFiberRatioScore(
                report.getFiberRatioBamboo(),
                report.getFiberRatioWood(),
                report.getFiberRatioHemp(),
                report.getFiberRatioCotton()
        );

        totalScore = totalScore.add(thicknessScore)
                .add(densityScore)
                .add(tensileScore)
                .add(whitenessScore)
                .add(fiberScore);

        int finalScore = totalScore.setScale(0, RoundingMode.HALF_UP).intValue();

        logger.debug("质量评分计算: 厚度={}, 密度={}, 抗张强度={}, 白度={}, 纤维配比={}, 总分={}",
                thicknessScore, densityScore, tensileScore, whitenessScore, fiberScore, finalScore);

        if (finalScore >= 90) return "EXCELLENT";
        if (finalScore >= 75) return "GOOD";
        if (finalScore >= 60) return "PASS";
        return "FAIL";
    }

    private BigDecimal calculateThicknessScore(BigDecimal thickness) {
        if (thickness == null) return BigDecimal.ZERO;

        if (thickness.compareTo(THICKNESS_MIN) >= 0 && thickness.compareTo(THICKNESS_MAX) <= 0) {
            return new BigDecimal("20");
        } else if (thickness.compareTo(new BigDecimal("0.05")) >= 0 && thickness.compareTo(new BigDecimal("0.2")) <= 0) {
            return new BigDecimal("15");
        }
        return new BigDecimal("10");
    }

    private BigDecimal calculateDensityScore(BigDecimal density) {
        if (density == null) return BigDecimal.ZERO;

        if (density.compareTo(DENSITY_MIN) >= 0 && density.compareTo(DENSITY_MAX) <= 0) {
            return new BigDecimal("20");
        } else if (density.compareTo(new BigDecimal("0.5")) >= 0 && density.compareTo(new BigDecimal("0.9")) <= 0) {
            return new BigDecimal("15");
        }
        return new BigDecimal("10");
    }

    private BigDecimal calculateTensileStrengthScore(BigDecimal tensileStrength) {
        if (tensileStrength == null) return BigDecimal.ZERO;

        if (tensileStrength.compareTo(new BigDecimal("50")) >= 0) {
            return new BigDecimal("20");
        } else if (tensileStrength.compareTo(TENSILE_STRENGTH_MIN) >= 0) {
            return new BigDecimal("15");
        } else if (tensileStrength.compareTo(new BigDecimal("20")) >= 0) {
            return new BigDecimal("10");
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal calculateWhitenessScore(BigDecimal whiteness) {
        if (whiteness == null) return BigDecimal.ZERO;

        if (whiteness.compareTo(WHITENESS_EXCELLENT) >= 0) {
            return new BigDecimal("20");
        } else if (whiteness.compareTo(WHITENESS_GOOD) >= 0) {
            return new BigDecimal("15");
        } else if (whiteness.compareTo(new BigDecimal("70")) >= 0) {
            return new BigDecimal("10");
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal calculateFiberRatioScore(BigDecimal bamboo, BigDecimal wood, BigDecimal hemp, BigDecimal cotton) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal bambooRatio = bamboo != null ? bamboo : BigDecimal.ZERO;
        BigDecimal woodRatio = wood != null ? wood : BigDecimal.ZERO;
        BigDecimal hempRatio = hemp != null ? hemp : BigDecimal.ZERO;
        BigDecimal cottonRatio = cotton != null ? cotton : BigDecimal.ZERO;

        total = total.add(bambooRatio).add(woodRatio).add(hempRatio).add(cottonRatio);

        if (total.compareTo(BigDecimal.ZERO) == 0) {
            return new BigDecimal("10");
        }

        BigDecimal bambooPercent = bambooRatio.divide(total, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        BigDecimal score = BigDecimal.ZERO;

        if (bambooPercent.compareTo(new BigDecimal("60")) >= 0) {
            score = score.add(new BigDecimal("20"));
        } else if (bambooPercent.compareTo(new BigDecimal("40")) >= 0) {
            score = score.add(new BigDecimal("15"));
        } else if (bambooPercent.compareTo(new BigDecimal("20")) >= 0) {
            score = score.add(new BigDecimal("10"));
        }

        BigDecimal hempPercent = hempRatio.divide(total, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        if (hempPercent.compareTo(new BigDecimal("20")) >= 0) {
            score = score.add(new BigDecimal("5"));
        }

        return score.min(new BigDecimal("20"));
    }

    public Result<IPage<QualityReport>> getReportList(Integer page, Integer size, String batchNo, String qualityLevel) {
        Page<QualityReport> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<QualityReport> wrapper = new LambdaQueryWrapper<>();
        if (batchNo != null && !batchNo.isEmpty()) {
            wrapper.eq(QualityReport::getBatchNo, batchNo);
        }
        if (qualityLevel != null && !qualityLevel.isEmpty()) {
            wrapper.eq(QualityReport::getQualityLevel, qualityLevel);
        }
        wrapper.orderByDesc(QualityReport::getCreateTime);
        IPage<QualityReport> result = qualityReportMapper.selectPage(pageParam, wrapper);
        return Result.success(result);
    }

    public Result<QualityReport> getReportById(Long id) {
        QualityReport report = qualityReportMapper.selectById(id);
        if (report == null) {
            return Result.error("质检报告不存在");
        }
        return Result.success(report);
    }
}
