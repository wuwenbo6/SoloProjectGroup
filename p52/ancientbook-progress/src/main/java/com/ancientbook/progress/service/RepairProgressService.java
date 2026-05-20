package com.ancientbook.progress.service;

import com.ancientbook.common.annotation.Idempotent;
import com.ancientbook.common.datasource.DataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.common.exception.BusinessException;
import com.ancientbook.progress.entity.RepairProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
@DataSource(DataSourceType.PROGRESS)
public class RepairProgressService {

    private final Map<String, RepairProgress> progressStore = new ConcurrentHashMap<>();

    @Transactional(rollbackFor = Exception.class)
    @Idempotent(key = "#progress.bookCode + '_' + #progress.step", message = "该工序正在处理中，请勿重复提交")
    public RepairProgress createProgress(RepairProgress progress) {
        String key = progress.getBookCode() + "_" + progress.getStep();
        
        log.info("创建修复进度: bookCode={}, step={}", progress.getBookCode(), progress.getStep());
        
        if (progress.getStartTime() == null) {
            progress.setStartTime(LocalDateTime.now());
        }
        if (progress.getStatus() == null) {
            progress.setStatus(1);
        }
        
        progress.setProgressCode("PROG_" + System.currentTimeMillis());
        progressStore.put(progress.getProgressCode(), progress);
        
        log.info("修复进度创建成功: progressCode={}", progress.getProgressCode());
        return progress;
    }

    @Transactional(rollbackFor = Exception.class)
    @Idempotent(key = "#progressCode", expireTime = 1, message = "该记录正在更新中，请稍后重试")
    public RepairProgress updateProgress(String progressCode, RepairProgress progress) {
        RepairProgress exist = progressStore.get(progressCode);
        if (exist == null) {
            throw new BusinessException("修复进度记录不存在");
        }
        
        if (progress.getEndTime() != null) {
            exist.setEndTime(progress.getEndTime());
            exist.setStatus(2);
            if (progress.getStartTime() != null) {
                long minutes = java.time.Duration.between(
                    progress.getStartTime(), progress.getEndTime()).toMinutes();
                exist.setDuration((int) minutes);
            }
        }
        if (progress.getQualityScore() != null) {
            exist.setQualityScore(progress.getQualityScore());
        }
        if (progress.getParamsJson() != null) {
            exist.setParamsJson(progress.getParamsJson());
        }
        if (progress.getRemark() != null) {
            exist.setRemark(progress.getRemark());
        }
        
        return exist;
    }

    public List<RepairProgress> getProgressByBookId(Long bookId) {
        List<RepairProgress> result = new ArrayList<>();
        for (RepairProgress progress : progressStore.values()) {
            if (bookId.equals(progress.getBookId())) {
                result.add(progress);
            }
        }
        return result;
    }

    public RepairProgress getByProgressCode(String progressCode) {
        return progressStore.get(progressCode);
    }

    public List<Map<String, Object>> getProgressSteps() {
        List<Map<String, Object>> steps = new ArrayList<>();
        steps.add(createStep(1, "外观检测", 1, 1));
        steps.add(createStep(2, "纸张纤维检测", 1, 2));
        steps.add(createStep(3, "酸碱度检测", 1, 3));
        steps.add(createStep(4, "除尘清洁", 2, 1));
        steps.add(createStep(5, "脱酸处理", 2, 2));
        steps.add(createStep(6, "修补破损", 2, 3));
        steps.add(createStep(7, "托裱加固", 2, 4));
        steps.add(createStep(8, "装订复原", 2, 5));
        steps.add(createStep(9, "修复质量检查", 3, 1));
        steps.add(createStep(10, "拍照存档", 3, 2));
        steps.add(createStep(11, "专家评审", 3, 3));
        return steps;
    }

    private Map<String, Object> createStep(int id, String name, int stage, int order) {
        return Map.of(
            "id", id,
            "name", name,
            "stage", stage,
            "order", order,
            "required", order <= 3
        );
    }
}
