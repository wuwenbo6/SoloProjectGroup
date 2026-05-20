package com.ancientbook.detection.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;

@Data
public class DetectionTrendDTO {

    private String period;

    private String periodName;

    private Map<String, Long> orgReportCounts;

    private Map<String, BigDecimal> orgAvgPhValues;

    private Map<String, BigDecimal> orgAvgAgingLevels;

    private Long totalReports;

    private BigDecimal overallAvgPh;

    private BigDecimal overallAvgAging;
}
