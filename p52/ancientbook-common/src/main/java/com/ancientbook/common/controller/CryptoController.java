package com.ancientbook.common.controller;

import com.ancientbook.common.util.ApiCryptoUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/crypto")
@RequiredArgsConstructor
public class CryptoController {

    private final ObjectMapper objectMapper;

    @PostMapping("/encrypt")
    public Map<String, Object> encrypt(@RequestBody Map<String, Object> data) throws Exception {
        String jsonData = objectMapper.writeValueAsString(data);
        String encrypted = ApiCryptoUtil.encrypt(jsonData);

        long timestamp = System.currentTimeMillis();
        String nonce = ApiCryptoUtil.generateNonceStr();
        String signature = ApiCryptoUtil.generateSignature(encrypted, timestamp, nonce);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", encrypted);
        result.put("timestamp", timestamp);
        result.put("nonce", nonce);
        result.put("signature", signature);
        result.put("algorithm", "AES-GCM-256");

        return result;
    }

    @PostMapping("/decrypt")
    public Map<String, Object> decrypt(@RequestBody Map<String, String> request) throws Exception {
        String encryptedData = request.get("data");
        String decrypted = ApiCryptoUtil.decrypt(encryptedData);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(decrypted, Map.class);
        return result;
    }

    @GetMapping("/public-key")
    public Map<String, Object> getPublicKeyInfo() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("algorithm", "AES-GCM-256");
        result.put("keySize", 256);
        result.put("mode", "GCM");
        result.put("padding", "NoPadding");
        result.put("nonceSize", 96);
        result.put("tagSize", 128);
        result.put("timestampTolerance", 300000);
        return result;
    }

    @PostMapping("/verify")
    public Map<String, Object> verifySignature(@RequestBody Map<String, String> request) {
        String data = request.get("data");
        long timestamp = Long.parseLong(request.getOrDefault("timestamp", "0"));
        String nonce = request.get("nonce");
        String signature = request.get("signature");

        boolean valid = ApiCryptoUtil.verifySignature(data, timestamp, nonce, signature);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("valid", valid);
        result.put("message", valid ? "签名验证通过" : "签名验证失败或已过期");
        return result;
    }

    @PostMapping("/generate-token")
    public Map<String, Object> generateRequestToken(@RequestBody Map<String, String> request) {
        String requestId = request.get("requestId");
        long timestamp = System.currentTimeMillis();
        String token = ApiCryptoUtil.generateRequestToken(requestId, timestamp);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", requestId);
        result.put("timestamp", timestamp);
        result.put("token", token);
        return result;
    }
}
