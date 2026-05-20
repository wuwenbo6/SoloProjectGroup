package com.fittrack.controller;

import com.fittrack.dto.VideoTaskDTO;
import com.fittrack.service.VideoUploadService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/video")
@CrossOrigin(origins = "*")
public class VideoAnalysisController {

    private final VideoUploadService videoUploadService;

    public VideoAnalysisController(VideoUploadService videoUploadService) {
        this.videoUploadService = videoUploadService;
    }

    @PostMapping("/upload")
    public ResponseEntity<VideoTaskDTO> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("userId") Long userId,
            @RequestParam("exerciseTemplateId") Long exerciseTemplateId) {

        VideoTaskDTO task = videoUploadService.uploadVideo(file, userId, exerciseTemplateId);
        return ResponseEntity.ok(task);
    }

    @GetMapping("/task/{taskId}")
    public ResponseEntity<VideoTaskDTO> getTaskStatus(@PathVariable String taskId) {
        VideoTaskDTO task = videoUploadService.getTaskStatus(taskId);
        return ResponseEntity.ok(task);
    }

    @GetMapping("/tasks/user/{userId}")
    public ResponseEntity<List<VideoTaskDTO>> getUserTasks(@PathVariable Long userId) {
        List<VideoTaskDTO> tasks = videoUploadService.getUserTasks(userId);
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/tasks/user/{userId}/paged")
    public ResponseEntity<Page<VideoTaskDTO>> getUserTasksPaged(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<VideoTaskDTO> tasks = videoUploadService.getUserTasksPaged(userId, pageRequest);
        return ResponseEntity.ok(tasks);
    }

    @PostMapping("/task/{taskId}/cancel")
    public ResponseEntity<Map<String, String>> cancelTask(@PathVariable String taskId) {
        videoUploadService.cancelTask(taskId);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Task cancelled successfully");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserStats(@PathVariable Long userId) {
        Map<String, Object> stats = new HashMap<>();

        Map<String, Long> counts = new HashMap<>();
        counts.put("pending", videoUploadService.countUserTasksByStatus(userId,
            com.fittrack.entity.VideoAnalysisTask.TaskStatus.PENDING));
        counts.put("processing", videoUploadService.countUserTasksByStatus(userId,
            com.fittrack.entity.VideoAnalysisTask.TaskStatus.PROCESSING));
        counts.put("completed", videoUploadService.countUserTasksByStatus(userId,
            com.fittrack.entity.VideoAnalysisTask.TaskStatus.COMPLETED));
        counts.put("failed", videoUploadService.countUserTasksByStatus(userId,
            com.fittrack.entity.VideoAnalysisTask.TaskStatus.FAILED));
        stats.put("taskCounts", counts);

        Double avgAccuracy = videoUploadService.getUserAverageAccuracy(userId);
        stats.put("averageAccuracy", avgAccuracy != null ? avgAccuracy : 0.0);

        return ResponseEntity.ok(stats);
    }
}
