package com.ancientbook.process.service;

import com.ancientbook.common.datasource.DataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.process.entity.RepairProcess;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@DataSource(DataSourceType.PROCESS)
public class ProcessRecommendService {

    private final RepairProcessService repairProcessService;

    /**
     * 核心推荐算法 - 修复后的版本
     * 
     * @param conditionLevel 破损等级 (1-4)
     * @param material 纸张材质
     * @return 推荐的工艺列表
     */
    public List<Map<String, Object>> recommendProcesses(Integer conditionLevel, String material) {
        log.info("开始推荐工艺: 破损等级={}, 材质={}", conditionLevel, material);

        List<RepairProcess> allProcesses = repairProcessService.getAllEnabled();
        if (allProcesses.isEmpty()) {
            log.warn("没有可用的修复工艺");
            return Collections.emptyList();
        }

        List<RecommendedProcess> matched = new ArrayList<>();

        for (RepairProcess process : allProcesses) {
            // 修复1: 正确的等级区间判断
            boolean levelMatch = conditionLevel >= process.getMinConditionLevel()
                    && conditionLevel <= process.getMaxConditionLevel();

            if (!levelMatch) {
                log.debug("工艺[{}]等级不匹配: 要求{}-{}, 实际{}",
                        process.getProcessCode(),
                        process.getMinConditionLevel(),
                        process.getMaxConditionLevel(),
                        conditionLevel);
                continue;
            }

            // 修复2: 材料匹配加权计算
            int materialScore = calculateMaterialScore(process.getApplicableMaterials(), material);
            if (materialScore == 0) {
                log.debug("工艺[{}]材料不匹配: 支持{}, 请求{}",
                        process.getProcessCode(),
                        process.getApplicableMaterials(),
                        material);
                continue;
            }

            RecommendedProcess recommended = new RecommendedProcess();
            recommended.setProcess(process);
            recommended.setMatchScore(materialScore);
            recommended.setLevelMatch(true);
            matched.add(recommended);
        }

        // 修复3: 正确的排序逻辑
        // 第一优先级: 匹配分数
        // 第二优先级: 成功率(降序)
        // 第三优先级: 难度等级(升序)
        List<Map<String, Object>> result = matched.stream()
                .sorted(Comparator
                        .comparingInt(RecommendedProcess::getMatchScore).reversed()
                        .thenComparing(r -> r.getProcess().getSuccessRate() != null
                                ? r.getProcess().getSuccessRate()
                                : BigDecimal.ZERO, Comparator.reverseOrder())
                        .thenComparingInt(r -> r.getProcess().getDifficultyLevel() != null
                                ? r.getProcess().getDifficultyLevel()
                                : Integer.MAX_VALUE))
                .map(this::convertToMap)
                .collect(Collectors.toList());

        log.info("推荐完成: 匹配到{}个工艺", result.size());
        return result;
    }

    /**
     * 结合修复人员技能等级的智能推荐
     */
    public List<Map<String, Object>> recommendByBookInfo(
            Integer conditionLevel,
            String material,
            Integer skillLevel) {

        log.info("智能推荐: 破损等级={}, 材质={}, 修复师技能等级={}",
                conditionLevel, material, skillLevel);

        List<Map<String, Object>> baseRecommended = recommendProcesses(conditionLevel, material);
        if (skillLevel == null || skillLevel <= 0) {
            return baseRecommended;
        }

        // 根据技能等级过滤
        return baseRecommended.stream()
                .filter(item -> {
                    Integer difficulty = (Integer) item.get("difficultyLevel");
                    if (difficulty == null) return true;
                    // 技能等级必须 >= 难度等级
                    boolean canOperate = skillLevel >= difficulty;
                    if (!canOperate) {
                        log.debug("过滤工艺[{}]: 难度等级{} > 技能等级{}",
                                item.get("processCode"), difficulty, skillLevel);
                    }
                    return canOperate;
                })
                .collect(Collectors.toList());
    }

    /**
     * 计算材料匹配分数
     */
    private int calculateMaterialScore(String applicableMaterials, String material) {
        if (applicableMaterials == null || material == null) {
            return 1; // 默认低分匹配
        }

        String[] supported = applicableMaterials.split(",");
        String target = material.trim();

        for (String support : supported) {
            if (support.trim().equalsIgnoreCase(target)) {
                return 100; // 精确匹配
            }
            if (support.trim().contains(target) || target.contains(support.trim())) {
                return 50; // 包含匹配
            }
        }
        return 0; // 不匹配
    }

    private Map<String, Object> convertToMap(RecommendedProcess recommended) {
        RepairProcess process = recommended.getProcess();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", process.getId());
        map.put("processCode", process.getProcessCode());
        map.put("processName", process.getProcessName());
        map.put("processType", process.getProcessType());
        map.put("minConditionLevel", process.getMinConditionLevel());
        map.put("maxConditionLevel", process.getMaxConditionLevel());
        map.put("applicableMaterials", process.getApplicableMaterials());
        map.put("difficultyLevel", process.getDifficultyLevel());
        map.put("successRate", process.getSuccessRate());
        map.put("durationEstimate", process.getDurationEstimate());
        map.put("matchScore", recommended.getMatchScore());
        map.put("recommendReason", generateRecommendReason(recommended));
        return map;
    }

    private String generateRecommendReason(RecommendedProcess recommended) {
        StringBuilder reason = new StringBuilder();
        RepairProcess process = recommended.getProcess();

        if (recommended.getMatchScore() == 100) {
            reason.append("材质精确匹配");
        } else if (recommended.getMatchScore() >= 50) {
            reason.append("材质兼容");
        }

        if (process.getSuccessRate() != null) {
            reason.append(", 成功率").append(process.getSuccessRate()).append("%");
        }

        if (process.getDifficultyLevel() != null) {
            reason.append(", 难度等级").append(process.getDifficultyLevel());
        }

        return reason.toString();
    }

    private static class RecommendedProcess {
        private RepairProcess process;
        private int matchScore;
        private boolean levelMatch;

        public RepairProcess getProcess() { return process; }
        public void setProcess(RepairProcess process) { this.process = process; }
        public int getMatchScore() { return matchScore; }
        public void setMatchScore(int matchScore) { this.matchScore = matchScore; }
        public boolean isLevelMatch() { return levelMatch; }
        public void setLevelMatch(boolean levelMatch) { this.levelMatch = levelMatch; }
    }
}
