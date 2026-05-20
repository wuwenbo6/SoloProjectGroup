package com.ancientbook.archive.service;

import com.ancientbook.common.datasource.DataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.common.util.EncryptUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@DataSource(DataSourceType.ARCHIVE)
public class ArchiveService {

    private final ObjectMapper objectMapper;

    public Map<String, Object> generateArchiveContent(Map<String, Object> repairData) {
        try {
            String jsonContent = objectMapper.writeValueAsString(repairData);
            String encrypted = EncryptUtil.encrypt(jsonContent);
            String hash = EncryptUtil.sha256(jsonContent);

            Map<String, Object> result = new HashMap<>();
            result.put("archiveContent", encrypted.getBytes());
            result.put("contentHash", hash);
            result.put("encryptAlgorithm", "AES");
            result.put("archiveTime", LocalDateTime.now());
            result.put("status", 1);
            return result;
        } catch (Exception e) {
            log.error("生成档案失败", e);
            throw new RuntimeException("生成档案失败");
        }
    }

    public Map<String, Object> decryptArchive(byte[] encryptedContent) {
        try {
            String content = new String(encryptedContent);
            String decrypted = EncryptUtil.decrypt(content);
            return objectMapper.readValue(decrypted, Map.class);
        } catch (Exception e) {
            log.error("解密档案失败", e);
            throw new RuntimeException("解密档案失败");
        }
    }

    public String exportArchive(Map<String, Object> archiveData) {
        try {
            StringBuilder sb = new StringBuilder();
            sb.append("古籍修复档案导出报告\n");
            sb.append("================================\n");
            sb.append("档案编号: ").append(archiveData.get("archiveCode")).append("\n");
            sb.append("善本编号: ").append(archiveData.get("bookCode")).append("\n");
            sb.append("善本名称: ").append(archiveData.get("bookName")).append("\n");
            sb.append("修复开始时间: ").append(archiveData.get("startTime")).append("\n");
            sb.append("修复结束时间: ").append(archiveData.get("endTime")).append("\n");
            sb.append("总耗时(分钟): ").append(archiveData.get("totalDuration")).append("\n");
            sb.append("修复人员: ").append(archiveData.get("restorerNames")).append("\n");
            sb.append("质量评分: ").append(archiveData.get("qualityScore")).append("\n");
            sb.append("归档时间: ").append(archiveData.get("archiveTime")).append("\n");
            sb.append("================================\n");
            return sb.toString();
        } catch (Exception e) {
            log.error("导出档案失败", e);
            throw new RuntimeException("导出档案失败");
        }
    }
}
