package com.ancient.book.image.controller;

import com.ancient.book.common.entity.ExportConfig;
import com.ancient.book.image.service.AncientBookExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final AncientBookExportService exportService;

    @PostMapping("/batch")
    public ResponseEntity<Map<String, String>> startBatchExport(@RequestBody ExportConfig config) {
        log.info("开始批量导出: 书名={}, 页数={}, 格式={}",
                config.getBookName(), config.getPageIds().size(), config.getFormat());

        String taskId = exportService.startBatchExport(config);

        return ResponseEntity.ok(Map.of(
                "taskId", taskId,
                "message", "导出任务已启动"
        ));
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<Map<String, Object>> getExportStatus(@PathVariable String taskId) {
        log.info("查询导出状态: taskId={}", taskId);
        Map<String, Object> status = exportService.getExportStatus(taskId);
        return ResponseEntity.ok(status);
    }

    @GetMapping("/download/{taskId}")
    public ResponseEntity<byte[]> downloadExport(@PathVariable String taskId) throws IOException {
        log.info("下载导出文件: taskId={}", taskId);

        byte[] fileContent = exportService.downloadExport(taskId);
        Map<String, Object> status = exportService.getExportStatus(taskId);
        String fileName = (String) status.get("fileName");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(getMediaTypeForFileName(fileName));
        headers.setContentDispositionFormData("attachment",
                URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        headers.setContentLength(fileContent.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(fileContent);
    }

    @GetMapping("/formats")
    public ResponseEntity<Map<String, Object>> getExportFormats() {
        log.info("获取支持的导出格式");
        Map<String, Object> formats = exportService.getExportFormats();
        return ResponseEntity.ok(formats);
    }

    @PostMapping("/preview")
    public ResponseEntity<Map<String, Object>> previewExport(@RequestBody ExportConfig config) {
        log.info("预览导出配置: 格式={}, 布局={}", config.getFormat(), config.getLayout());

        Map<String, Object> preview = Map.of(
                "estimatedSize", config.getPageIds().size() * 50 + "KB",
                "estimatedTime", config.getPageIds().size() * 2 + "秒",
                "configValid", true,
                "previewUrl", "/api/export/preview/sample"
        );

        return ResponseEntity.ok(preview);
    }

    @PostMapping("/multi-format")
    public ResponseEntity<byte[]> exportMultipleFormats(@RequestBody ExportConfig config) throws IOException {
        log.info("多格式导出: 书名={}, 页数={}", config.getBookName(), config.getPageIds().size());

        byte[] zipContent = exportService.exportMultipleFormats(config);
        String fileName = config.getBookName() + "_多格式导出.zip";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment",
                URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        headers.setContentLength(zipContent.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(zipContent);
    }

    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, String>> cleanupOldExports(@RequestParam(defaultValue = "24") int hours) {
        log.info("清理旧导出文件: {}小时前", hours);
        exportService.cleanupOldExports(hours);
        return ResponseEntity.ok(Map.of(
                "message", "清理完成",
                "hours", String.valueOf(hours)
        ));
    }

    private MediaType getMediaTypeForFileName(String fileName) {
        if (fileName.endsWith(".pdf")) {
            return MediaType.APPLICATION_PDF;
        } else if (fileName.endsWith(".html")) {
            return MediaType.TEXT_HTML;
        } else if (fileName.endsWith(".txt")) {
            return MediaType.TEXT_PLAIN;
        } else if (fileName.endsWith(".zip")) {
            return MediaType.APPLICATION_OCTET_STREAM;
        } else {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
