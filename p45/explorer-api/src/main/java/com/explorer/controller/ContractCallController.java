package com.explorer.controller;

import com.explorer.entity.ContractCall;
import com.explorer.service.ContractCallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/contract-calls")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ContractCallController {

    private final ContractCallService contractCallService;

    @GetMapping("/{contractAddress}")
    public ResponseEntity<List<ContractCall>> getContractCalls(@PathVariable String contractAddress) {
        return ResponseEntity.ok(contractCallService.getContractCalls(contractAddress));
    }

    @GetMapping("/transaction/{transactionHash}")
    public ResponseEntity<List<ContractCall>> getContractCallsByTransaction(@PathVariable String transactionHash) {
        return ResponseEntity.ok(contractCallService.getContractCallsByTransaction(transactionHash));
    }

    @GetMapping("/addresses")
    public ResponseEntity<List<String>> getAllContractAddresses() {
        return ResponseEntity.ok(contractCallService.getAllContractAddresses());
    }
}