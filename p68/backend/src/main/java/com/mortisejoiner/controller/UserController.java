package com.mortisejoiner.controller;

import com.mortisejoiner.entity.user.LearningProgress;
import com.mortisejoiner.entity.user.User;
import com.mortisejoiner.repository.user.UserRepository;
import com.mortisejoiner.service.LearningProgressService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "*", maxAge = 3600)
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    @Autowired
    private LearningProgressService progressService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/progress")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<List<LearningProgress>> getUserProgress(Authentication authentication) {
        long startTime = System.currentTimeMillis();
        String username = authentication.getName();
        Long userId = getUserIdByUsername(username);
        List<LearningProgress> progressList = progressService.getUserProgress(userId);
        long duration = System.currentTimeMillis() - startTime;
        logger.info("获取用户进度API调用完成，耗时 {} ms", duration);
        return ResponseEntity.ok(progressList);
    }

    @PostMapping("/progress/start/{furnitureId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<LearningProgress> startLearning(@PathVariable Long furnitureId, Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.ok(progressService.startLearning(username, furnitureId));
    }

    @PutMapping("/progress/update")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<LearningProgress> updateProgress(@RequestBody Map<String, Object> updateData, Authentication authentication) {
        long startTime = System.currentTimeMillis();
        String username = authentication.getName();
        Long furnitureId = Long.valueOf(updateData.get("furnitureId").toString());
        Integer step = Integer.valueOf(updateData.get("step").toString());
        Integer timeSpent = Integer.valueOf(updateData.get("timeSpent").toString());
        
        LearningProgress progress = progressService.updateProgress(username, furnitureId, step, timeSpent);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("同步更新进度API调用完成，耗时 {} ms", duration);
        
        return ResponseEntity.ok(progress);
    }

    @PutMapping("/progress/update-async")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<Void> updateProgressAsync(@RequestBody Map<String, Object> updateData, Authentication authentication) {
        long startTime = System.currentTimeMillis();
        String username = authentication.getName();
        Long furnitureId = Long.valueOf(updateData.get("furnitureId").toString());
        Integer step = Integer.valueOf(updateData.get("step").toString());
        Integer timeSpent = Integer.valueOf(updateData.get("timeSpent").toString());
        
        progressService.updateProgressAsync(username, furnitureId, step, timeSpent);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("异步更新进度API调用完成，耗时 {} ms", duration);
        
        return ResponseEntity.ok().build();
    }

    @PutMapping("/progress/batch-update")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<Void> batchUpdateProgress(@RequestBody List<Map<String, Object>> updates, Authentication authentication) {
        long startTime = System.currentTimeMillis();
        String username = authentication.getName();
        Long userId = getUserIdByUsername(username);
        
        List<LearningProgressService.LearningProgressUpdate> progressUpdates = updates.stream()
                .map(update -> {
                    LearningProgressService.LearningProgressUpdate progressUpdate = new LearningProgressService.LearningProgressUpdate();
                    progressUpdate.userId = userId;
                    progressUpdate.furnitureId = Long.valueOf(update.get("furnitureId").toString());
                    progressUpdate.step = Integer.valueOf(update.get("step").toString());
                    progressUpdate.timeSpent = Integer.valueOf(update.get("timeSpent").toString());
                    return progressUpdate;
                })
                .toList();
        
        progressService.batchUpdateProgress(progressUpdates);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("批量更新进度API调用完成，共 {} 条，耗时 {} ms", updates.size(), duration);
        
        return ResponseEntity.ok().build();
    }

    private Long getUserIdByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(User::getId)
                .orElse(1L);
    }
}
