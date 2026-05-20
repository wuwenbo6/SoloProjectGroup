package com.mortisejoiner.service;

import com.mortisejoiner.entity.furniture.Furniture;
import com.mortisejoiner.entity.user.LearningProgress;
import com.mortisejoiner.entity.user.User;
import com.mortisejoiner.repository.furniture.FurnitureRepository;
import com.mortisejoiner.repository.user.LearningProgressRepository;
import com.mortisejoiner.repository.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Service
public class LearningProgressService {

    private static final Logger logger = LoggerFactory.getLogger(LearningProgressService.class);

    @Autowired
    private LearningProgressRepository progressRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FurnitureRepository furnitureRepository;

    @Cacheable(value = "userProgress", key = "#userId", cacheManager = "teachingCacheManager")
    public List<LearningProgress> getUserProgress(Long userId) {
        long startTime = System.currentTimeMillis();
        logger.info("查询用户 {} 的学习进度", userId);
        
        List<LearningProgress> progressList = progressRepository.findByUserId(userId);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("查询完成，耗时 {} ms，共 {} 条记录", duration, progressList.size());
        
        return progressList;
    }

    @Cacheable(value = "userProgress", key = "#userId + '_' + #furnitureId", cacheManager = "teachingCacheManager")
    public Optional<LearningProgress> getProgressByUserAndFurniture(Long userId, Long furnitureId) {
        return progressRepository.findByUserIdAndFurnitureId(userId, furnitureId);
    }

    @Transactional
    @CacheEvict(value = "userProgress", allEntries = true, cacheManager = "teachingCacheManager")
    public LearningProgress startLearning(String username, Long furnitureId) {
        long startTime = System.currentTimeMillis();
        
        User user = userRepository.findByUsername(username).orElseThrow();
        Furniture furniture = furnitureRepository.findById(furnitureId).orElseThrow();

        Optional<LearningProgress> existing = progressRepository.findByUserIdAndFurnitureId(user.getId(), furnitureId);
        if (existing.isPresent()) {
            logger.info("用户 {} 已开始学习家具 {}，直接返回", username, furnitureId);
            return existing.get();
        }

        LearningProgress progress = new LearningProgress();
        progress.setUserId(user.getId());
        progress.setFurnitureId(furnitureId);
        progress.setCurrentStep(0);
        progress.setTotalSteps(furniture.getTotalSteps());
        progress.setIsCompleted(false);
        progress.setTotalTimeSpent(0);
        progress.setStartedAt(LocalDateTime.now());
        progress.setLastAccessed(LocalDateTime.now());

        LearningProgress saved = progressRepository.save(progress);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("开始学习完成，耗时 {} ms", duration);
        
        return saved;
    }

    @Async("taskExecutor")
    @Transactional
    @CacheEvict(value = "userProgress", allEntries = true, cacheManager = "teachingCacheManager")
    public CompletableFuture<LearningProgress> updateProgressAsync(String username, Long furnitureId, Integer step, Integer timeSpent) {
        long startTime = System.currentTimeMillis();
        logger.info("异步更新用户 {} 的学习进度，家具ID: {}, 步骤: {}", username, furnitureId, step);
        
        User user = userRepository.findByUsername(username).orElseThrow();
        LearningProgress progress = progressRepository.findByUserIdAndFurnitureId(user.getId(), furnitureId)
                .orElseThrow(() -> new RuntimeException("学习进度不存在"));

        boolean needUpdate = false;
        
        if (step > progress.getCurrentStep()) {
            progress.setCurrentStep(step);
            needUpdate = true;
        }
        
        progress.setTotalTimeSpent(progress.getTotalTimeSpent() + timeSpent);
        progress.setLastAccessed(LocalDateTime.now());

        if (step >= progress.getTotalSteps() && !progress.getIsCompleted()) {
            progress.setIsCompleted(true);
            progress.setCompletedAt(LocalDateTime.now());
            needUpdate = true;
        }

        LearningProgress saved = progressRepository.save(progress);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("异步更新完成，耗时 {} ms", duration);
        
        return CompletableFuture.completedFuture(saved);
    }

    @Transactional
    @CacheEvict(value = "userProgress", allEntries = true, cacheManager = "teachingCacheManager")
    public LearningProgress updateProgress(String username, Long furnitureId, Integer step, Integer timeSpent) {
        long startTime = System.currentTimeMillis();
        
        User user = userRepository.findByUsername(username).orElseThrow();
        LearningProgress progress = progressRepository.findByUserIdAndFurnitureId(user.getId(), furnitureId)
                .orElseThrow(() -> new RuntimeException("学习进度不存在"));

        if (step > progress.getCurrentStep()) {
            progress.setCurrentStep(step);
        }
        progress.setTotalTimeSpent(progress.getTotalTimeSpent() + timeSpent);
        progress.setLastAccessed(LocalDateTime.now());

        if (step >= progress.getTotalSteps()) {
            progress.setIsCompleted(true);
            progress.setCompletedAt(LocalDateTime.now());
        }

        LearningProgress saved = progressRepository.save(progress);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("同步更新完成，耗时 {} ms", duration);
        
        return saved;
    }

    @Cacheable(value = "userProgress", key = "'count_' + #userId", cacheManager = "teachingCacheManager")
    public Long getCompletedCount(Long userId) {
        return progressRepository.countByUserIdAndIsCompletedTrue(userId);
    }

    @Async("taskExecutor")
    @Transactional
    @CacheEvict(value = "userProgress", allEntries = true, cacheManager = "teachingCacheManager")
    public void batchUpdateProgress(List<LearningProgressUpdate> updates) {
        long startTime = System.currentTimeMillis();
        logger.info("批量更新学习进度，共 {} 条", updates.size());
        
        for (LearningProgressUpdate update : updates) {
            try {
                Optional<LearningProgress> progressOpt = progressRepository.findByUserIdAndFurnitureId(update.userId, update.furnitureId);
                if (progressOpt.isPresent()) {
                    LearningProgress progress = progressOpt.get();
                    if (update.step > progress.getCurrentStep()) {
                        progress.setCurrentStep(update.step);
                    }
                    progress.setTotalTimeSpent(progress.getTotalTimeSpent() + update.timeSpent);
                    progress.setLastAccessed(LocalDateTime.now());
                    progressRepository.save(progress);
                }
            } catch (Exception e) {
                logger.error("批量更新进度失败: userId={}, furnitureId={}", update.userId, update.furnitureId, e);
            }
        }
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("批量更新完成，耗时 {} ms", duration);
    }

    public static class LearningProgressUpdate {
        public Long userId;
        public Long furnitureId;
        public Integer step;
        public Integer timeSpent;
    }
}
