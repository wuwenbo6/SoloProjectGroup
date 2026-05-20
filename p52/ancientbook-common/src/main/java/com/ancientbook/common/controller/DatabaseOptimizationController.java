package com.ancientbook.common.controller;

import com.ancientbook.common.database.ShardingManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/database")
@RequiredArgsConstructor
public class DatabaseOptimizationController {

    private final ShardingManager shardingManager;

    @GetMapping("/stats")
    public Map<String, Object> getDatabaseStats() {
        return shardingManager.getDatabaseStats();
    }

    @GetMapping("/sharding/tables")
    public List<String> getShardedTables(
            @RequestParam String baseTableName,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        if (startDate != null && endDate != null) {
            return shardingManager.getRelatedTablesForQuery(baseTableName, startDate, endDate);
        }
        return List.of(baseTableName + "_*");
    }

    @GetMapping("/sharding/calculate")
    public Map<String, Object> calculateShard(
            @RequestParam String baseTableName,
            @RequestParam String shardingValue) {

        String shardedTable = shardingManager.getShardedTableName(baseTableName, shardingValue);
        return Map.of(
                "baseTable", baseTableName,
                "shardingValue", shardingValue,
                "shardedTable", shardedTable
        );
    }

    @GetMapping("/optimization/suggestions")
    public Map<String, Object> getOptimizationSuggestions() {
        List<ShardingManager.QueryOptimizationSuggestion> suggestions =
                shardingManager.getOptimizationSuggestions();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("suggestionCount", suggestions.size());
        result.put("suggestions", suggestions);
        return result;
    }

    @PostMapping("/query/record")
    public Map<String, Object> recordQuery(
            @RequestParam String sql,
            @RequestParam long executionTimeMs,
            @RequestParam(defaultValue = "0") int rowsAffected) {

        shardingManager.recordQuery(sql, executionTimeMs, rowsAffected);
        return Map.of(
                "success", true,
                "message", "查询记录已记录"
        );
    }

    @GetMapping("/indexes/{tableName}")
    public Map<String, Object> getTableIndexes(@PathVariable String tableName) {
        Map<String, Object> stats = shardingManager.getDatabaseStats();
        Map<String, Object> shardingDetails = (Map<String, Object>) stats.get("shardingDetails");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tableName", tableName);
        result.put("hasShardingConfig", shardingDetails.containsKey(tableName));

        if (shardingDetails.containsKey(tableName)) {
            result.put("shardingConfig", shardingDetails.get(tableName));
        }

        List<Map<String, Object>> recommendedIndexes = List.of(
                Map.of(
                        "indexName", "idx_worker_time",
                        "columns", List.of("worker_id", "create_time"),
                        "type", "BTREE",
                        "purpose", "修复人员时间范围查询"
                ),
                Map.of(
                        "indexName", "idx_book_status",
                        "columns", List.of("book_code", "status"),
                        "type", "BTREE",
                        "purpose", "善本状态筛选"
                ),
                Map.of(
                        "indexName", "idx_composite_query",
                        "columns", List.of("org_id", "report_time", "damage_type"),
                        "type", "BTREE",
                        "purpose", "多条件复合查询"
                )
        );
        result.put("recommendedIndexes", recommendedIndexes);

        return result;
    }

    @GetMapping("/best-practices")
    public Map<String, Object> getBestPractices() {
        Map<String, Object> practices = new LinkedHashMap<>();

        practices.put("shardingStrategies", List.of(
                Map.of("name", "HASH_MOD", "description", "哈希取模，适用于均匀分布的数据"),
                Map.of("name", "DATE_MONTH", "description", "按月分表，适用于时间序列数据"),
                Map.of("name", "DATE_DAY", "description", "按天分表，适用于高频率写入的日志表"),
                Map.of("name", "DATE_QUARTER", "description", "按季度分表，适用于报表统计")
        ));

        practices.put("indexRecommendations", List.of(
                Map.of("scenario", "等值查询", "type", "HASH", "columns", "单列"),
                Map.of("scenario", "范围查询", "type", "BTREE", "columns", "多列，区分度高的在前"),
                Map.of("scenario", "全文检索", "type", "FULLTEXT", "columns", "文本字段"),
                Map.of("scenario", "唯一约束", "type", "UNIQUE", "columns", "业务主键")
        ));

        practices.put("queryOptimizationTips", List.of(
                "避免 SELECT *，只查询需要的字段",
                "使用 LIMIT 限制返回行数",
                "避免在 WHERE 子句中使用函数或计算",
                "使用 EXISTS 代替 IN 子查询",
                "合理使用覆盖索引避免回表",
                "大表分页查询使用游标方式",
                "定期执行 ANALYZE TABLE 更新统计信息"
        ));

        practices.put("connectionPoolSettings", Map.of(
                "minimumIdle", "5",
                "maximumPoolSize", "20",
                "connectionTimeout", "30000",
                "idleTimeout", "600000",
                "maxLifetime", "1800000"
        ));

        return practices;
    }
}
