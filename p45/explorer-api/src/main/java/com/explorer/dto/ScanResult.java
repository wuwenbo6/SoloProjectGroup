package com.explorer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanResult {

    private String scanId;
    private String contractAddress;
    private String contractName;
    private String tool;
    private LocalDateTime scanTime;
    private long durationMs;
    private String status;
    private List<Vulnerability> vulnerabilities;
    private Map<String, Integer> severityCounts;
    private String bytecodeHash;
    private String compilerVersion;
    private String optimizationUsed;
    private int runs;
    private int totalLines;
    private String scanSummary;
}
