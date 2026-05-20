package com.ancient.book.database.controller;

import com.ancient.book.common.entity.AncientDataSource;
import com.ancient.book.common.entity.AncientBookRecord;
import com.ancient.book.database.service.AncientDataSourceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/datasources")
@RequiredArgsConstructor
public class AncientDataSourceController {

    private final AncientDataSourceService dataSourceService;

    @GetMapping
    public ResponseEntity<List<AncientDataSource>> getAllDataSources() {
        log.info("获取所有数据源列表");
        return ResponseEntity.ok(dataSourceService.getAllDataSources());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AncientDataSource> getDataSourceById(@PathVariable Long id) {
        log.info("获取数据源详情: {}", id);
        AncientDataSource dataSource = dataSourceService.getDataSourceById(id);
        return ResponseEntity.ok(dataSource);
    }

    @PostMapping
    public ResponseEntity<AncientDataSource> addDataSource(@RequestBody AncientDataSource dataSource) {
        log.info("新增数据源: {}", dataSource.getSourceName());
        AncientDataSource created = dataSourceService.addDataSource(dataSource);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AncientDataSource> updateDataSource(@PathVariable Long id,
                                                              @RequestBody AncientDataSource dataSource) {
        log.info("更新数据源: {}", id);
        AncientDataSource updated = dataSourceService.updateDataSource(id, dataSource);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteDataSource(@PathVariable Long id) {
        log.info("删除数据源: {}", id);
        boolean success = dataSourceService.deleteDataSource(id);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "删除成功" : "数据源不存在"
        ));
    }

    @PostMapping("/{id}/sync")
    public ResponseEntity<Map<String, Object>> syncDataSource(@PathVariable Long id) {
        log.info("触发数据源同步: {}", id);
        Map<String, Object> result = dataSourceService.syncDataSource(id);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> getSyncStatus(@PathVariable Long id) {
        log.info("获取同步状态: {}", id);
        Map<String, Object> status = dataSourceService.getSyncStatus(id);
        return ResponseEntity.ok(status);
    }

    @GetMapping("/records/search")
    public ResponseEntity<List<AncientBookRecord>> searchRecords(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String dynasty,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("搜索古籍记录: keyword={}, region={}, dynasty={}, category={}",
                keyword, region, dynasty, category);
        List<AncientBookRecord> records = dataSourceService.searchRecords(
                keyword, region, dynasty, category, page, size);
        return ResponseEntity.ok(records);
    }

    @GetMapping("/records/{key}")
    public ResponseEntity<AncientBookRecord> getRecordById(@PathVariable String key) {
        log.info("获取古籍记录详情: {}", key);
        AncientBookRecord record = dataSourceService.getRecordById(key);
        return ResponseEntity.ok(record);
    }

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        log.info("获取数据源统计信息");
        Map<String, Object> stats = dataSourceService.getStatistics();
        return ResponseEntity.ok(stats);
    }
}
