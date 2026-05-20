package com.ancientbook.common.util;

import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.symmetric.AES;
import lombok.extern.slf4j.Slf4j;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Slf4j
public class EncryptUtil {

    private static final String SECRET_KEY = "AncientBook2024!";
    private static final AES AES = SecureUtil.aes(SECRET_KEY.getBytes(StandardCharsets.UTF_8));

    public static String encrypt(String content) {
        try {
            byte[] encrypt = AES.encrypt(content);
            return Base64.getEncoder().encodeToString(encrypt);
        } catch (Exception e) {
            log.error("加密失败", e);
            throw new RuntimeException("加密失败");
        }
    }

    public static String decrypt(String encryptContent) {
        try {
            byte[] decode = Base64.getDecoder().decode(encryptContent);
            return AES.decryptStr(decode);
        } catch (Exception e) {
            log.error("解密失败", e);
            throw new RuntimeException("解密失败");
        }
    }

    public static String md5(String content) {
        return SecureUtil.md5(content);
    }

    public static String sha256(String content) {
        return SecureUtil.sha256(content);
    }
}
