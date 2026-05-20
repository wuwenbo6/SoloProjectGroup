package com.bamboo.defect.controller;

import com.bamboo.defect.service.ExportService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/export")
@CrossOrigin
public class ExportController {
    
    @Autowired
    private ExportService exportService;
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    
    @GetMapping("/detections")
    public ResponseEntity<byte[]> exportDetections(
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(defaultValue = "excel") String format) {
        
        try {
            LocalDateTime start = startTime != null ? 
                LocalDateTime.parse(startTime + "T00:00:00") : 
                LocalDateTime.now().minusDays(30);
            LocalDateTime end = endTime != null ? 
                LocalDateTime.parse(endTime + "T23:59:59") : 
                LocalDateTime.now();
            
            byte[] data = exportService.exportDetectionRecords(start, end, format);
            
            String filename = "检测记录_" + DATE_FORMATTER.format(start) + "_" + DATE_FORMATTER.format(end);
            String extension = "excel".equalsIgnoreCase(format) ? ".xlsx" : ".csv";
            String contentType = "excel".equalsIgnoreCase(format) ? 
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : 
                "text/csv;charset=UTF-8";
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentDispositionFormData("attachment", 
                new String((filename + extension).getBytes("UTF-8"), "ISO-8859-1"));
            
            return ResponseEntity.ok().headers(headers).body(data);
            
        } catch (Exception e) {
            log.error("导出检测记录失败", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    @GetMapping("/defects")
    public ResponseEntity<byte[]> exportDefects(
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) Integer level,
            @RequestParam(defaultValue = "excel") String format) {
        
        try {
            LocalDateTime start = startTime != null ? 
                LocalDateTime.parse(startTime + "T00:00:00") : 
                LocalDateTime.now().minusDays(30);
            LocalDateTime end = endTime != null ? 
                LocalDateTime.parse(endTime + "T23:59:59") : 
                LocalDateTime.now();
            
            byte[] data = exportService.exportDefectRecords(start, end, level, format);
            
            String filename = "缺陷记录_" + DATE_FORMATTER.format(start) + "_" + DATE_FORMATTER.format(end);
            if (level != null) {
                String[] levelNames = {"", "轻微", "一般", "严重"};
                filename += "_" + levelNames[level];
            }
            String extension = "excel".equalsIgnoreCase(format) ? ".xlsx" : ".csv";
            String contentType = "excel".equalsIgnoreCase(format) ? 
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : 
                "text/csv;charset=UTF-8";
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentDispositionFormData("attachment", 
                new String((filename + extension).getBytes("UTF-8"), "ISO-8859-1"));
            
            return ResponseEntity.ok().headers(headers).body(data);
            
        } catch (Exception e) {
            log.error("导出缺陷记录失败", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    @GetMapping("/statistics")
    public Map<String, Object> getExportStatistics(
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        
        Map<String, Object> result = new HashMap<>();
        
        try {
            LocalDateTime start = startTime != null ? 
                LocalDateTime.parse(startTime + "T00:00:00") : 
                LocalDateTime.now().minusDays(30);
            LocalDateTime end = endTime != null ? 
                LocalDateTime.parse(endTime + "T23:59:59") : 
                LocalDateTime.now();
            
            result.put("success", true);
            result.put("startTime", start);
            result.put("endTime", end);
            result.put("formats", new String[]{"excel", "csv"});
            result.put("levels", new Object[][]{
                {1, "轻微"},
                {2, "一般"},
                {3, "严重"}
            });
            
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        
        return result;
    }
}
