package com.bamboo.defect.task;

import com.bamboo.defect.service.DetectionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class DetectionTask {
    
    @Autowired
    private DetectionService detectionService;
    
    @Scheduled(fixedRate = 2000)
    public void detectionTask() {
        if (detectionService.isDetectionRunning()) {
            detectionService.performDetection();
        }
    }
}
