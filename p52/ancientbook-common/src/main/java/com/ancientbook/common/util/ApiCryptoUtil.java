package com.ancientbook.common.util;

import lombok.extern.slf4j.Slf4j;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Slf4j
public class ApiCryptoUtil {

    private static final String SECRET_KEY = "AncientBookRestoration2024SecretKey";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int NONCE_LENGTH = 12;
    private static final long TIMESTAMP_TOLERANCE = 5 * 60 * 1000;

    private static final ThreadLocal<Cipher> ENCRYPT_CIPHER = ThreadLocal.withInitial(() -> {
        try {
            return Cipher.getInstance("AES/GCM/NoPadding");
        } catch (Exception e) {
            throw new RuntimeException("初始化加密Cipher失败", e);
        }
    });

    private static final ThreadLocal<Cipher> DECRYPT_CIPHER = ThreadLocal.withInitial(() -> {
        try {
            return Cipher.getInstance("AES/GCM/NoPadding");
        } catch (Exception e) {
            throw new RuntimeException("初始化解密Cipher失败", e);
        }
    });

    public static String encrypt(String plainText) {
        try {
            byte[] nonce = generateNonce();
            SecretKeySpec keySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, nonce);

            Cipher cipher = ENCRYPT_CIPHER.get();
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);

            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            byte[] result = new byte[NONCE_LENGTH + encrypted.length];
            System.arraycopy(nonce, 0, result, 0, NONCE_LENGTH);
            System.arraycopy(encrypted, 0, result, NONCE_LENGTH, encrypted.length);

            return Base64.getEncoder().encodeToString(result);
        } catch (Exception e) {
            log.error("加密失败", e);
            throw new RuntimeException("加密失败", e);
        }
    }

    public static String decrypt(String encryptedText) {
        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedText);
            byte[] nonce = new byte[NONCE_LENGTH];
            byte[] encrypted = new byte[decoded.length - NONCE_LENGTH];

            System.arraycopy(decoded, 0, nonce, 0, NONCE_LENGTH);
            System.arraycopy(decoded, NONCE_LENGTH, encrypted, 0, encrypted.length);

            SecretKeySpec keySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, nonce);

            Cipher cipher = DECRYPT_CIPHER.get();
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);

            byte[] decrypted = cipher.doFinal(encrypted);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("解密失败", e);
            throw new RuntimeException("解密失败", e);
        }
    }

    public static String generateSignature(String data, long timestamp, String nonce) {
        String signStr = data + "|" + timestamp + "|" + nonce + "|" + SECRET_KEY;
        return EncryptUtil.sha256(signStr);
    }

    public static boolean verifySignature(String data, long timestamp, String nonce, String signature) {
        long now = System.currentTimeMillis();
        if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE) {
            log.warn("请求时间戳过期: timestamp={}, now={}", timestamp, now);
            return false;
        }

        String expectedSign = generateSignature(data, timestamp, nonce);
        return expectedSign.equals(signature);
    }

    public static String generateRequestToken(String requestId, long timestamp) {
        String tokenStr = requestId + "|" + timestamp + "|" + SECRET_KEY;
        return EncryptUtil.md5(tokenStr);
    }

    public static boolean verifyRequestToken(String requestId, long timestamp, String token) {
        long now = System.currentTimeMillis();
        if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE) {
            log.warn("请求Token时间戳过期");
            return false;
        }
        String expectedToken = generateRequestToken(requestId, timestamp);
        return expectedToken.equals(token);
    }

    private static byte[] generateNonce() {
        byte[] nonce = new byte[NONCE_LENGTH];
        new SecureRandom().nextBytes(nonce);
        return nonce;
    }

    public static String generateNonceStr() {
        return Long.toHexString(Double.doubleToLongBits(Math.random())) +
                Long.toHexString(Instant.now().toEpochMilli());
    }
}
