package com.bamboo.defect.service;

import com.bamboo.defect.entity.DefectRecord;
import com.bamboo.defect.entity.DetectionRecord;
import com.bamboo.defect.repository.DefectRecordRepository;
import com.bamboo.defect.repository.DetectionRecordRepository;
import com.bamboo.defect.websocket.DetectionWebSocket;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
public class DetectionService {
    
    @Autowired
    private DetectionRecordRepository detectionRecordRepository;
    
    @Autowired
    private DefectRecordRepository defectRecordRepository;
    
    private volatile boolean detectionRunning = false;
    
    private static final String[] DEFECT_TYPES = {"断丝", "错位", "漏织", "污渍", "其他"};
    
    public boolean isDetectionRunning() {
        return detectionRunning;
    }
    
    public void startDetection() {
        detectionRunning = true;
        log.info("检测服务已启动");
    }
    
    public void stopDetection() {
        detectionRunning = false;
        log.info("检测服务已停止");
    }
    
    @Autowired
    private ProcessService processService;

    private double confidenceThreshold = 0.75;
    private double minDefectSize = 0.5;
    private int multiScaleLevel = 3;
    
    @Async
    @Transactional
    public void performDetection() {
        if (!detectionRunning) {
            return;
        }
        
        try {
            DetectionRecord detectionRecord = new DetectionRecord();
            detectionRecord.setProductId("BAM-" + System.currentTimeMillis());
            detectionRecord.setOperator("系统");
            
            Map<String, Object> detectionParams = processService.getAllParams();
            updateDetectionParams(detectionParams);
            
            List<DefectRecord> defects = detectBambooDefects();
            
            List<DefectRecord> postProcessedDefects = postProcessDefects(defects);
            
            detectionRecord.setDefectCount(postProcessedDefects.size());
            detectionRecord.setHasDefect(!postProcessedDefects.isEmpty());
            
            detectionRecord = detectionRecordRepository.save(detectionRecord);
            
            for (DefectRecord defect : postProcessedDefects) {
                defect.setDetectionId(detectionRecord.getId());
                defectRecordRepository.save(defect);
            }
            
            detectionRecord.setDefects(postProcessedDefects);
            
            Map<String, Object> result = new HashMap<>();
            result.put("detectionId", detectionRecord.getId());
            result.put("productId", detectionRecord.getProductId());
            result.put("defectCount", postProcessedDefects.size());
            result.put("hasDefect", !postProcessedDefects.isEmpty());
            result.put("defects", postProcessedDefects);
            result.put("timestamp", System.currentTimeMillis());
            
            DetectionWebSocket.sendDetectionResult(result);
            
            log.debug("完成一次检测，发现 {} 个缺陷（初始检测 {} 个）", 
                     postProcessedDefects.size(), defects.size());
            
        } catch (Exception e) {
            log.error("检测过程出错: {}", e.getMessage(), e);
        }
    }
    
    private void updateDetectionParams(Map<String, Object> params) {
        if (params.containsKey("detection")) {
            Map<String, Object> detectionParams = (Map<String, Object>) params.get("detection");
            if (detectionParams.containsKey("confidenceThreshold")) {
                confidenceThreshold = ((Number) detectionParams.get("confidenceThreshold")).doubleValue();
            }
            if (detectionParams.containsKey("precision")) {
                double precision = ((Number) detectionParams.get("precision")).doubleValue();
                minDefectSize = precision * 0.5;
            }
        }
    }
    
    private List<DefectRecord> detectBambooDefects() {
        List<DefectRecord> allDefects = new ArrayList<>();
        long detectionId = System.currentTimeMillis();
        
        for (int scale = 1; scale <= multiScaleLevel; scale++) {
            double scaleFactor = 1.0 / scale;
            List<DefectRecord> scaleDefects = detectAtScale(scaleFactor, scale);
            allDefects.addAll(scaleDefects);
        }
        
        allDefects.addAll(detectMicroDefects());
        allDefects.addAll(detectTextureDefects());
        allDefects.addAll(detectEdgeDefects());
        
        return allDefects;
    }
    
    private List<DefectRecord> detectAtScale(double scaleFactor, int scale) {
        List<DefectRecord> defects = new ArrayList<>();
        
        double detectionProbability = 0.6 + (scale - 1) * 0.1;
        
        if (Math.random() < detectionProbability) {
            int defectCount = (int) (Math.random() * (5 - scale + 1)) + 1;
            
            for (int i = 0; i < defectCount; i++) {
                DefectRecord defect = new DefectRecord();
                defect.setType(getDefectTypeByScale(scale));
                defect.setLevel(determineDefectLevel(scale));
                defect.setPositionX(Math.random() * 100);
                defect.setPositionY(Math.random() * 100);
                defect.setConfidence(calculateConfidence(scale));
                defect.setSize(Math.round((minDefectSize + Math.random() * (5 * scaleFactor)) * 100.0) / 100.0);
                defects.add(defect);
            }
        }
        
        return defects;
    }
    
    private List<DefectRecord> detectMicroDefects() {
        List<DefectRecord> microDefects = new ArrayList<>();
        
        if (Math.random() > 0.5) {
            int microDefectCount = (int) (Math.random() * 3) + 1;
            
            for (int i = 0; i < microDefectCount; i++) {
                DefectRecord defect = new DefectRecord();
                defect.setType("细微裂纹");
                defect.setLevel(1);
                defect.setPositionX(Math.random() * 100);
                defect.setPositionY(Math.random() * 100);
                defect.setConfidence(confidenceThreshold + Math.random() * (1.0 - confidenceThreshold));
                defect.setSize(Math.round((minDefectSize * 0.3 + Math.random() * minDefectSize) * 100.0) / 100.0);
                microDefects.add(defect);
            }
        }
        
        return microDefects;
    }
    
    private List<DefectRecord> detectTextureDefects() {
        List<DefectRecord> textureDefects = new ArrayList<>();
        
        if (Math.random() > 0.7) {
            int textureDefectCount = (int) (Math.random() * 2) + 1;
            
            for (int i = 0; i < textureDefectCount; i++) {
                DefectRecord defect = new DefectRecord();
                defect.setType("纹理异常");
                defect.setLevel((int) (Math.random() * 2) + 1);
                defect.setPositionX(Math.random() * 100);
                defect.setPositionY(Math.random() * 100);
                defect.setConfidence(confidenceThreshold + Math.random() * 0.15);
                defect.setSize(Math.round((1 + Math.random() * 3) * 100.0) / 100.0);
                textureDefects.add(defect);
            }
        }
        
        return textureDefects;
    }
    
    private List<DefectRecord> detectEdgeDefects() {
        List<DefectRecord> edgeDefects = new ArrayList<>();
        
        if (Math.random() > 0.8) {
            DefectRecord defect = new DefectRecord();
            defect.setType("边缘缺陷");
            defect.setLevel((int) (Math.random() * 3) + 1);
            defect.setPositionX(Math.random() * 20 + 40);
            defect.setPositionY(Math.random() * 20 + 40);
            defect.setConfidence(confidenceThreshold + Math.random() * 0.2);
            defect.setSize(Math.round((2 + Math.random() * 4) * 100.0) / 100.0);
            edgeDefects.add(defect);
        }
        
        return edgeDefects;
    }
    
    private String getDefectTypeByScale(int scale) {
        switch (scale) {
            case 1:
                return DEFECT_TYPES[(int) (Math.random() * 2)];
            case 2:
                return DEFECT_TYPES[(int) (Math.random() * 3) + 1];
            case 3:
            default:
                return DEFECT_TYPES[(int) (Math.random() * DEFECT_TYPES.length)];
        }
    }
    
    private int determineDefectLevel(int scale) {
        double random = Math.random();
        if (scale == 1) {
            if (random < 0.7) return 1;
            if (random < 0.95) return 2;
            return 3;
        } else if (scale == 2) {
            if (random < 0.5) return 1;
            if (random < 0.85) return 2;
            return 3;
        } else {
            if (random < 0.3) return 1;
            if (random < 0.7) return 2;
            return 3;
        }
    }
    
    public DefectRecord calculateSeverityLevel(DefectRecord defect) {
        double severityScore = 0.0;
        
        double sizeScore = calculateSizeScore(defect.getSize());
        severityScore += sizeScore * 0.35;
        
        double typeScore = calculateTypeScore(defect.getType());
        severityScore += typeScore * 0.30;
        
        double positionScore = calculatePositionScore(defect.getPositionX(), defect.getPositionY());
        severityScore += positionScore * 0.20;
        
        double confidenceScore = defect.getConfidence();
        severityScore += confidenceScore * 0.15;
        
        int level;
        String levelName;
        if (severityScore < 0.4) {
            level = 1;
            levelName = "轻微";
        } else if (severityScore < 0.7) {
            level = 2;
            levelName = "一般";
        } else {
            level = 3;
            levelName = "严重";
        }
        
        defect.setSeverityScore(Math.round(severityScore * 1000.0) / 1000.0);
        defect.setLevel(level);
        defect.setLevelName(levelName);
        defect.setDescription(generateDefectDescription(defect));
        
        return defect;
    }
    
    private double calculateSizeScore(Double size) {
        if (size == null) return 0.5;
        if (size < 1.0) return 0.2;
        if (size < 3.0) return 0.5;
        if (size < 6.0) return 0.8;
        return 1.0;
    }
    
    private double calculateTypeScore(String type) {
        if (type == null) return 0.5;
        switch (type) {
            case "断丝":
                return 0.95;
            case "边缘缺陷":
                return 0.85;
            case "错位":
                return 0.75;
            case "漏织":
                return 0.70;
            case "纹理异常":
                return 0.50;
            case "污渍":
                return 0.40;
            case "细微裂纹":
                return 0.35;
            default:
                return 0.5;
        }
    }
    
    private double calculatePositionScore(Double x, Double y) {
        if (x == null || y == null) return 0.5;
        
        double centerX = 50.0;
        double centerY = 50.0;
        double distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        double maxDistance = Math.sqrt(Math.pow(50, 2) + Math.pow(50, 2));
        
        double normalizedDistance = distance / maxDistance;
        return 1.0 - normalizedDistance * 0.6;
    }
    
    private String generateDefectDescription(DefectRecord defect) {
        StringBuilder sb = new StringBuilder();
        sb.append("发现").append(defect.getLevelName()).append("程度的").append(defect.getType());
        sb.append("，尺寸约").append(String.format("%.2f", defect.getSize())).append("mm");
        sb.append("，位于坐标(").append(String.format("%.1f", defect.getPositionX())).append(", ");
        sb.append(String.format("%.1f", defect.getPositionY())).append(")");
        sb.append("，置信度").append(String.format("%.1f%%", defect.getConfidence() * 100));
        return sb.toString();
    }
    
    private double calculateConfidence(int scale) {
        double baseConfidence = confidenceThreshold;
        double scaleBonus = (multiScaleLevel - scale + 1) * 0.05;
        double randomVariance = Math.random() * 0.15;
        return Math.min(1.0, baseConfidence + scaleBonus + randomVariance);
    }
    
    private List<DefectRecord> postProcessDefects(List<DefectRecord> defects) {
        List<DefectRecord> result = new ArrayList<>();
        
        List<DefectRecord> filteredByConfidence = new ArrayList<>();
        for (DefectRecord defect : defects) {
            if (defect.getConfidence() >= confidenceThreshold) {
                filteredByConfidence.add(defect);
            }
        }
        
        List<DefectRecord> filteredBySize = new ArrayList<>();
        for (DefectRecord defect : filteredByConfidence) {
            if (defect.getSize() >= minDefectSize) {
                filteredBySize.add(defect);
            }
        }
        
        result = applyNonMaximumSuppression(filteredBySize);
        result = mergeOverlappingDefects(result);
        
        for (DefectRecord defect : result) {
            calculateSeverityLevel(defect);
        }
        
        return result;
    }
    
    private List<DefectRecord> applyNonMaximumSuppression(List<DefectRecord> defects) {
        if (defects.isEmpty()) return defects;
        
        List<DefectRecord> sorted = new ArrayList<>(defects);
        sorted.sort((a, b) -> Double.compare(b.getConfidence(), a.getConfidence()));
        
        List<DefectRecord> result = new ArrayList<>();
        boolean[] suppressed = new boolean[sorted.size()];
        
        for (int i = 0; i < sorted.size(); i++) {
            if (suppressed[i]) continue;
            
            DefectRecord current = sorted.get(i);
            result.add(current);
            
            for (int j = i + 1; j < sorted.size(); j++) {
                if (suppressed[j]) continue;
                
                DefectRecord other = sorted.get(j);
                double distance = calculateDistance(current, other);
                
                if (distance < 5.0) {
                    suppressed[j] = true;
                }
            }
        }
        
        return result;
    }
    
    private List<DefectRecord> mergeOverlappingDefects(List<DefectRecord> defects) {
        if (defects.size() < 2) return defects;
        
        List<DefectRecord> result = new ArrayList<>();
        boolean[] merged = new boolean[defects.size()];
        
        for (int i = 0; i < defects.size(); i++) {
            if (merged[i]) continue;
            
            DefectRecord current = defects.get(i);
            List<DefectRecord> toMerge = new ArrayList<>();
            toMerge.add(current);
            
            for (int j = i + 1; j < defects.size(); j++) {
                if (merged[j]) continue;
                
                DefectRecord other = defects.get(j);
                double distance = calculateDistance(current, other);
                
                if (distance < 8.0 && current.getType().equals(other.getType())) {
                    toMerge.add(other);
                    merged[j] = true;
                }
            }
            
            if (toMerge.size() > 1) {
                DefectRecord mergedDefect = mergeDefectGroup(toMerge);
                result.add(mergedDefect);
            } else {
                result.add(current);
            }
        }
        
        return result;
    }
    
    private DefectRecord mergeDefectGroup(List<DefectRecord> group) {
        if (group.size() == 1) return group.get(0);
        
        double totalWeight = 0;
        double weightedX = 0;
        double weightedY = 0;
        double maxConfidence = 0;
        double maxSize = 0;
        int maxLevel = 0;
        
        for (DefectRecord defect : group) {
            double weight = defect.getConfidence();
            totalWeight += weight;
            weightedX += defect.getPositionX() * weight;
            weightedY += defect.getPositionY() * weight;
            maxConfidence = Math.max(maxConfidence, defect.getConfidence());
            maxSize = Math.max(maxSize, defect.getSize());
            maxLevel = Math.max(maxLevel, defect.getLevel());
        }
        
        DefectRecord merged = new DefectRecord();
        merged.setType(group.get(0).getType());
        merged.setLevel(maxLevel);
        merged.setPositionX(Math.round(weightedX / totalWeight * 100.0) / 100.0);
        merged.setPositionY(Math.round(weightedY / totalWeight * 100.0) / 100.0);
        merged.setConfidence(Math.round(maxConfidence * 1000.0) / 1000.0);
        merged.setSize(Math.round(maxSize * 100.0) / 100.0);
        
        return merged;
    }
    
    private double calculateDistance(DefectRecord a, DefectRecord b) {
        double dx = a.getPositionX() - b.getPositionX();
        double dy = a.getPositionY() - b.getPositionY();
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    private int calculateFinalLevel(DefectRecord defect) {
        double size = defect.getSize();
        double confidence = defect.getConfidence();
        
        if (size > 5.0 && confidence > 0.9) return 3;
        if (size > 3.0 && confidence > 0.85) return 3;
        if (size > 2.0 && confidence > 0.8) return 2;
        if (size > 1.0 && confidence > 0.75) return 2;
        return 1;
    }
    
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime todayStart = now.toLocalDate().atStartOfDay();
        LocalDateTime weekStart = now.minusDays(7);
        
        Long totalCount = detectionRecordRepository.countByTimeRange(weekStart, now);
        Long defectCount = detectionRecordRepository.countDefectsByTimeRange(weekStart, now);
        Long todayTotal = detectionRecordRepository.countByTimeRange(todayStart, now);
        Long todayDefect = detectionRecordRepository.countDefectsByTimeRange(todayStart, now);
        
        double passRate = totalCount > 0 ? (double) (totalCount - defectCount) / totalCount * 100 : 100;
        
        stats.put("totalCount", totalCount);
        stats.put("defectCount", defectCount);
        stats.put("passCount", totalCount - defectCount);
        stats.put("warningCount", (int) (defectCount * 0.3));
        stats.put("passRate", Math.round(passRate * 100.0) / 100.0);
        stats.put("todayTotal", todayTotal);
        stats.put("todayDefect", todayDefect);
        stats.put("detectionRunning", detectionRunning);
        
        return stats;
    }
    
    public DetectionRecord getLatestRecord() {
        return detectionRecordRepository.findTopByOrderByTimestampDesc();
    }
    
    public List<DetectionRecord> getRecentRecords(int limit) {
        return detectionRecordRepository.findTop10ByOrderByTimestampDesc();
    }
    
    public Page<DetectionRecord> getHistory(int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DetectionRecord> records = detectionRecordRepository.findAllByOrderByTimestampDesc(pageable);
        
        for (DetectionRecord record : records) {
            List<DefectRecord> defects = defectRecordRepository.findByDetectionIdOrderByLevelDesc(record.getId());
            record.setDefects(defects);
        }
        
        return records;
    }
    
    public List<DefectRecord> getRecentDefects(int limit) {
        return defectRecordRepository.findTop10ByOrderByTimestampDesc();
    }
    
    @Transactional
    public boolean markHandled(Long id) {
        Optional<DefectRecord> optional = defectRecordRepository.findById(id);
        if (optional.isPresent()) {
            DefectRecord defect = optional.get();
            defect.setHandled(true);
            defectRecordRepository.save(defect);
            return true;
        }
        return false;
    }
}
