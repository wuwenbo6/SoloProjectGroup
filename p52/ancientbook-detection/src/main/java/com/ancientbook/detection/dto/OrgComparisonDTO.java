package com.ancientbook.detection.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class OrgComparisonDTO {

    private String orgCode;

    private String orgName;

    private Long totalReports;

    private Long thisMonthReports;

    private Long lastMonthReports;

    private Double monthGrowthRate;

    private BigDecimal avgPhValue;

    private BigDecimal avgAgingLevel;

    private Long totalDamages;

    private Map<String, Long> damageTypeDistribution;

    private Long bookCount;

    private List<String> bookTypes;

    private Long avgProcessingDays;

    private BigDecimal satisfactionScore;

    private Integer ranking;

    private List<Map<String, Object>> qualityMetrics;
}
