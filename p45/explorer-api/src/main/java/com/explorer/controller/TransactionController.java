package com.explorer.controller;

import com.explorer.entity.Transaction;
import com.explorer.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/transactions")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TransactionController {

    private final TransactionService transactionService;

    @GetMapping
    public ResponseEntity<Page<Transaction>> getTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(transactionService.getTransactions(page, size));
    }

    @GetMapping("/private")
    public ResponseEntity<Page<Transaction>> getPrivateTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(transactionService.getPrivateTransactions(page, size));
    }

    @GetMapping("/hash/{hash}")
    public ResponseEntity<Transaction> getTransactionByHash(@PathVariable String hash) {
        return transactionService.getTransactionByHash(hash)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/block/{blockNumber}")
    public ResponseEntity<Page<Transaction>> getTransactionsByBlock(
            @PathVariable Long blockNumber,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(transactionService.getTransactionsByBlockNumber(blockNumber, page, size));
    }

    @GetMapping("/address/{address}")
    public ResponseEntity<Page<Transaction>> getTransactionsByAddress(
            @PathVariable String address,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(transactionService.getTransactionsByAddress(address, page, size));
    }

    @GetMapping("/privacy-group/{privacyGroupId}")
    public ResponseEntity<List<Transaction>> getTransactionsByPrivacyGroup(@PathVariable String privacyGroupId) {
        return ResponseEntity.ok(transactionService.getTransactionsByPrivacyGroupId(privacyGroupId));
    }

    @GetMapping("/private/count")
    public ResponseEntity<Long> getPrivateTransactionCount() {
        return ResponseEntity.ok(transactionService.getPrivateTransactionCount());
    }
}