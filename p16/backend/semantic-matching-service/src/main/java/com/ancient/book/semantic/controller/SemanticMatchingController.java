package com.ancient.book.semantic.controller;

import com.ancient.book.semantic.service.SemanticMatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/semantic")
@RequiredArgsConstructor
public class SemanticMatchingController {

    private final SemanticMatchingService semanticMatchingService;

    @PostMapping("/interpret")
    public ResponseEntity<Map<String, Object>> getInterpretation(
            @RequestBody Map<String, String> request) {
        String ancientText = request.get("ancientText");
        log.info("古文释义请求: {}", ancientText);
        Map<String, Object> result = semanticMatchingService.getModernInterpretation(ancientText);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/match")
    public ResponseEntity<List<Map<String, Object>>> matchSemanticUnits(
            @RequestBody Map<String, String> request) {
        String text = request.get("text");
        log.info("语义单元匹配请求: {}", text);
        List<Map<String, Object>> matches = semanticMatchingService.matchSemanticUnits(text);
        return ResponseEntity.ok(matches);
    }

    @PostMapping("/align")
    public ResponseEntity<Map<String, Object>> alignAncientModern(
            @RequestBody Map<String, String> request) {
        String ancientText = request.get("ancientText");
        String modernText = request.get("modernText");
        log.info("古今文语义对齐请求: ancient={}, modern={}", ancientText, modernText);
        Map<String, Object> result = semanticMatchingService.alignAncientModern(ancientText, modernText);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/dictionary/{word}")
    public ResponseEntity<Map<String, Object>> getWordDictionary(@PathVariable String word) {
        log.info("字典查询请求: {}", word);
        Map<String, Object> result = semanticMatchingService.getWordDictionary(word);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("semantic-matching-service is running");
    }
}
