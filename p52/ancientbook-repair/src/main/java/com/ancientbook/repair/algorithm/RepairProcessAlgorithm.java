package com.ancientbook.repair.algorithm;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Component
public class RepairProcessAlgorithm {

    private final Map<String, ProcessWeightConfig> weightConfigMap = new ConcurrentHashMap<>();
    private final Map<String, ProcessHistory> historyDataMap = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Double>> processSimilarityCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        initWeightConfigs();
        initMockHistoryData();
        log.info("修复工艺推荐算法初始化完成，配置项: {}, 历史数据: {}",
                weightConfigMap.size(), historyDataMap.size());
    }

    private void initWeightConfigs() {
        weightConfigMap.put("破损类型", new ProcessWeightConfig("破损类型", 0.25, 0.30));
        weightConfigMap.put("材质类型", new ProcessWeightConfig("材质类型", 0.20, 0.25));
        weightConfigMap.put("破损程度", new ProcessWeightConfig("破损程度", 0.15, 0.20));
        weightConfigMap.put("纸张年代", new ProcessWeightConfig("纸张年代", 0.10, 0.15));
        weightConfigMap.put("善本级别", new ProcessWeightConfig("善本级别", 0.10, 0.15));
        weightConfigMap.put("修复人员技能", new ProcessWeightConfig("修复人员技能", 0.10, 0.10));
        weightConfigMap.put("历史成功率", new ProcessWeightConfig("历史成功率", 0.05, 0.10));
        weightConfigMap.put("修复成本", new ProcessWeightConfig("修复成本", 0.05, 0.05));
    }

    private void initMockHistoryData() {
        List<String> processes = List.of(
                "脱酸处理", "纸张修补", "托裱修复", "装订加固",
                "污渍清洗", "字迹恢复", "虫洞修补", "折痕修复",
                "霉菌清除", "纸张加固", "装帧修复", "数字化扫描"
        );

        List<String> damageTypes = List.of("虫蛀", "酸化", "霉斑", "破损", "折痕", "水渍", "撕裂", "老化");
        List<String> materials = List.of("宣纸", "皮纸", "竹纸", "麻纸", "藤纸", "棉纸");

        for (String process : processes) {
            ProcessHistory history = new ProcessHistory();
            history.setProcessId(process.hashCode() + "");
            history.setProcessName(process);
            history.setTotalUsage(new Random().nextInt(1000) + 100);
            history.setSuccessRate(0.85 + new Random().nextDouble() * 0.14);
            history.setAvgDuration(30 + new Random().nextInt(120));
            history.setAvgCost(500 + new Random().nextInt(3000));

            Map<String, Double> damageScores = new HashMap<>();
            for (String damage : damageTypes) {
                damageScores.put(damage, 0.3 + new Random().nextDouble() * 0.7);
            }
            history.setDamageTypeScores(damageScores);

            Map<String, Double> materialScores = new HashMap<>();
            for (String material : materials) {
                materialScores.put(material, 0.3 + new Random().nextDouble() * 0.7);
            }
            history.setMaterialScores(materialScores);

            historyDataMap.put(process, history);
        }
    }

    public List<ProcessRecommendation> recommend(RepairContext context) {
        long startTime = System.currentTimeMillis();
        log.info("开始修复工艺推荐，上下文: {}", context);

        List<ProcessRecommendation> recommendations = new ArrayList<>();

        for (Map.Entry<String, ProcessHistory> entry : historyDataMap.entrySet()) {
            String processName = entry.getKey();
            ProcessHistory history = entry.getValue();

            double totalScore = calculateTotalScore(context, history);
            ProcessRecommendation recommendation = new ProcessRecommendation();
            recommendation.setProcessId(history.getProcessId());
            recommendation.setProcessName(processName);
            recommendation.setScore(totalScore);
            recommendation.setConfidence(calculateConfidence(totalScore));
            recommendation.setSuccessRate(history.getSuccessRate());
            recommendation.setEstimatedDuration(history.getAvgDuration());
            recommendation.setEstimatedCost(history.getAvgCost());
            recommendation.setRankFactors(calculateRankFactors(context, history));
            recommendations.add(recommendation);
        }

        recommendations.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
        for (int i = 0; i < recommendations.size(); i++) {
            recommendations.get(i).setRank(i + 1);
        }

        long endTime = System.currentTimeMillis();
        log.info("修复工艺推荐完成，耗时: {}ms，推荐数量: {}", endTime - startTime, recommendations.size());

        return recommendations.stream()
                .filter(r -> r.getScore() >= 0.3)
                .limit(6)
                .collect(Collectors.toList());
    }

    private double calculateTotalScore(RepairContext context, ProcessHistory history) {
        double totalScore = 0;

        for (Map.Entry<String, ProcessWeightConfig> entry : weightConfigMap.entrySet()) {
            String factor = entry.getKey();
            ProcessWeightConfig config = entry.getValue();
            double factorScore = calculateFactorScore(factor, context, history);
            double weightedScore = factorScore * config.getWeight();
            totalScore += weightedScore;
        }

        return Math.min(1.0, totalScore);
    }

    private double calculateFactorScore(String factor, RepairContext context, ProcessHistory history) {
        return switch (factor) {
            case "破损类型" -> history.getDamageTypeScores().getOrDefault(context.getDamageType(), 0.3);
            case "材质类型" -> history.getMaterialScores().getOrDefault(context.getMaterialType(), 0.3);
            case "破损程度" -> calculateSeverityScore(context.getDamageSeverity());
            case "纸张年代" -> calculateAgeScore(context.getPaperAge());
            case "善本级别" -> calculateLevelScore(context.getRarebookLevel());
            case "修复人员技能" -> calculateSkillScore(context.getWorkerSkillLevel());
            case "历史成功率" -> history.getSuccessRate();
            case "修复成本" -> calculateCostScore(history.getAvgCost());
            default -> 0.5;
        };
    }

    private double calculateSeverityScore(String severity) {
        return switch (severity) {
            case "轻微" -> 0.9;
            case "中等" -> 0.7;
            case "严重" -> 0.5;
            case "极重" -> 0.3;
            default -> 0.5;
        };
    }

    private double calculateAgeScore(String age) {
        return switch (age) {
            case "唐宋" -> 0.95;
            case "元明" -> 0.90;
            case "清代" -> 0.80;
            case "民国" -> 0.70;
            case "现代" -> 0.60;
            default -> 0.70;
        };
    }

    private double calculateLevelScore(String level) {
        return switch (level) {
            case "国宝级" -> 0.95;
            case "一级" -> 0.90;
            case "二级" -> 0.80;
            case "三级" -> 0.70;
            case "普通" -> 0.60;
            default -> 0.70;
        };
    }

    private double calculateSkillScore(String skillLevel) {
        return switch (skillLevel) {
            case "专家级" -> 0.95;
            case "高级" -> 0.85;
            case "中级" -> 0.70;
            case "初级" -> 0.50;
            default -> 0.70;
        };
    }

    private double calculateCostScore(double cost) {
        if (cost <= 1000) return 1.0;
        if (cost <= 2000) return 0.9;
        if (cost <= 3000) return 0.8;
        if (cost <= 5000) return 0.7;
        return 0.5;
    }

    private String calculateConfidence(double score) {
        if (score >= 0.85) return "极高";
        if (score >= 0.70) return "高";
        if (score >= 0.50) return "中等";
        if (score >= 0.30) return "低";
        return "极低";
    }

    private List<String> calculateRankFactors(RepairContext context, ProcessHistory history) {
        List<String> factors = new ArrayList<>();

        if (history.getDamageTypeScores().getOrDefault(context.getDamageType(), 0.0) >= 0.7) {
            factors.add("匹配破损类型");
        }
        if (history.getMaterialScores().getOrDefault(context.getMaterialType(), 0.0) >= 0.7) {
            factors.add("匹配纸张材质");
        }
        if (history.getSuccessRate() >= 0.9) {
            factors.add("历史成功率高");
        }
        if (history.getAvgCost() <= 1500) {
            factors.add("修复成本低");
        }

        return factors;
    }

    public AlgorithmPerformance getPerformanceStats() {
        AlgorithmPerformance performance = new AlgorithmPerformance();
        performance.setTotalProcesses(historyDataMap.size());
        performance.setWeightConfigs(weightConfigMap.size());

        double avgSuccessRate = historyDataMap.values().stream()
                .mapToDouble(ProcessHistory::getSuccessRate)
                .average()
                .orElse(0);
        performance.setAvgSuccessRate(avgSuccessRate);

        double avgCost = historyDataMap.values().stream()
                .mapToDouble(ProcessHistory::getAvgCost)
                .average()
                .orElse(0);
        performance.setAvgCost(avgCost);

        long totalUsage = historyDataMap.values().stream()
                .mapToLong(ProcessHistory::getTotalUsage)
                .sum();
        performance.setTotalUsage(totalUsage);

        return performance;
    }

    public List<ProcessHistory> getAllProcessHistory() {
        return new ArrayList<>(historyDataMap.values());
    }

    @Data
    public static class ProcessWeightConfig {
        private String factorName;
        private double weight;
        private double maxWeight;

        public ProcessWeightConfig(String factorName, double weight, double maxWeight) {
            this.factorName = factorName;
            this.weight = weight;
            this.maxWeight = maxWeight;
        }
    }

    @Data
    public static class ProcessHistory {
        private String processId;
        private String processName;
        private long totalUsage;
        private double successRate;
        private int avgDuration;
        private double avgCost;
        private Map<String, Double> damageTypeScores;
        private Map<String, Double> materialScores;
    }

    @Data
    public static class RepairContext {
        private String damageType;
        private String materialType;
        private String damageSeverity;
        private String paperAge;
        private String rarebookLevel;
        private String workerSkillLevel;
        private double budget;
    }

    @Data
    public static class ProcessRecommendation {
        private String processId;
        private String processName;
        private int rank;
        private double score;
        private String confidence;
        private double successRate;
        private int estimatedDuration;
        private double estimatedCost;
        private List<String> rankFactors;
    }

    @Data
    public static class AlgorithmPerformance {
        private int totalProcesses;
        private int weightConfigs;
        private double avgSuccessRate;
        private double avgCost;
        private long totalUsage;
    }
}
