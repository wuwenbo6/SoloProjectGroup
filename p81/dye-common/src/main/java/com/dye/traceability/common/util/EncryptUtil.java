package com.dye.traceability.common.util;

import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.asymmetric.KeyType;
import cn.hutool.crypto.asymmetric.RSA;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class EncryptUtil {

    private static final String AES_ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int NONCE_LENGTH = 12;
    private static final int TIMESTAMP_EXPIRE_SECONDS = 300;

    @Value("${encryption.aes-key:dye-traceability-secret-key-2024!}")
    private String aesKey;

    @Value("${encryption.enabled:true}")
    private boolean encryptionEnabled;

    private final RSA rsa = SecureUtil.rsa();

    public String aesEncrypt(String data) {
        if (!encryptionEnabled) {
            return data;
        }
        try {
            byte[] nonce = new byte[NONCE_LENGTH];
            new SecureRandom().nextBytes(nonce);

            byte[] keyBytes = aesKey.getBytes(StandardCharsets.UTF_8);
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, 0, 16, "AES");

            Cipher cipher = Cipher.getInstance(AES_ALGORITHM);
            GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, nonce);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmParameterSpec);

            byte[] encryptedBytes = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[NONCE_LENGTH + encryptedBytes.length];
            System.arraycopy(nonce, 0, combined, 0, NONCE_LENGTH);
            System.arraycopy(encryptedBytes, 0, combined, NONCE_LENGTH, encryptedBytes.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("AES加密失败", e);
            throw new RuntimeException("加密失败");
        }
    }

    public String aesDecrypt(String encryptedData) {
        if (!encryptionEnabled) {
            return encryptedData;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(encryptedData);

            byte[] nonce = new byte[NONCE_LENGTH];
            System.arraycopy(combined, 0, nonce, 0, NONCE_LENGTH);

            byte[] encryptedBytes = new byte[combined.length - NONCE_LENGTH];
            System.arraycopy(combined, NONCE_LENGTH, encryptedBytes, 0, encryptedBytes.length);

            byte[] keyBytes = aesKey.getBytes(StandardCharsets.UTF_8);
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, 0, 16, "AES");

            Cipher cipher = Cipher.getInstance(AES_ALGORITHM);
            GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, nonce);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmParameterSpec);

            byte[] decryptedBytes = cipher.doFinal(encryptedBytes);
            return new String(decryptedBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("AES解密失败", e);
            throw new RuntimeException("解密失败");
        }
    }

    public String generateSignature(String data, long timestamp, String nonce) {
        String signString = data + timestamp + nonce + aesKey;
        return SecureUtil.sha256(signString);
    }

    public boolean verifySignature(String data, long timestamp, String nonce, String signature) {
        long now = Instant.now().getEpochSecond();
        if (Math.abs(now - timestamp) > TIMESTAMP_EXPIRE_SECONDS) {
            log.warn("请求已过期，timestamp: {}, now: {}", timestamp, now);
            return false;
        }

        String expectedSignature = generateSignature(data, timestamp, nonce);
        return expectedSignature.equals(signature);
    }

    public Map<String, String> encryptResponse(String data) {
        Map<String, String> result = new HashMap<>();
        long timestamp = Instant.now().getEpochSecond();
        String nonce = SecureUtil.simpleUUID().substring(0, 8);

        String encryptedData = aesEncrypt(data);
        String signature = generateSignature(encryptedData, timestamp, nonce);

        result.put("data", encryptedData);
        result.put("timestamp", String.valueOf(timestamp));
        result.put("nonce", nonce);
        result.put("signature", signature);
        return result;
    }

    public String decryptRequest(Map<String, String> request) {
        String encryptedData = request.get("data");
        String timestampStr = request.get("timestamp");
        String nonce = request.get("nonce");
        String signature = request.get("signature");

        if (encryptedData == null || timestampStr == null || nonce == null || signature == null) {
            throw new RuntimeException("缺少必要的加密参数");
        }

        long timestamp = Long.parseLong(timestampStr);
        if (!verifySignature(encryptedData, timestamp, nonce, signature)) {
            throw new RuntimeException("签名验证失败，数据可能被篡改");
        }

        return aesDecrypt(encryptedData);
    }

    public String rsaEncrypt(String data) {
        return rsa.encryptBase64(data, KeyType.PublicKey);
    }

    public String rsaDecrypt(String encryptedData) {
        return rsa.decryptStr(encryptedData, KeyType.PrivateKey);
    }
}
