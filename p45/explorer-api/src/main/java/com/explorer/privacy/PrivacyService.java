package com.explorer.privacy;

import com.explorer.entity.PrivateTransactionParticipant;
import com.explorer.repository.PrivateTransactionParticipantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class PrivacyService {

    private final PrivateTransactionParticipantRepository participantRepository;

    private final Map<String, String> orgKeyStore = new ConcurrentHashMap<>();
    private final Map<String, AuditLog> auditLogs = new ConcurrentHashMap<>();

    public PrivacyService(PrivateTransactionParticipantRepository participantRepository) {
        this.participantRepository = participantRepository;
        orgKeyStore.put("Org1", "BULeR8JyUWhiuuCMU/HLA0Q5pzkYT+cHII3ZKBey3Bo=");
        orgKeyStore.put("Org2", "QfeDAys9MPDs2XHExtc84jKGHxZg/aj52DTh0vtA3Xc=");
        orgKeyStore.put("Org3", "1iTZde/ndBHvzhcl7V68x44Vx7pl8nwx9LqnM/AfJUg=");
    }

    public List<PrivateTransactionParticipant> getParticipants(String transactionHash) {
        return participantRepository.findByTransactionHash(transactionHash);
    }

    public List<PrivateTransactionParticipant> getParticipantsByOrg(String orgName) {
        return participantRepository.findByOrgName(orgName);
    }

    public String getOrgPublicKey(String orgName) {
        return orgKeyStore.get(orgName);
    }

    public Map<String, String> getAllOrgPublicKeys() {
        return new ConcurrentHashMap<>(orgKeyStore);
    }

    public PrivateTransactionParticipant addParticipant(PrivateTransactionParticipant participant) {
        return participantRepository.save(participant);
    }

    public DecryptResult decryptPayload(String encryptedPayload, String orgName, String privateKey) {
        String logId = generateLogId();
        LocalDateTime timestamp = LocalDateTime.now();

        try {
            if (orgName == null || orgName.trim().isEmpty()) {
                logAudit(logId, timestamp, "DECRYPT_FAILED", orgName, "组织名称为空");
                throw new InvalidKeyException("组织名称不能为空");
            }

            String validKey = orgKeyStore.get(orgName);
            if (validKey == null) {
                logAudit(logId, timestamp, "DECRYPT_FAILED", orgName, "组织不存在: " + orgName);
                throw new InvalidKeyException("组织不存在: " + orgName);
            }

            if (privateKey == null || privateKey.trim().isEmpty()) {
                logAudit(logId, timestamp, "DECRYPT_FAILED", orgName, "隐私密钥为空");
                throw new InvalidKeyException("隐私密钥不能为空");
            }

            if (!privateKey.equals(validKey)) {
                logAudit(logId, timestamp, "DECRYPT_FAILED", orgName, "密钥验证失败，提供的密钥与组织密钥不匹配");
                throw new InvalidKeyException("密钥无效，请提供正确的隐私密钥");
            }

            String decryptedData = "Decrypted: " + encryptedPayload + " (Simulated decryption for " + orgName + ")";
            logAudit(logId, timestamp, "DECRYPT_SUCCESS", orgName, "解密成功，Payload长度: " + encryptedPayload.length());

            return DecryptResult.builder()
                    .success(true)
                    .decryptedData(decryptedData)
                    .orgName(orgName)
                    .logId(logId)
                    .timestamp(timestamp)
                    .build();

        } catch (InvalidKeyException e) {
            throw e;
        } catch (Exception e) {
            log.error("解密过程发生未预期的异常: org={}, error={}", orgName, e.getMessage(), e);
            logAudit(logId, timestamp, "DECRYPT_ERROR", orgName, "系统内部错误: " + e.getMessage());
            throw new DecryptException("解密失败，系统内部错误", e);
        }
    }

    private void logAudit(String logId, LocalDateTime timestamp, String action, String orgName, String details) {
        AuditLog auditLog = AuditLog.builder()
                .logId(logId)
                .timestamp(timestamp)
                .action(action)
                .orgName(orgName)
                .details(details)
                .build();
        auditLogs.put(logId, auditLog);
        log.info("隐私操作审计日志 | ID: {} | 时间: {} | 操作: {} | 组织: {} | 详情: {}",
                logId, timestamp, action, orgName, details);
    }

    private String generateLogId() {
        return "AUDIT_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1000);
    }

    public List<AuditLog> getAuditLogs() {
        return auditLogs.values().stream()
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .toList();
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class DecryptResult {
        private boolean success;
        private String decryptedData;
        private String orgName;
        private String logId;
        private LocalDateTime timestamp;
        private String errorMessage;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AuditLog {
        private String logId;
        private LocalDateTime timestamp;
        private String action;
        private String orgName;
        private String details;
    }

    public static class InvalidKeyException extends RuntimeException {
        public InvalidKeyException(String message) {
            super(message);
        }
    }

    public static class DecryptException extends RuntimeException {
        public DecryptException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}