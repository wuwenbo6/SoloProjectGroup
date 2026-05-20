package com.explorer.controller;

import com.explorer.repository.BlockRepository;
import com.explorer.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StatsController {

    private final BlockRepository blockRepository;
    private final TransactionRepository transactionRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("blockCount", blockRepository.count());
        stats.put("transactionCount", transactionRepository.count());
        stats.put("privateTransactionCount", transactionRepository.countPrivateTransactions());
        stats.put("latestBlockNumber", blockRepository.findLatestBlockNumber().orElse(0L));
        return ResponseEntity.ok(stats);
    }
}