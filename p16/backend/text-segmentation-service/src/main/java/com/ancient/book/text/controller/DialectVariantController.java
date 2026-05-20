package com.ancient.book.text.controller;

import com.ancient.book.common.entity.DialectVariant;
import com.ancient.book.text.service.DialectVariantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/dialect")
@RequiredArgsConstructor
public class DialectVariantController {

    private final DialectVariantService dialectVariantService;

    @PostMapping("/recognize")
    public ResponseEntity<Map<String, Object>> recognizeVariants(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        log.info("方言异体字识别请求，文本长度: {}", text != null ? text.length() : 0);
        Map<String, Object> result = dialectVariantService.recognizeVariants(text);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/convert/region")
    public ResponseEntity<Map<String, Object>> convertByRegion(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        String targetRegion = request.get("targetRegion");
        log.info("按区域转换请求，区域: {}, 文本长度: {}", targetRegion, text != null ? text.length() : 0);
        Map<String, Object> result = dialectVariantService.convertByRegion(text, targetRegion);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/region/{region}")
    public ResponseEntity<List<DialectVariant>> getVariantsByRegion(@PathVariable String region) {
        log.info("获取区域异体字列表: {}", region);
        List<DialectVariant> variants = dialectVariantService.getVariantsByRegion(region);
        return ResponseEntity.ok(variants);
    }

    @GetMapping("/search")
    public ResponseEntity<List<DialectVariant>> searchVariants(@RequestParam String keyword) {
        log.info("搜索异体字: {}", keyword);
        List<DialectVariant> variants = dialectVariantService.searchVariants(keyword);
        return ResponseEntity.ok(variants);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDictionaryStats() {
        log.info("获取字典统计信息");
        Map<String, Object> stats = dialectVariantService.getDictionaryStats();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/variant/{char}")
    public ResponseEntity<DialectVariant> getVariantInfo(@PathVariable("char") String variantChar) {
        log.info("获取异体字详情: {}", variantChar);
        DialectVariant variant = dialectVariantService.getVariantInfo(variantChar);
        return ResponseEntity.ok(variant);
    }

    @PostMapping("/batch/convert")
    public ResponseEntity<Map<String, Object>> batchConvert(@RequestBody Map<String, List<String>> request) {
        List<String> textList = request.get("textList");
        log.info("批量转换请求，文本数量: {}", textList != null ? textList.size() : 0);
        Map<String, Object> result = dialectVariantService.batchConvert(textList);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/analyze/distribution")
    public ResponseEntity<Map<String, Object>> analyzeDialectDistribution(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        log.info("方言分布分析请求，文本长度: {}", text != null ? text.length() : 0);
        Map<String, Object> result = dialectVariantService.analyzeDialectDistribution(text);
        return ResponseEntity.ok(result);
    }
}
