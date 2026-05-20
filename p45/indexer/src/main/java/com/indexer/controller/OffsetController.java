package com.indexer.controller;

import com.indexer.service.OffsetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/offset")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class OffsetController {

    private final OffsetService offsetService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getOffsetStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("lastProcessedBlock", offsetService.getLastProcessedBlock());
        status.put("mockBlockNumber", offsetService.getMockBlockNumber());
        status.put("redisAvailable", offsetService.isRedisAvailable());
        return ResponseEntity.ok(status);
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> resetOffset() {
        offsetService.resetOffset();
        Map<String, String> result = new HashMap<>();
        result.put("message", "Offset reset successfully");
        log.info("Offset reset by API request");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/set")
    public ResponseEntity<Map<String, Object>> setOffset(@RequestParam Long blockNumber) {
        offsetService.updateLastProcessedBlock(blockNumber);
        Map<String, Object> result = new HashMap<>();
        result.put("message", "Offset updated successfully");
        result.put("lastProcessedBlock", blockNumber);
        log.info("Offset set to {} by API request", blockNumber);
        return ResponseEntity.ok(result);
    }
}