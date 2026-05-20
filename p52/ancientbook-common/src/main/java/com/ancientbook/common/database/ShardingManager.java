package com.ancientbook.common.database;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Component
public class ShardingManager {

    private final Map<String, TableShardingConfig> shardingConfigs = new ConcurrentHashMap<>();
    private final Map<String, IndexOptimizer> indexOptimizers = new ConcurrentHashMap<>();
    private final Map<String, QueryStats> queryStatsMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        initShardingConfigs();
        initIndexOptimizers();
        log.info("分库分表管理器初始化完成，配置表数: {}, 索引优化器数: {}",
                shardingConfigs.size(), indexOptimizers.size());
    }

    private void initShardingConfigs() {
        shardingConfigs.put("repair_record", TableShardingConfig.builder()
                .tableName("repair_record")
                .shardingStrategy(ShardingStrategy.DATE_MONTH)
                .shardingColumn("create_time")
                .tableCount(24)
                .partitionKey("worker_id")
                .partitionCount(8)
                .build());

        shardingConfigs.put("detection_report", TableShardingConfig.builder()
                .tableName("detection_report")
                .shardingStrategy(ShardingStrategy.DATE_QUARTER)
                .shardingColumn("report_time")
                .tableCount(16)
                .partitionKey("org_id")
                .partitionCount(4)
                .build());

        shardingConfigs.put("ancient_book", TableShardingConfig.builder()
                .tableName("ancient_book")
                .shardingStrategy(ShardingStrategy.HASH_MOD)
                .shardingColumn("book_code")
                .tableCount(64)
                .build());

        shardingConfigs.put("audit_log", TableShardingConfig.builder()
                .tableName("audit_log")
                .shardingStrategy(ShardingStrategy.DATE_DAY)
                .shardingColumn("request_time")
                .tableCount(90)
                .build());
    }

    private void initIndexOptimizers() {
        indexOptimizers.put("repair_record", new IndexOptimizer("repair_record", List.of(
                new IndexInfo("idx_worker_time", List.of("worker_id", "create_time"), IndexType.BTREE),
                new IndexInfo("idx_book_status", List.of("book_code", "status"), IndexType.BTREE),
                new IndexInfo("idx_process_quality", List.of("process_id", "quality_score"), IndexType.BTREE)
        )));

        indexOptimizers.put("detection_report", new IndexOptimizer("detection_report", List.of(
                new IndexInfo("idx_org_time", List.of("org_id", "report_time"), IndexType.BTREE),
                new IndexInfo("idx_book_ph", List.of("book_code", "ph_value"), IndexType.BTREE),
                new IndexInfo("idx_damage_type", List.of("damage_type"), IndexType.BTREE)
        )));

        indexOptimizers.put("ancient_book", new IndexOptimizer("ancient_book", List.of(
                new IndexInfo("uk_book_code", List.of("book_code"), IndexType.UNIQUE),
                new IndexInfo("idx_dynasty_level", List.of("dynasty", "level"), IndexType.BTREE),
                new IndexInfo("idx_ft_title", List.of("title"), IndexType.FULLTEXT)
        )));
    }

    public String getShardedTableName(String baseTableName, Object shardingValue) {
        TableShardingConfig config = shardingConfigs.get(baseTableName);
        if (config == null) {
            return baseTableName;
        }

        int tableIndex = calculateTableIndex(shardingValue, config);
        return baseTableName + "_" + String.format("%02d", tableIndex);
    }

    private int calculateTableIndex(Object shardingValue, TableShardingConfig config) {
        return switch (config.shardingStrategy) {
            case HASH_MOD -> Math.abs(shardingValue.hashCode()) % config.tableCount;
            case DATE_DAY -> {
                LocalDate date = parseDate(shardingValue);
                int dayOfYear = date.getDayOfYear();
                yield dayOfYear % config.tableCount;
            }
            case DATE_MONTH -> {
                LocalDate date = parseDate(shardingValue);
                int month = date.getMonthValue();
                yield month % config.tableCount;
            }
            case DATE_QUARTER -> {
                LocalDate date = parseDate(shardingValue);
                int quarter = (date.getMonthValue() - 1) / 3 + 1;
                yield quarter % config.tableCount;
            }
            case RANGE -> 0;
        };
    }

    private LocalDate parseDate(Object value) {
        if (value instanceof LocalDate) {
            return (LocalDate) value;
        } else if (value instanceof String) {
            return LocalDate.parse((String) value, DateTimeFormatter.ISO_LOCAL_DATE);
        }
        return LocalDate.now();
    }

    public List<String> getRelatedTablesForQuery(String baseTableName, String startDate, String endDate) {
        TableShardingConfig config = shardingConfigs.get(baseTableName);
        if (config == null) {
            return List.of(baseTableName);
        }

        List<String> tables = new ArrayList<>();
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end = LocalDate.parse(endDate);

        if (config.shardingStrategy == ShardingStrategy.DATE_MONTH) {
            LocalDate current = start.withDayOfMonth(1);
            while (!current.isAfter(end)) {
                int monthIndex = current.getMonthValue() % config.tableCount;
                tables.add(baseTableName + "_" + String.format("%02d", monthIndex));
                current = current.plusMonths(1);
            }
        } else if (config.shardingStrategy == ShardingStrategy.DATE_DAY) {
            LocalDate current = start;
            while (!current.isAfter(end)) {
                int dayIndex = current.getDayOfYear() % config.tableCount;
                tables.add(baseTableName + "_" + String.format("%02d", dayIndex));
                current = current.plusDays(1);
            }
        } else {
            tables.add(baseTableName);
        }

        return tables.stream().distinct().toList();
    }

    public void recordQuery(String sql, long executionTimeMs, int rowsAffected) {
        String sqlKey = generateSqlSignature(sql);
        QueryStats stats = queryStatsMap.computeIfAbsent(sqlKey, k -> new QueryStats(sql));
        stats.recordExecution(executionTimeMs, rowsAffected);
    }

    private String generateSqlSignature(String sql) {
        return sql.replaceAll("'[^']*'", "?")
                .replaceAll("\\d+", "?")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public List<QueryOptimizationSuggestion> getOptimizationSuggestions() {
        List<QueryOptimizationSuggestion> suggestions = new ArrayList<>();

        for (QueryStats stats : queryStatsMap.values()) {
            if (stats.getAvgExecutionTime() > 1000) {
                suggestions.add(new QueryOptimizationSuggestion(
                        stats.getSqlSignature(),
                        "慢查询优化",
                        "平均执行时间 " + String.format("%.2f", stats.getAvgExecutionTime()) + "ms，超过阈值1000ms",
                        "建议添加索引或优化SQL结构"
                ));
            }
            if (stats.getExecutionCount() > 1000 && stats.getAvgExecutionTime() > 500) {
                suggestions.add(new QueryOptimizationSuggestion(
                        stats.getSqlSignature(),
                        "高频查询优化",
                        "执行次数 " + stats.getExecutionCount() + "，平均执行时间 " +
                                String.format("%.2f", stats.getAvgExecutionTime()) + "ms",
                        "建议添加缓存或进行SQL改写优化"
                ));
            }
        }

        return suggestions;
    }

    public Map<String, Object> getDatabaseStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("shardedTables", shardingConfigs.keySet());
        stats.put("indexedTables", indexOptimizers.keySet());
        stats.put("totalMonitoredQueries", queryStatsMap.size());

        long totalQueries = queryStatsMap.values().stream()
                .mapToLong(QueryStats::getExecutionCount)
                .sum();
        stats.put("totalQueriesMonitored", totalQueries);

        double avgQueryTime = queryStatsMap.values().stream()
                .mapToDouble(QueryStats::getAvgExecutionTime)
                .average()
                .orElse(0);
        stats.put("avgQueryTimeMs", String.format("%.2f", avgQueryTime));

        long slowQueryCount = queryStatsMap.values().stream()
                .filter(s -> s.getAvgExecutionTime() > 1000)
                .count();
        stats.put("slowQueryCount", slowQueryCount);

        Map<String, Object> shardingDetails = new LinkedHashMap<>();
        for (Map.Entry<String, TableShardingConfig> entry : shardingConfigs.entrySet()) {
            TableShardingConfig config = entry.getValue();
            shardingDetails.put(entry.getKey(), Map.of(
                    "strategy", config.shardingStrategy.name(),
                    "shardingColumn", config.shardingColumn,
                    "tableCount", config.tableCount,
                    "partitionCount", config.partitionCount
            ));
        }
        stats.put("shardingDetails", shardingDetails);

        return stats;
    }

    public enum ShardingStrategy {
        HASH_MOD,
        DATE_DAY,
        DATE_MONTH,
        DATE_QUARTER,
        RANGE
    }

    public enum IndexType {
        BTREE,
        HASH,
        FULLTEXT,
        UNIQUE,
        GIN
    }

    public static class TableShardingConfig {
        private final String tableName;
        private final ShardingStrategy shardingStrategy;
        private final String shardingColumn;
        private final int tableCount;
        private final String partitionKey;
        private final int partitionCount;

        private TableShardingConfig(Builder builder) {
            this.tableName = builder.tableName;
            this.shardingStrategy = builder.shardingStrategy;
            this.shardingColumn = builder.shardingColumn;
            this.tableCount = builder.tableCount;
            this.partitionKey = builder.partitionKey;
            this.partitionCount = builder.partitionCount;
        }

        public static Builder builder() {
            return new Builder();
        }

        public static class Builder {
            private String tableName;
            private ShardingStrategy shardingStrategy;
            private String shardingColumn;
            private int tableCount;
            private String partitionKey;
            private int partitionCount;

            public Builder tableName(String tableName) {
                this.tableName = tableName;
                return this;
            }

            public Builder shardingStrategy(ShardingStrategy strategy) {
                this.shardingStrategy = strategy;
                return this;
            }

            public Builder shardingColumn(String column) {
                this.shardingColumn = column;
                return this;
            }

            public Builder tableCount(int count) {
                this.tableCount = count;
                return this;
            }

            public Builder partitionKey(String key) {
                this.partitionKey = key;
                return this;
            }

            public Builder partitionCount(int count) {
                this.partitionCount = count;
                return this;
            }

            public TableShardingConfig build() {
                return new TableShardingConfig(this);
            }
        }
    }

    public static class IndexInfo {
        private final String indexName;
        private final List<String> columns;
        private final IndexType type;

        public IndexInfo(String indexName, List<String> columns, IndexType type) {
            this.indexName = indexName;
            this.columns = columns;
            this.type = type;
        }

        public String getIndexName() { return indexName; }
        public List<String> getColumns() { return columns; }
        public IndexType getType() { return type; }
    }

    public static class IndexOptimizer {
        private final String tableName;
        private final List<IndexInfo> indexes;

        public IndexOptimizer(String tableName, List<IndexInfo> indexes) {
            this.tableName = tableName;
            this.indexes = indexes;
        }

        public String getTableName() { return tableName; }
        public List<IndexInfo> getIndexes() { return indexes; }
    }

    public static class QueryStats {
        private final String sqlSignature;
        private final AtomicLong executionCount = new AtomicLong(0);
        private final AtomicLong totalExecutionTime = new AtomicLong(0);
        private final AtomicLong totalRowsAffected = new AtomicLong(0);
        private volatile long maxExecutionTime = 0;
        private volatile long minExecutionTime = Long.MAX_VALUE;

        public QueryStats(String sqlSignature) {
            this.sqlSignature = sqlSignature;
        }

        public synchronized void recordExecution(long timeMs, int rows) {
            executionCount.incrementAndGet();
            totalExecutionTime.addAndGet(timeMs);
            totalRowsAffected.addAndGet(rows);
            maxExecutionTime = Math.max(maxExecutionTime, timeMs);
            minExecutionTime = Math.min(minExecutionTime, timeMs);
        }

        public String getSqlSignature() { return sqlSignature; }
        public long getExecutionCount() { return executionCount.get(); }
        public double getAvgExecutionTime() {
            long count = executionCount.get();
            return count > 0 ? (double) totalExecutionTime.get() / count : 0;
        }
        public long getMaxExecutionTime() { return maxExecutionTime; }
        public long getMinExecutionTime() { return minExecutionTime; }
    }

    public record QueryOptimizationSuggestion(
            String sqlSignature,
            String type,
            String description,
            String suggestion
    ) {}
}
