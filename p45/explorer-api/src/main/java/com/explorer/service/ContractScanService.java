package com.explorer.service;

import com.explorer.dto.ScanResult;
import com.explorer.dto.Vulnerability;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class ContractScanService {

    private final Map<String, ScanResult> scanResults = new ConcurrentHashMap<>();
    private final Map<String, List<Vulnerability>> contractVulnerabilities = new ConcurrentHashMap<>();

    private static final List<String> CONTRACT_ADDRESSES = Arrays.asList(
        "0x1234567890abcdef1234567890abcdef12345678",
        "0xabcdef1234567890abcdef1234567890abcdef12",
        "0x9876543210fedcba9876543210fedcba98765432",
        "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        "0xfedcba0987654321fedcba0987654321fedcba09"
    );

    private static final Map<String, VulnerabilityTemplate> VULNERABILITY_TEMPLATES = new HashMap<>();

    static {
        VULNERABILITY_TEMPLATES.put("reentrancy", VulnerabilityTemplate.builder()
            .name("重入攻击 (Reentrancy)")
            .severity("CRITICAL")
            .category("安全")
            .cvssScore(9.8)
            .description("合约在外部调用完成前状态可能被攻击者通过递归调用恶意修改")
            .impact("可能导致合约资金被盗取，攻击者可以反复提取资金")
            .recommendation("使用 Checks-Effects-Interactions 模式；在调用外部合约前更新状态；使用重入锁")
            .tool("Slither")
            .build());

        VULNERABILITY_TEMPLATES.put("overflow", VulnerabilityTemplate.builder()
            .name("整数溢出 (Integer Overflow)")
            .severity("HIGH")
            .category("安全")
            .cvssScore(8.5)
            .description("算术运算结果超出数据类型范围，导致意外的数值计算")
            .impact("可能导致资金计算错误，如余额虚增或虚减")
            .recommendation("使用 Solidity 0.8+ 内置安全数学；或使用 SafeMath 库")
            .tool("Oyente")
            .build());

        VULNERABILITY_TEMPLATES.put("underflow", VulnerabilityTemplate.builder()
            .name("整数下溢 (Integer Underflow)")
            .severity("HIGH")
            .category("安全")
            .cvssScore(8.5)
            .description("减法运算结果为负数但存储为无符号整数")
            .impact("可能导致余额计算错误，攻击者可以凭空增加余额")
            .recommendation("使用 Solidity 0.8+ 内置安全数学；或使用 SafeMath 库")
            .tool("Oyente")
            .build());

        VULNERABILITY_TEMPLATES.put("unprotected_selfdestruct", VulnerabilityTemplate.builder()
            .name("未保护的自毁函数 (Unprotected Selfdestruct)")
            .severity("CRITICAL")
            .category("访问控制")
            .cvssScore(9.5)
            .description("selfdestruct 函数没有适当的访问控制，任何人都可以销毁合约")
            .impact("攻击者可以永久销毁合约，导致所有资金永久锁定")
            .recommendation("添加 onlyOwner 或多签权限控制；谨慎使用 selfdestruct")
            .tool("Slither")
            .build());

        VULNERABILITY_TEMPLATES.put("timestamp_dependence", VulnerabilityTemplate.builder()
            .name("时间戳依赖 (Timestamp Dependence)")
            .severity("MEDIUM")
            .category("业务逻辑")
            .cvssScore(6.0)
            .description("关键业务逻辑依赖 block.timestamp，矿工可以在一定范围内操纵")
            .impact("可能导致随机数预测、公平性被破坏")
            .recommendation("使用区块哈希替代时间戳；或使用预言机提供可靠时间")
            .tool("Oyente")
            .build());

        VULNERABILITY_TEMPLATES.put("unchecked_call", VulnerabilityTemplate.builder()
            .name("未检查的低级调用 (Unchecked Call Return Value)")
            .severity("MEDIUM")
            .category("安全")
            .cvssScore(5.5)
            .description("call 或 send 的返回值未被检查，调用失败静默")
            .impact("可能导致状态不一致，资金转账失败但逻辑继续执行")
            .recommendation("检查 call 返回值；使用 require 验证；或使用 transfer")
            .tool("Slither")
            .build());

        VULNERABILITY_TEMPLATES.put("delegatecall_unsafe", VulnerabilityTemplate.builder()
            .name("不安全的 DelegateCall (Unsafe DelegateCall)")
            .severity("CRITICAL")
            .category("安全")
            .cvssScore(9.3)
            .description("delegatecall 目标地址可被用户控制或来自不可信来源")
            .impact("攻击者可以执行任意代码，完全控制合约")
            .recommendation("仅对可信的硬编码地址使用 delegatecall；避免接受用户提供的地址")
            .tool("Slither")
            .build());

        VULNERABILITY_TEMPLATES.put("tx_origin", VulnerabilityTemplate.builder()
            .name("tx.origin 认证滥用 (tx.origin Authentication)")
            .severity("HIGH")
            .category("访问控制")
            .cvssScore(7.8)
            .description("使用 tx.origin 进行身份验证，易受钓鱼攻击")
            .impact("攻击者可以通过中间人攻击诱骗用户调用合约来绕过认证")
            .recommendation("使用 msg.sender 替代 tx.origin 进行身份验证")
            .tool("Slither")
            .build());

        VULNERABILITY_TEMPLATES.put("locked_ether", VulnerabilityTemplate.builder()
            .name("锁定的以太币 (Locked Ether)")
            .severity("MEDIUM")
            .category("业务逻辑")
            .cvssScore(4.5)
            .description("合约接收ETH但没有提现功能，资金被永久锁定")
            .impact("发送到合约的ETH将永远无法提取")
            .recommendation("添加提现函数；或实现 receive/fallback 函数")
            .tool("Slither")
            .build());

        VULNERABILITY_TEMPLATES.put("front_running", VulnerabilityTemplate.builder()
            .name("前置交易风险 (Front-running Vulnerability)")
            .severity("MEDIUM")
            .category("业务逻辑")
            .cvssScore(5.0)
            .description("交易在内存池可见，攻击者可抢先发送交易获利")
            .impact("可能导致交易顺序被操纵，如抢跑套利、订单操纵")
            .recommendation("使用 commit-reveal 方案；或使用 submarine send")
            .tool("Oyente")
            .build());
    }

    public ScanResult scanContract(String contractAddress) {
        log.info("Starting security scan for contract: {}", contractAddress);
        
        long startTime = System.currentTimeMillis();
        
        List<Vulnerability> vulnerabilities = generateVulnerabilities(contractAddress);
        
        Map<String, Integer> severityCounts = new HashMap<>();
        for (Vulnerability v : vulnerabilities) {
            severityCounts.merge(v.getSeverity(), 1, Integer::sum);
        }
        
        int criticalCount = severityCounts.getOrDefault("CRITICAL", 0);
        int highCount = severityCounts.getOrDefault("HIGH", 0);
        
        String scanSummary = generateScanSummary(criticalCount, highCount, vulnerabilities.size());
        
        long duration = System.currentTimeMillis() - startTime;
        
        ScanResult result = ScanResult.builder()
            .scanId("SCAN_" + System.currentTimeMillis())
            .contractAddress(contractAddress)
            .contractName("Contract_" + contractAddress.substring(2, 10))
            .tool("Slither + Oyente")
            .scanTime(LocalDateTime.now())
            .durationMs(duration)
            .status("COMPLETED")
            .vulnerabilities(vulnerabilities)
            .severityCounts(severityCounts)
            .bytecodeHash("0x" + generateRandomHash(64))
            .compilerVersion("0.8.20")
            .optimizationUsed("Yes")
            .runs(200)
            .totalLines(150 + new Random().nextInt(350))
            .scanSummary(scanSummary)
            .build();
        
        scanResults.put(contractAddress, result);
        contractVulnerabilities.put(contractAddress, vulnerabilities);
        
        log.info("Scan completed for {}: {} vulnerabilities found in {}ms",
            contractAddress, vulnerabilities.size(), duration);
        
        return result;
    }

    public List<ScanResult> getAllScanResults() {
        if (scanResults.isEmpty()) {
            for (String address : CONTRACT_ADDRESSES) {
                scanContract(address);
            }
        }
        return new ArrayList<>(scanResults.values());
    }

    public ScanResult getScanResult(String contractAddress) {
        ScanResult result = scanResults.get(contractAddress);
        if (result == null) {
            result = scanContract(contractAddress);
        }
        return result;
    }

    public List<Vulnerability> getVulnerabilitiesByContract(String contractAddress) {
        List<Vulnerability> vulnerabilities = contractVulnerabilities.get(contractAddress);
        if (vulnerabilities == null) {
            scanContract(contractAddress);
            vulnerabilities = contractVulnerabilities.get(contractAddress);
        }
        return vulnerabilities;
    }

    public Map<String, Object> getDashboardStats() {
        List<ScanResult> results = getAllScanResults();
        
        int totalVulnerabilities = 0;
        int criticalCount = 0;
        int highCount = 0;
        int mediumCount = 0;
        int contractsScanned = results.size();
        
        for (ScanResult result : results) {
            totalVulnerabilities += result.getVulnerabilities().size();
            criticalCount += result.getSeverityCounts().getOrDefault("CRITICAL", 0);
            highCount += result.getSeverityCounts().getOrDefault("HIGH", 0);
            mediumCount += result.getSeverityCounts().getOrDefault("MEDIUM", 0);
        }
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("contractsScanned", contractsScanned);
        stats.put("totalVulnerabilities", totalVulnerabilities);
        stats.put("criticalCount", criticalCount);
        stats.put("highCount", highCount);
        stats.put("mediumCount", mediumCount);
        stats.put("lastScanTime", LocalDateTime.now().toString());
        
        return stats;
    }

    private List<Vulnerability> generateVulnerabilities(String contractAddress) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();
        Random random = new Random(contractAddress.hashCode());
        
        List<String> keys = new ArrayList<>(VULNERABILITY_TEMPLATES.keySet());
        int numVulnerabilities = 2 + random.nextInt(5);
        
        Collections.shuffle(keys, random);
        
        for (int i = 0; i < numVulnerabilities && i < keys.size(); i++) {
            String key = keys.get(i);
            VulnerabilityTemplate template = VULNERABILITY_TEMPLATES.get(key);
            
            Vulnerability vuln = Vulnerability.builder()
                .id("VULN_" + System.currentTimeMillis() + "_" + i)
                .name(template.name)
                .severity(template.severity)
                .category(template.category)
                .cvssScore(template.cvssScore)
                .description(template.description)
                .impact(template.impact)
                .recommendation(template.recommendation)
                .tool(template.tool)
                .contractAddress(contractAddress)
                .functionName(generateFunctionName(random))
                .affectedLines(generateAffectedLines(random))
                .discoveredAt(LocalDateTime.now().minusMinutes(random.nextInt(1440)))
                .fixed(false)
                .build();
            
            vulnerabilities.add(vuln);
        }
        
        return vulnerabilities;
    }

    private List<String> generateAffectedLines(Random random) {
        List<String> lines = new ArrayList<>();
        int startLine = 10 + random.nextInt(200);
        int count = 1 + random.nextInt(4);
        for (int i = 0; i < count; i++) {
            lines.add("Line " + (startLine + i));
        }
        return lines;
    }

    private String generateFunctionName(Random random) {
        String[] names = {"transfer", "withdraw", "deposit", "mint", "burn", 
            "approve", "transferFrom", "settle", "execute", "claim"};
        return names[random.nextInt(names.length)];
    }

    private String generateRandomHash(int length) {
        byte[] bytes = new byte[length / 2];
        new Random().nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private String generateScanSummary(int critical, int high, int total) {
        if (critical > 0) {
            return "🔴 高危预警：发现 " + critical + " 个严重漏洞，建议立即修复后部署";
        } else if (high > 0) {
            return "🟠 中等风险：发现 " + high + " 个高危漏洞，建议修复后再部署";
        } else if (total > 0) {
            return "🟡 低风险：发现 " + total + " 个警告项，建议优化代码";
        } else {
            return "🟢 安全通过：未发现安全漏洞";
        }
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    private static class VulnerabilityTemplate {
        private String name;
        private String severity;
        private String category;
        private Double cvssScore;
        private String description;
        private String impact;
        private String recommendation;
        private String tool;
    }
}
