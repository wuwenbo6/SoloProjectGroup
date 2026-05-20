package com.ancientbook.detection.service;

import com.ancientbook.detection.dto.DetectionTrendDTO;
import com.ancientbook.detection.dto.OrgComparisonDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DetectionComparisonService {

    private final Map<String, Map<String, Object>> orgDataStore = new ConcurrentHashMap<>();

    private static final String[] ORG_CODES = {"TEST_ORG_001", "TEST_ORG_002", "TEST_ORG_003", "TEST_ORG_004"};
    private static final String[] ORG_NAMES = {"国家图书馆古籍检测中心", "故宫博物院文保科技部", "上海图书馆文献保护中心", "南京博物院文物检测所"};
    private static final String[] DAMAGE_TYPES = {"虫蛀", "酸化", "霉斑", "破损", "折痕", "水渍"};

    public void initMockData() {
        Random random = new Random();

        for (int i = 0; i < ORG_CODES.length; i++) {
            Map<String, Object> orgData = new LinkedHashMap<>();
            orgData.put("orgCode", ORG_CODES[i]);
            orgData.put("orgName", ORG_NAMES[i]);

            List<Map<String, Object>> reports = new ArrayList<>();
            for (int j = 0; j < 50 + random.nextInt(100); j++) {
                Map<String, Object> report = new LinkedHashMap<>();
                report.put("reportId", "RPT_" + System.currentTimeMillis() + "_" + j);
                report.put("bookCode", "BOOK_" + (1000 + random.nextInt(500)));
                report.put("bookType", new String[]{"古籍善本", "手抄本", "刻本", "版画"}[random.nextInt(4)]);
                report.put("phValue", 5.5 + random.nextDouble() * 3.0);
                report.put("agingLevel", 1 + random.nextInt(4));
                report.put("damageType", DAMAGE_TYPES[random.nextInt(DAMAGE_TYPES.length)]);
                report.put("reportTime", LocalDateTime.now().minusDays(random.nextInt(90)));
                report.put("processingDays", 1 + random.nextInt(14));
                report.put("satisfactionScore", 70 + random.nextInt(31));
                reports.add(report);
            }
            orgData.put("reports", reports);
            orgDataStore.put(ORG_CODES[i], orgData);
        }

        log.info("初始化检测机构模拟数据完成，共{}个机构", ORG_CODES.length);
    }

    public List<OrgComparisonDTO> getOrgComparison() {
        if (orgDataStore.isEmpty()) {
            initMockData();
        }

        List<OrgComparisonDTO> comparisonList = new ArrayList<>();
        YearMonth thisMonth = YearMonth.now();
        YearMonth lastMonth = thisMonth.minusMonths(1);

        for (int i = 0; i < ORG_CODES.length; i++) {
            String orgCode = ORG_CODES[i];
            Map<String, Object> orgData = orgDataStore.get(orgCode);

            if (orgData == null) continue;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> reports = (List<Map<String, Object>>) orgData.get("reports");

            OrgComparisonDTO dto = new OrgComparisonDTO();
            dto.setOrgCode(orgCode);
            dto.setOrgName(ORG_NAMES[i]);
            dto.setTotalReports((long) reports.size());

            LocalDateTime thisMonthStart = thisMonth.atDay(1).atStartOfDay();
            LocalDateTime thisMonthEnd = thisMonth.atEndOfMonth().atTime(LocalTime.MAX);
            LocalDateTime lastMonthStart = lastMonth.atDay(1).atStartOfDay();
            LocalDateTime lastMonthEnd = lastMonth.atEndOfMonth().atTime(LocalTime.MAX);

            long thisMonthCount = reports.stream()
                    .filter(r -> isInPeriod((LocalDateTime) r.get("reportTime"), thisMonthStart, thisMonthEnd))
                    .count();
            long lastMonthCount = reports.stream()
                    .filter(r -> isInPeriod((LocalDateTime) r.get("reportTime"), lastMonthStart, lastMonthEnd))
                    .count();

            dto.setThisMonthReports(thisMonthCount);
            dto.setLastMonthReports(lastMonthCount);

            if (lastMonthCount > 0) {
                double growthRate = (double) (thisMonthCount - lastMonthCount) / lastMonthCount * 100;
                dto.setMonthGrowthRate(Math.round(growthRate * 10) / 10.0);
            } else {
                dto.setMonthGrowthRate(thisMonthCount > 0 ? 100.0 : 0.0);
            }

            Double avgPh = reports.stream()
                    .mapToDouble(r -> (Double) r.get("phValue"))
                    .average()
                    .orElse(0.0);
            dto.setAvgPhValue(BigDecimal.valueOf(avgPh).setScale(2, RoundingMode.HALF_UP));

            Double avgAging = reports.stream()
                    .mapToInt(r -> (Integer) r.get("agingLevel"))
                    .average()
                    .orElse(0.0);
            dto.setAvgAgingLevel(BigDecimal.valueOf(avgAging).setScale(2, RoundingMode.HALF_UP));

            dto.setTotalDamages((long) reports.size());

            Map<String, Long> damageDist = reports.stream()
                    .collect(Collectors.groupingBy(r -> (String) r.get("damageType"), Collectors.counting()));
            dto.setDamageTypeDistribution(damageDist);

            dto.setBookCount(reports.stream().map(r -> r.get("bookCode")).distinct().count());

            List<String> bookTypes = reports.stream()
                    .map(r -> (String) r.get("bookType"))
                    .distinct()
                    .collect(Collectors.toList());
            dto.setBookTypes(bookTypes);

            Double avgDays = reports.stream()
                    .mapToInt(r -> (Integer) r.get("processingDays"))
                    .average()
                    .orElse(0.0);
            dto.setAvgProcessingDays(Math.round(avgDays));

            Double avgScore = reports.stream()
                    .mapToInt(r -> (Integer) r.get("satisfactionScore"))
                    .average()
                    .orElse(0.0);
            dto.setSatisfactionScore(BigDecimal.valueOf(avgScore).setScale(1, RoundingMode.HALF_UP));

            List<Map<String, Object>> qualityMetrics = new ArrayList<>();
            qualityMetrics.add(createMetric("准确率", 95 + random.nextInt(6), "%"));
            qualityMetrics.add(createMetric("及时率", 88 + random.nextInt(13), "%"));
            qualityMetrics.add(createMetric("报告完整度", 92 + random.nextInt(9), "%"));
            dto.setQualityMetrics(qualityMetrics);

            comparisonList.add(dto);
        }

        comparisonList.sort((a, b) -> b.getTotalReports().compareTo(a.getTotalReports()));
        for (int i = 0; i < comparisonList.size(); i++) {
            comparisonList.get(i).setRanking(i + 1);
        }

        return comparisonList;
    }

    public List<DetectionTrendDTO> getDetectionTrend(int months) {
        if (orgDataStore.isEmpty()) {
            initMockData();
        }

        List<DetectionTrendDTO> trendList = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = YearMonth.from(today.minusMonths(i));
            LocalDateTime monthStart = ym.atDay(1).atStartOfDay();
            LocalDateTime monthEnd = ym.atEndOfMonth().atTime(LocalTime.MAX);

            DetectionTrendDTO trend = new DetectionTrendDTO();
            trend.setPeriod(ym.toString());
            trend.setPeriodName(ym.getMonthValue() + "月");

            Map<String, Long> orgReportCounts = new LinkedHashMap<>();
            Map<String, BigDecimal> orgAvgPhValues = new LinkedHashMap<>();
            Map<String, BigDecimal> orgAvgAgingLevels = new LinkedHashMap<>();

            long totalReports = 0;
            double totalPh = 0;
            double totalAging = 0;
            int phCount = 0;
            int agingCount = 0;

            for (int j = 0; j < ORG_CODES.length; j++) {
                String orgCode = ORG_CODES[j];
                Map<String, Object> orgData = orgDataStore.get(orgCode);

                if (orgData == null) continue;

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> reports = (List<Map<String, Object>>) orgData.get("reports");

                List<Map<String, Object>> monthReports = reports.stream()
                        .filter(r -> isInPeriod((LocalDateTime) r.get("reportTime"), monthStart, monthEnd))
                        .collect(Collectors.toList());

                orgReportCounts.put(ORG_NAMES[j], (long) monthReports.size());
                totalReports += monthReports.size();

                if (!monthReports.isEmpty()) {
                    Double avgPh = monthReports.stream()
                            .mapToDouble(r -> (Double) r.get("phValue"))
                            .average()
                            .orElse(0.0);
                    orgAvgPhValues.put(ORG_NAMES[j], BigDecimal.valueOf(avgPh).setScale(2, RoundingMode.HALF_UP));
                    totalPh += avgPh * monthReports.size();
                    phCount += monthReports.size();

                    Double avgAging = monthReports.stream()
                            .mapToInt(r -> (Integer) r.get("agingLevel"))
                            .average()
                            .orElse(0.0);
                    orgAvgAgingLevels.put(ORG_NAMES[j], BigDecimal.valueOf(avgAging).setScale(2, RoundingMode.HALF_UP));
                    totalAging += avgAging * monthReports.size();
                    agingCount += monthReports.size();
                }
            }

            trend.setOrgReportCounts(orgReportCounts);
            trend.setOrgAvgPhValues(orgAvgPhValues);
            trend.setOrgAvgAgingLevels(orgAvgAgingLevels);
            trend.setTotalReports(totalReports);

            if (phCount > 0) {
                trend.setOverallAvgPh(BigDecimal.valueOf(totalPh / phCount).setScale(2, RoundingMode.HALF_UP));
            }
            if (agingCount > 0) {
                trend.setOverallAvgAging(BigDecimal.valueOf(totalAging / agingCount).setScale(2, RoundingMode.HALF_UP));
            }

            trendList.add(trend);
        }

        return trendList;
    }

    public Map<String, Object> getOrgDetail(String orgCode) {
        if (orgDataStore.isEmpty()) {
            initMockData();
        }

        Map<String, Object> orgData = orgDataStore.get(orgCode);
        if (orgData == null) {
            throw new RuntimeException("检测机构不存在");
        }

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("orgCode", orgData.get("orgCode"));
        detail.put("orgName", orgData.get("orgName"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> reports = (List<Map<String, Object>>) orgData.get("reports");

        detail.put("totalReports", reports.size());
        detail.put("totalBooks", reports.stream().map(r -> r.get("bookCode")).distinct().count());

        Map<String, Long> bookTypeStats = reports.stream()
                .collect(Collectors.groupingBy(r -> (String) r.get("bookType"), Collectors.counting()));
        detail.put("bookTypeDistribution", bookTypeStats);

        Map<String, Long> damageStats = reports.stream()
                .collect(Collectors.groupingBy(r -> (String) r.get("damageType"), Collectors.counting()));
        detail.put("damageTypeDistribution", damageStats);

        Double avgPh = reports.stream()
                .mapToDouble(r -> (Double) r.get("phValue"))
                .average()
                .orElse(0.0);
        detail.put("avgPhValue", BigDecimal.valueOf(avgPh).setScale(2, RoundingMode.HALF_UP));

        Double avgScore = reports.stream()
                .mapToInt(r -> (Integer) r.get("satisfactionScore"))
                .average()
                .orElse(0.0);
        detail.put("avgSatisfactionScore", BigDecimal.valueOf(avgScore).setScale(1, RoundingMode.HALF_UP));

        return detail;
    }

    public Map<String, Object> getComparisonSummary() {
        if (orgDataStore.isEmpty()) {
            initMockData();
        }

        Map<String, Object> summary = new LinkedHashMap<>();

        long totalAllReports = 0;
        double totalAllPh = 0;
        int phCount = 0;
        Map<String, Long> allDamageTypes = new HashMap<>();

        for (String orgCode : ORG_CODES) {
            Map<String, Object> orgData = orgDataStore.get(orgCode);
            if (orgData == null) continue;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> reports = (List<Map<String, Object>>) orgData.get("reports");

            totalAllReports += reports.size();

            for (Map<String, Object> report : reports) {
                totalAllPh += (Double) report.get("phValue");
                phCount++;

                String damageType = (String) report.get("damageType");
                allDamageTypes.put(damageType, allDamageTypes.getOrDefault(damageType, 0L) + 1);
            }
        }

        summary.put("totalOrgs", ORG_CODES.length);
        summary.put("totalAllReports", totalAllReports);

        if (phCount > 0) {
            summary.put("overallAvgPh", BigDecimal.valueOf(totalAllPh / phCount).setScale(2, RoundingMode.HALF_UP));
        }

        summary.put("overallDamageDistribution", allDamageTypes);

        List<Map<String, Object>> orgRanking = new ArrayList<>();
        for (int i = 0; i < ORG_CODES.length; i++) {
            Map<String, Object> org = new LinkedHashMap<>();
            org.put("rank", i + 1);
            org.put("orgCode", ORG_CODES[i]);
            org.put("orgName", ORG_NAMES[i]);
            orgRanking.add(org);
        }
        summary.put("orgRanking", orgRanking);

        return summary;
    }

    private Map<String, Object> createMetric(String name, int value, String unit) {
        Map<String, Object> metric = new LinkedHashMap<>();
        metric.put("name", name);
        metric.put("value", value);
        metric.put("unit", unit);
        return metric;
    }

    private boolean isInPeriod(LocalDateTime time, LocalDateTime start, LocalDateTime end) {
        if (time == null) return false;
        return !time.isBefore(start) && !time.isAfter(end);
    }
}
