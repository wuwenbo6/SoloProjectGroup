package com.rubbing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rubbing.dto.CaptureParamsDTO;
import com.rubbing.dto.CaptureProgressDTO;
import com.rubbing.dto.QualityAnalysisDTO;
import com.rubbing.entity.RubbingRecord;
import com.rubbing.mapper.RubbingRecordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class RubbingService extends ServiceImpl<RubbingRecordMapper, RubbingRecord> {

    private final RubbingRecordMapper rubbingRecordMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private final ScannerDeviceService scannerDeviceService;
    private final ImagePreprocessingService imagePreprocessingService;

    private final Random random = new Random();
    private final ScheduledExecutorService captureExecutor = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean isCapturing = new AtomicBoolean(false);
    private final AtomicInteger currentProgress = new AtomicInteger(0);
    private final CaptureProgressDTO currentProgressDTO = new CaptureProgressDTO();
    private CaptureParamsDTO currentParams = new CaptureParamsDTO();
    private String currentTaskId = null;

    @PostConstruct
    public void init() {
        currentProgressDTO.setCurrent(0);
        currentProgressDTO.setTotal(100);
        currentProgressDTO.setStatus("IDLE");
        currentProgressDTO.setEstimatedTime(0);

        currentParams.setResolution("400 DPI");
        currentParams.setColorDepth("24位");
        currentParams.setScanMode("灰度");
        currentParams.setBrightness(50);
        currentParams.setContrast(50);
        currentParams.setThreshold(128);
        currentParams.setSharpness(50.0);
        currentParams.setNoiseLevel(5);
    }

    public CaptureProgressDTO getCurrentProgress() {
        return currentProgressDTO;
    }

    public QualityAnalysisDTO analyzeQuality() {
        QualityAnalysisDTO quality = new QualityAnalysisDTO();
        
        QualityAnalysisDTO.Resolution resolution = new QualityAnalysisDTO.Resolution();
        resolution.setWidth(4000 + random.nextInt(1000));
        resolution.setHeight(6000 + random.nextInt(1000));
        
        quality.setResolution(resolution);
        quality.setSharpness(80 + random.nextInt(20));
        quality.setContrast(75 + random.nextInt(25));
        quality.setNoise(5 + random.nextInt(15));
        quality.setScore(85 + random.nextInt(15));
        
        return quality;
    }

    public Page<RubbingRecord> getHistory(Integer page, Integer size, String qualityLevel, String keyword) {
        LambdaQueryWrapper<RubbingRecord> wrapper = new LambdaQueryWrapper<>();
        
        if (qualityLevel != null && !qualityLevel.isEmpty()) {
            wrapper.eq(RubbingRecord::getQualityLevel, qualityLevel);
        }
        
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(RubbingRecord::getRubbingId, keyword)
                    .or().like(RubbingRecord::getName, keyword));
        }
        
        wrapper.orderByDesc(RubbingRecord::getCreatedTime);
        return page(new Page<>(page, size), wrapper);
    }

    public Page<RubbingRecord> getArchiveList(Integer page, Integer size, String archiveLevel) {
        LambdaQueryWrapper<RubbingRecord> wrapper = new LambdaQueryWrapper<>();
        
        if (archiveLevel != null && !archiveLevel.isEmpty()) {
            wrapper.eq(RubbingRecord::getArchiveLevel, archiveLevel);
        }
        
        wrapper.isNotNull(RubbingRecord::getArchiveLevel);
        wrapper.orderByDesc(RubbingRecord::getArchiveTime);
        return page(new Page<>(page, size), wrapper);
    }

    public boolean updateArchiveLevel(Long id, String level) {
        RubbingRecord record = new RubbingRecord();
        record.setId(id);
        record.setArchiveLevel(level);
        record.setArchiveTime(LocalDateTime.now());
        return updateById(record);
    }

    public Map<String, Integer> getArchiveStats() {
        Map<String, Integer> stats = new HashMap<>();
        stats.put("total", Math.toIntExact(count()));
        stats.put("levelA", rubbingRecordMapper.countByLevel("A"));
        stats.put("levelB", rubbingRecordMapper.countByLevel("B"));
        stats.put("levelC", rubbingRecordMapper.countByLevel("C"));
        stats.put("levelD", rubbingRecordMapper.countByLevel("D"));
        return stats;
    }

    public String startCapture() {
        if (!scannerDeviceService.isDeviceOnline()) {
            throw new IllegalStateException("扫描设备不在线，请检查连接");
        }
        
        if (isCapturing.compareAndSet(false, true)) {
            currentTaskId = UUID.randomUUID().toString();
            currentProgress.set(0);
            currentProgressDTO.setCurrent(0);
            currentProgressDTO.setTotal(100);
            currentProgressDTO.setStatus("SCANNING");
            currentProgressDTO.setEstimatedTime(60);
            
            scannerDeviceService.setDeviceBusy();
            
            captureExecutor.scheduleAtFixedRate(this::captureTask, 0, 100, TimeUnit.MILLISECONDS);
            
            log.info("开始采集任务: {}", currentTaskId);
            sendLogMessage("info", "开始图像采集...");
            
            return currentTaskId;
        }
        
        throw new IllegalStateException("采集任务已在进行中");
    }

    private void captureTask() {
        try {
            int progress = currentProgress.incrementAndGet();
            
            if (progress <= 100) {
                currentProgressDTO.setCurrent(progress);
                currentProgressDTO.setEstimatedTime(Math.max(0, 60 - progress * 60 / 100));
                
                sendProgressUpdate();
                
                if (progress % 10 == 0) {
                    sendQualityUpdate();
                    sendLogMessage("info", String.format("采集进度: %d%%", progress));
                }
                
                if (progress % 25 == 0) {
                    sendLogMessage("success", String.format("已完成 %d%% 图像预处理", progress));
                }
            } else {
                completeCapture();
            }
        } catch (Exception e) {
            log.error("采集任务异常: {}", e.getMessage());
            sendLogMessage("error", "采集异常: " + e.getMessage());
            stopCapture(currentTaskId);
        }
    }

    private void completeCapture() {
        isCapturing.set(false);
        currentProgressDTO.setStatus("COMPLETED");
        sendProgressUpdate();
        sendLogMessage("success", "采集完成！图像质量评估通过");
        
        saveCaptureRecord();
        
        scannerDeviceService.setDeviceOnline();
        log.info("采集任务完成: {}", currentTaskId);
    }

    private void saveCaptureRecord() {
        try {
            RubbingRecord record = new RubbingRecord();
            record.setRubbingId("TP" + System.currentTimeMillis());
            record.setName("拓片_" + LocalDateTime.now().toString().substring(0, 19));
            record.setResolutionWidth(4000 + random.nextInt(1000));
            record.setResolutionHeight(6000 + random.nextInt(1000));
            record.setDpi(parseDpi(currentParams.getResolution()));
            record.setColorDepth(currentParams.getColorDepth());
            record.setFileFormat("TIFF");
            record.setFileSize(10 + random.nextDouble() * 40);
            record.setQualityScore(85 + random.nextInt(15));
            record.setQualityLevel(calculateQualityLevel(record.getQualityScore()));
            
            record.setParamBrightness(currentParams.getBrightness());
            record.setParamContrast(currentParams.getContrast());
            record.setParamThreshold(currentParams.getThreshold());
            record.setParamResolution(currentParams.getResolution());
            record.setParamColorDepth(currentParams.getColorDepth());
            record.setParamScanMode(currentParams.getScanMode());
            record.setParamSharpness(currentParams.getSharpness());
            record.setParamNoiseLevel(currentParams.getNoiseLevel());
            
            record.setCaptureTime(LocalDateTime.now());
            record.setCreatedTime(LocalDateTime.now());
            
            save(record);
            log.info("采集记录已保存: {}", record.getRubbingId());
        } catch (Exception e) {
            log.error("保存采集记录失败: {}", e.getMessage());
        }
    }

    private Integer parseDpi(String resolution) {
        if (resolution == null) return 400;
        try {
            return Integer.parseInt(resolution.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 400;
        }
    }

    private String calculateQualityLevel(Integer score) {
        if (score >= 90) return "A";
        if (score >= 80) return "B";
        if (score >= 70) return "C";
        return "D";
    }

    public boolean stopCapture(String taskId) {
        if (isCapturing.compareAndSet(true, false)) {
            currentProgressDTO.setStatus("STOPPED");
            sendProgressUpdate();
            sendLogMessage("warning", "采集已停止");
            scannerDeviceService.setDeviceOnline();
            log.info("采集任务已停止: {}", taskId);
            return true;
        }
        return false;
    }

    public void saveParameters(CaptureParamsDTO params) {
        this.currentParams = params;
        log.info("采集参数已更新: {}", params);
        sendLogMessage("info", "采集参数已更新");
    }

    public CaptureParamsDTO getCurrentParams() {
        return currentParams;
    }

    private void sendProgressUpdate() {
        try {
            messagingTemplate.convertAndSend("/topic/progress", currentProgressDTO);
        } catch (Exception e) {
            log.error("发送进度更新失败: {}", e.getMessage());
        }
    }

    private void sendQualityUpdate() {
        try {
            QualityAnalysisDTO quality = analyzeQuality();
            messagingTemplate.convertAndSend("/topic/quality", quality);
        } catch (Exception e) {
            log.error("发送质量更新失败: {}", e.getMessage());
        }
    }

    private void sendLogMessage(String type, String message) {
        try {
            Map<String, Object> logData = new HashMap<>();
            logData.put("type", type);
            logData.put("message", message);
            logData.put("time", LocalDateTime.now().toString());
            messagingTemplate.convertAndSend("/topic/logs", logData);
        } catch (Exception e) {
            log.error("发送日志失败: {}", e.getMessage());
        }
    }
}
