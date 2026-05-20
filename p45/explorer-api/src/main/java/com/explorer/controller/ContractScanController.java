package com.explorer.controller;

import com.explorer.dto.ScanResult;
import com.explorer.dto.Vulnerability;
import com.explorer.service.ContractScanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/contract-scan")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ContractScanController {

    private final ContractScanService contractScanService;

    @PostMapping("/scan")
    public ResponseEntity<ScanResult> scanContract(@RequestParam String contractAddress) {
        log.info("Request to scan contract: {}", contractAddress);
        ScanResult result = contractScanService.scanContract(contractAddress);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/results")
    public ResponseEntity<List<ScanResult>> getAllScanResults() {
        return ResponseEntity.ok(contractScanService.getAllScanResults());
    }

    @GetMapping("/result/{contractAddress}")
    public ResponseEntity<ScanResult> getScanResult(@PathVariable String contractAddress) {
        ScanResult result = contractScanService.getScanResult(contractAddress);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/vulnerabilities/{contractAddress}")
    public ResponseEntity<List<Vulnerability>> getVulnerabilities(@PathVariable String contractAddress) {
        List<Vulnerability> vulnerabilities = contractScanService.getVulnerabilitiesByContract(contractAddress);
        return ResponseEntity.ok(vulnerabilities);
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(contractScanService.getDashboardStats());
    }

    @GetMapping("/high-risk")
    public ResponseEntity<List<Vulnerability>> getHighRiskVulnerabilities() {
        List<ScanResult> results = contractScanService.getAllScanResults();
        List<Vulnerability> highRisk = results.stream()
            .flatMap(r -> r.getVulnerabilities().stream())
            .filter(v -> "CRITICAL".equals(v.getSeverity()) || "HIGH".equals(v.getSeverity()))
            .sorted((a, b) -> b.getCvssScore().compareTo(a.getCvssScore()))
            .toList();
        return ResponseEntity.ok(highRisk);
    }
}
