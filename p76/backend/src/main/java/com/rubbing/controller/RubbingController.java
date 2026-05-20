package com.rubbing.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rubbing.common.Result;
import com.rubbing.dto.CaptureParamsDTO;
import com.rubbing.dto.CaptureProgressDTO;
import com.rubbing.dto.QualityAnalysisDTO;
import com.rubbing.entity.RubbingRecord;
import com.rubbing.service.RubbingService;
import com.rubbing.service.ScannerDeviceService;
import com.rubbing.service.ImageEnhancementService;
import com.rubbing.service.ReportExportService;
import com.rubbing.service.ParameterAlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.awt.image.BufferedImage;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rubbing")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RubbingController {

    private final RubbingService rubbingService;
    private final ScannerDeviceService scannerDeviceService;
    private final ImageEnhancementService imageEnhancementService;
    private final ReportExportService reportExportService;
    private final ParameterAlertService parameterAlertService;

    @PostMapping("/start")
    public Result<String> startCapture() {
        try {
            String taskId = rubbingService.startCapture();
            return Result.success("采集开始", taskId);
        } catch (IllegalStateException e) {
            return Result.error(400, e.getMessage());
        }
    }

    @PostMapping("/stop")
    public Result<Void> stopCapture(@RequestParam String taskId) {
        boolean success = rubbingService.stopCapture(taskId);
        return success ? Result.success() : Result.error("停止失败");
    }

    @GetMapping("/progress")
    public Result<CaptureProgressDTO> getProgress() {
        CaptureProgressDTO progress = rubbingService.getCurrentProgress();
        return Result.success(progress);
    }

    @GetMapping("/quality")
    public Result<QualityAnalysisDTO> getQuality() {
        QualityAnalysisDTO quality = rubbingService.analyzeQuality();
        return Result.success(quality);
    }

    @PostMapping("/parameters")
    public Result<Void> saveParameters(@RequestBody CaptureParamsDTO params) {
        rubbingService.saveParameters(params);
        return Result.success("参数保存成功");
    }

    @GetMapping("/parameters")
    public Result<CaptureParamsDTO> getParameters() {
        return Result.success(rubbingService.getCurrentParams());
    }

    @GetMapping("/device/status")
    public Result<Map<String, Object>> getDeviceStatus() {
        return Result.success(scannerDeviceService.getDeviceStatus());
    }

    @PostMapping("/device/reconnect")
    public Result<Void> reconnectDevice() {
        scannerDeviceService.forceReconnect();
        return Result.success("设备重连指令已发送");
    }

    @GetMapping("/history")
    public Result<Page<RubbingRecord>> getHistory(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String qualityLevel,
            @RequestParam(required = false) String keyword) {
        Page<RubbingRecord> result = rubbingService.getHistory(page, size, qualityLevel, keyword);
        return Result.success(result);
    }

    @GetMapping("/archive")
    public Result<Page<RubbingRecord>> getArchiveList(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String archiveLevel) {
        Page<RubbingRecord> result = rubbingService.getArchiveList(page, size, archiveLevel);
        return Result.success(result);
    }

    @GetMapping("/archive/stats")
    public Result<Map<String, Integer>> getArchiveStats() {
        Map<String, Integer> stats = rubbingService.getArchiveStats();
        return Result.success(stats);
    }

    @PutMapping("/archive/{id}/level")
    public Result<Void> updateArchiveLevel(
            @PathVariable Long id,
            @RequestBody Map<String, String> params) {
        String level = params.get("level");
        boolean success = rubbingService.updateArchiveLevel(id, level);
        return success ? Result.success() : Result.error("更新失败");
    }

    @GetMapping("/{id}")
    public Result<RubbingRecord> getDetail(@PathVariable Long id) {
        RubbingRecord record = rubbingService.getById(id);
        return record != null ? Result.success(record) : Result.error("记录不存在");
    }

    @PostMapping("/image/enhance")
    public Result<Map<String, String>> enhanceImage(@RequestBody Map<String, Object> params) {
        String type = (String) params.get("type");
        Double intensity = params.get("intensity") != null ? Double.valueOf(params.get("intensity").toString()) : 50.0;
        
        int width = params.get("width") != null ? Integer.parseInt(params.get("width").toString()) : 800;
        int height = params.get("height") != null ? Integer.parseInt(params.get("height").toString()) : 600;
        
        BufferedImage originalImage = generateSampleImage(width, height);
        BufferedImage enhancedImage = imageEnhancementService.applyEnhancement(originalImage, type, intensity);
        
        byte[] originalBytes = imageEnhancementService.imageToBase64(originalImage);
        byte[] enhancedBytes = imageEnhancementService.imageToBase64(enhancedImage);
        
        String originalBase64 = "data:image/png;base64," + Base64.getEncoder().encodeToString(originalBytes);
        String enhancedBase64 = "data:image/png;base64," + Base64.getEncoder().encodeToString(enhancedBytes);
        
        return Result.success(Map.of(
            "original", originalBase64,
            "enhanced", enhancedBase64,
            "type", type
        ));
    }

    private BufferedImage generateSampleImage(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int gray = (int) (128 + Math.sin(x * 0.05) * 50 + Math.cos(y * 0.05) * 50);
                int noise = (int) (Math.random() * 20 - 10);
                gray = Math.max(0, Math.min(255, gray + noise));
                image.setRGB(x, y, (gray << 16) | (gray << 8) | gray);
            }
        }
        return image;
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(required = false) String qualityLevel,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime) {
        
        byte[] excelBytes = reportExportService.exportToExcel(qualityLevel, keyword, startTime, endTime);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        String filename = "rubbing_report_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".xlsx";
        headers.setContentDispositionFormData("attachment", filename);
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(excelBytes);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportCSV(
            @RequestParam(required = false) String qualityLevel,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime) {
        
        String csvContent = reportExportService.generateCSV(qualityLevel, keyword, startTime, endTime);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        String filename = "rubbing_report_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".csv";
        headers.setContentDispositionFormData("attachment", filename);
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(csvContent);
    }

    @PostMapping("/alerts/check")
    public Result<Void> checkParameters(@RequestBody Map<String, Integer> params) {
        parameterAlertService.checkParameters(params);
        return Result.success();
    }

    @GetMapping("/alerts/history")
    public Result<List<ParameterAlertService.AlertRecord>> getAlertHistory() {
        return Result.success(parameterAlertService.getAlertHistory());
    }

    @PostMapping("/alerts/history/clear")
    public Result<Void> clearAlertHistory() {
        parameterAlertService.clearAlertHistory();
        return Result.success();
    }

    @GetMapping("/alerts/thresholds")
    public Result<Map<String, ParameterAlertService.ParameterThreshold>> getThresholds() {
        return Result.success(parameterAlertService.getAllThresholds());
    }

    @PutMapping("/alerts/thresholds/{paramName}")
    public Result<Void> updateThreshold(
            @PathVariable String paramName,
            @RequestBody ParameterAlertService.ParameterThreshold threshold) {
        parameterAlertService.updateThreshold(paramName, threshold);
        return Result.success();
    }
}
