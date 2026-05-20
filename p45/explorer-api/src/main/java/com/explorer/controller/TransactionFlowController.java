package com.explorer.controller;

import com.explorer.dto.GraphData;
import com.explorer.dto.TopologyPattern;
import com.explorer.service.TransactionFlowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/transaction-flow")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TransactionFlowController {

    private final TransactionFlowService transactionFlowService;

    @GetMapping("/graph")
    public ResponseEntity<GraphData> getTransactionGraph(
            @RequestParam(defaultValue = "1000") int limit) {
        return ResponseEntity.ok(transactionFlowService.analyzeTransactionFlow(limit));
    }

    @GetMapping("/patterns")
    public ResponseEntity<List<TopologyPattern>> getTopologyPatterns(
            @RequestParam(defaultValue = "1000") int limit) {
        GraphData graphData = transactionFlowService.analyzeTransactionFlow(limit);
        return ResponseEntity.ok(graphData.getPatterns());
    }

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getFlowStatistics(
            @RequestParam(defaultValue = "1000") int limit) {
        GraphData graphData = transactionFlowService.analyzeTransactionFlow(limit);
        return ResponseEntity.ok(graphData.getStatistics());
    }
}