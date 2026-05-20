package com.ancientbook.repair.controller;

import com.ancientbook.repair.algorithm.RepairProcessAlgorithm;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/repair/algorithm")
@RequiredArgsConstructor
public class RepairAlgorithmController {

    private final RepairProcessAlgorithm repairProcessAlgorithm;

    @PostMapping("/recommend")
    public Map<String, Object> recommendProcesses(@RequestBody RepairProcessAlgorithm.RepairContext context) {
        long startTime = System.currentTimeMillis();

        List<RepairProcessAlgorithm.ProcessRecommendation> recommendations =
                repairProcessAlgorithm.recommend(context);

        long endTime = System.currentTimeMillis();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("context", context);
        result.put("recommendations", recommendations);
        result.put("recommendCount", recommendations.size());
        result.put("algorithmTimeMs", endTime - startTime);
        result.put("topRecommendation", recommendations.isEmpty() ? null : recommendations.get(0));

        return result;
    }

    @GetMapping("/processes")
    public List<RepairProcessAlgorithm.ProcessHistory> getAllProcesses() {
        return repairProcessAlgorithm.getAllProcessHistory();
    }

    @GetMapping("/performance")
    public RepairProcessAlgorithm.AlgorithmPerformance getPerformance() {
        return repairProcessAlgorithm.getPerformanceStats();
    }

    @GetMapping("/factors")
    public Map<String, Object> getAlgorithmFactors() {
        Map<String, Object> factors = new LinkedHashMap<>();
        factors.put("破损类型", Map.of("weight", 0.25, "description", "破损类型匹配度"));
        factors.put("材质类型", Map.of("weight", 0.20, "description", "纸张材质匹配度"));
        factors.put("破损程度", Map.of("weight", 0.15, "description", "破损严重程度"));
        factors.put("纸张年代", Map.of("weight", 0.10, "description", "纸张年代久远程度"));
        factors.put("善本级别", Map.of("weight", 0.10, "description", "善本珍贵级别"));
        factors.put("修复人员技能", Map.of("weight", 0.10, "description", "修复人员技能等级"));
        factors.put("历史成功率", Map.of("weight", 0.05, "description", "历史修复成功率"));
        factors.put("修复成本", Map.of("weight", 0.05, "description", "修复成本因素"));
        return factors;
    }
}
