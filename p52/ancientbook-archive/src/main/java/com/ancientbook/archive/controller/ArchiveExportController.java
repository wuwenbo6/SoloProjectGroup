package com.ancientbook.archive.controller;

import com.ancientbook.archive.service.ArchiveExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/archive/export")
@RequiredArgsConstructor
public class ArchiveExportController {

    private final ArchiveExportService exportService;

    @PostMapping("/batch")
    public Map<String, Object> createBatchExportTask(
            @RequestBody List<String> archiveCodes,
            @RequestParam String operatorId) {
        String taskId = exportService.createBatchExportTask(archiveCodes, operatorId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", taskId);
        result.put("message", "导出任务已创建，请稍后查询任务状态");
        result.put("totalCount", archiveCodes.size());
        return result;
    }

    @GetMapping("/status/{taskId}")
    public Map<String, Object> getTaskStatus(@PathVariable String taskId) {
        ArchiveExportService.ExportTask task = exportService.getTaskStatus(taskId);
        if (task == null) {
            throw new RuntimeException("任务不存在");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", task.getTaskId());
        result.put("totalCount", task.getTotalCount());
        result.put("progress", task.getProgress());
        result.put("status", task.getStatus());
        result.put("statusText", switch (task.getStatus()) {
            case 0 -> "待处理";
            case 1 -> "处理中";
            case 2 -> "已完成";
            case 3 -> "失败";
            default -> "未知";
        });
        result.put("fileName", task.getFileName());
        result.put("fileSize", task.getFileSize());
        result.put("errorMsg", task.getErrorMsg());
        result.put("createTime", task.getCreateTime());
        return result;
    }

    @GetMapping("/download/{taskId}")
    public ResponseEntity<byte[]> downloadTaskResult(@PathVariable String taskId) {
        byte[] data = exportService.downloadTaskResult(taskId);
        ArchiveExportService.ExportTask task = exportService.getTaskStatus(taskId);

        String fileName = task.getFileName();
        try {
            fileName = URLEncoder.encode(fileName, "UTF-8").replaceAll("\\+", "%20");
        } catch (Exception e) {
            log.warn("文件名编码失败", e);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(data.length)
                .body(data);
    }

    @GetMapping("/single/{archiveCode}")
    public ResponseEntity<byte[]> exportSingleArchive(@PathVariable String archiveCode) {
        byte[] data = exportService.exportSingleArchive(archiveCode);
        String fileName = "档案_" + archiveCode + ".pdf";
        try {
            fileName = URLEncoder.encode(fileName, "UTF-8").replaceAll("\\+", "%20");
        } catch (Exception e) {
            log.warn("文件名编码失败", e);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(data.length)
                .body(data);
    }

    @PostMapping("/multiple")
    public ResponseEntity<byte[]> exportMultipleArchives(@RequestBody List<String> archiveCodes) {
        byte[] data = exportService.exportMultipleArchives(archiveCodes);
        String fileName = "批量导出_" + System.currentTimeMillis() + ".pdf";
        try {
            fileName = URLEncoder.encode(fileName, "UTF-8").replaceAll("\\+", "%20");
        } catch (Exception e) {
            log.warn("文件名编码失败", e);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(data.length)
                .body(data);
    }

    @PostMapping("/zip")
    public ResponseEntity<byte[]> exportAsZip(@RequestBody List<String> archiveCodes) throws Exception {
        byte[] data = exportService.exportAsZip(archiveCodes);
        String fileName = "档案批量导出_" + System.currentTimeMillis() + ".zip";
        try {
            fileName = URLEncoder.encode(fileName, "UTF-8").replaceAll("\\+", "%20");
        } catch (Exception e) {
            log.warn("文件名编码失败", e);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentType(MediaType.parseMediaType("application/zip"))
                .contentLength(data.length)
                .body(data);
    }
}
