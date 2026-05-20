package com.ancient.book.image.controller;

import com.ancient.book.common.entity.RestorationTask;
import com.ancient.book.image.service.RestorationTaskQueueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskQueueController {

    private final RestorationTaskQueueService taskQueueService;

    @PostMapping("/submit")
    public ResponseEntity<Map<String, String>> submitTask(@RequestBody RestorationTask task) {
        log.info("提交修复任务: {} - {}", task.getTaskId(), task.getTaskType());
        String taskId = taskQueueService.submitTask(task);
        return ResponseEntity.ok(Map.of(
                "taskId", taskId,
                "message", "任务已提交，排队处理中"
        ));
    }

    @GetMapping("/{taskId}/status")
    public ResponseEntity<RestorationTask> getTaskStatus(@PathVariable String taskId) {
        log.debug("查询任务状态: {}", taskId);
        RestorationTask task = taskQueueService.getTaskStatus(taskId);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(task);
    }

    @PostMapping("/{taskId}/cancel")
    public ResponseEntity<Map<String, Object>> cancelTask(@PathVariable String taskId) {
        log.info("取消任务: {}", taskId);
        boolean success = taskQueueService.cancelTask(taskId);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "任务已取消" : "任务取消失败"
        ));
    }

    @PostMapping("/{taskId}/pause")
    public ResponseEntity<Map<String, Object>> pauseTask(@PathVariable String taskId) {
        log.info("暂停任务: {}", taskId);
        boolean success = taskQueueService.pauseTask(taskId);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "任务已暂停" : "任务暂停失败"
        ));
    }

    @PostMapping("/{taskId}/resume")
    public ResponseEntity<Map<String, Object>> resumeTask(@PathVariable String taskId) {
        log.info("恢复任务: {}", taskId);
        boolean success = taskQueueService.resumeTask(taskId);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "任务已恢复" : "任务恢复失败"
        ));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<RestorationTask>> getTasksByStatus(@PathVariable String status) {
        log.debug("查询状态为 {} 的任务", status);
        try {
            RestorationTask.TaskStatus taskStatus = RestorationTask.TaskStatus.valueOf(status.toUpperCase());
            List<RestorationTask> tasks = taskQueueService.getTasksByStatus(taskStatus);
            return ResponseEntity.ok(tasks);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<RestorationTask>> getTasksByUser(@PathVariable Long userId) {
        log.debug("查询用户 {} 的任务列表", userId);
        List<RestorationTask> tasks = taskQueueService.getTasksByUser(userId);
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getQueueStatistics() {
        log.debug("获取任务队列统计信息");
        Map<String, Object> stats = taskQueueService.getQueueStatistics();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/queue-size")
    public ResponseEntity<Map<String, Object>> getQueueSize() {
        return ResponseEntity.ok(Map.of(
                "queueSize", taskQueueService.getQueueSize(),
                "activeTasks", taskQueueService.getActiveTaskCount()
        ));
    }

    @GetMapping("/dead-letter")
    public ResponseEntity<List<RestorationTask>> getDeadLetterQueueTasks() {
        log.debug("获取死信队列任务");
        List<RestorationTask> tasks = taskQueueService.getDeadLetterQueueTasks();
        return ResponseEntity.ok(tasks);
    }

    @PostMapping("/dead-letter/{taskId}/reprocess")
    public ResponseEntity<Map<String, Object>> reprocessDeadLetterTask(@PathVariable String taskId) {
        log.info("重新处理死信任务: {}", taskId);
        boolean success = taskQueueService.reprocessDeadLetterTask(taskId);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "任务已重新排队" : "任务不存在"
        ));
    }

    @DeleteMapping("/dead-letter")
    public ResponseEntity<Map<String, Object>> clearDeadLetterQueue() {
        log.info("清空死信队列");
        taskQueueService.clearDeadLetterQueue();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "死信队列已清空"
        ));
    }

    @PostMapping("/batch/submit")
    public ResponseEntity<Map<String, Object>> submitBatchTasks(@RequestBody List<RestorationTask> tasks) {
        log.info("批量提交任务: {} 个", tasks.size());

        List<String> taskIds = tasks.stream()
                .map(taskQueueService::submitTask)
                .toList();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "submittedCount", taskIds.size(),
                "taskIds", taskIds,
                "message", "批量任务已提交"
        ));
    }

    @GetMapping("/running")
    public ResponseEntity<List<RestorationTask>> getRunningTasks() {
        List<RestorationTask> tasks = taskQueueService.getTasksByStatus(
                RestorationTask.TaskStatus.RUNNING
        );
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/queued")
    public ResponseEntity<List<RestorationTask>> getQueuedTasks() {
        List<RestorationTask> tasks = taskQueueService.getTasksByStatus(
                RestorationTask.TaskStatus.QUEUED
        );
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/completed")
    public ResponseEntity<List<RestorationTask>> getCompletedTasks() {
        List<RestorationTask> tasks = taskQueueService.getTasksByStatus(
                RestorationTask.TaskStatus.COMPLETED
        );
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/failed")
    public ResponseEntity<List<RestorationTask>> getFailedTasks() {
        List<RestorationTask> tasks = taskQueueService.getTasksByStatus(
                RestorationTask.TaskStatus.FAILED
        );
        return ResponseEntity.ok(tasks);
    }
}
