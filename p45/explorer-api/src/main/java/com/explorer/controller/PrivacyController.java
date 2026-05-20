package com.explorer.controller;

import com.explorer.entity.PrivateTransactionParticipant;
import com.explorer.privacy.PrivacyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/privacy")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PrivacyController {

    private final PrivacyService privacyService;

    @GetMapping("/participants/{transactionHash}")
    public ResponseEntity<List<PrivateTransactionParticipant>> getParticipants(@PathVariable String transactionHash) {
        return ResponseEntity.ok(privacyService.getParticipants(transactionHash));
    }

    @GetMapping("/org/{orgName}/participants")
    public ResponseEntity<List<PrivateTransactionParticipant>> getParticipantsByOrg(@PathVariable String orgName) {
        return ResponseEntity.ok(privacyService.getParticipantsByOrg(orgName));
    }

    @GetMapping("/org/{orgName}/public-key")
    public ResponseEntity<String> getOrgPublicKey(@PathVariable String orgName) {
        String publicKey = privacyService.getOrgPublicKey(orgName);
        if (publicKey != null) {
            return ResponseEntity.ok(publicKey);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/orgs/public-keys")
    public ResponseEntity<Map<String, String>> getAllOrgPublicKeys() {
        return ResponseEntity.ok(privacyService.getAllOrgPublicKeys());
    }

    @PostMapping("/decrypt")
    public ResponseEntity<Map<String, Object>> decryptPayload(
            @RequestParam String encryptedPayload,
            @RequestParam String orgName,
            @RequestParam String privateKey) {
        try {
            PrivacyService.DecryptResult result = privacyService.decryptPayload(encryptedPayload, orgName, privateKey);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("decryptedData", result.getDecryptedData());
            response.put("orgName", result.getOrgName());
            response.put("logId", result.getLogId());
            response.put("timestamp", result.getTimestamp());
            return ResponseEntity.ok(response);
        } catch (PrivacyService.InvalidKeyException e) {
            log.warn("解密失败 - 密钥无效: org={}, error={}", orgName, e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "密钥无效");
            errorResponse.put("message", e.getMessage());
            errorResponse.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
        } catch (PrivacyService.DecryptException e) {
            log.error("解密失败 - 系统错误: org={}, error={}", orgName, e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "解密失败");
            errorResponse.put("message", e.getMessage());
            errorResponse.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        } catch (Exception e) {
            log.error("解密失败 - 未预期的异常: org={}, error={}", orgName, e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "系统错误");
            errorResponse.put("message", "解密过程发生未预期的错误，请稍后重试");
            errorResponse.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<PrivacyService.AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(privacyService.getAuditLogs());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        log.error("隐私API发生未处理的异常: {}", e.getMessage(), e);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("error", "系统错误");
        errorResponse.put("message", "服务器内部错误，请稍后重试");
        errorResponse.put("timestamp", LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
}