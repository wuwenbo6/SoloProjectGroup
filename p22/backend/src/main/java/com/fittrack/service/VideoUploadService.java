package com.fittrack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.dto.VideoAnalysisMessage;
import com.fittrack.dto.VideoTaskDTO;
import com.fittrack.entity.ExerciseTemplate;
import com.fittrack.entity.User;
import com.fittrack.entity.VideoAnalysisTask;
import com.fittrack.repository.ExerciseTemplateRepository;
import com.fittrack.repository.UserRepository;
import com.fittrack.repository.VideoAnalysisTaskRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VideoUploadService {

    private final FileStorageService fileStorageService;
    private final VideoAnalysisProducer videoAnalysisProducer;
    private final VideoAnalysisTaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ExerciseTemplateRepository exerciseTemplateRepository;
    private final ObjectMapper objectMapper;
    private final MotionAnalysisWebSocketHandler webSocketHandler;

    public VideoUploadService(FileStorageService fileStorageService,
                              VideoAnalysisProducer videoAnalysisProducer,
                              VideoAnalysisTaskRepository taskRepository,
                              UserRepository userRepository,
                              ExerciseTemplateRepository exerciseTemplateRepository,
                              ObjectMapper objectMapper,
                              MotionAnalysisWebSocketHandler webSocketHandler) {
        this.fileStorageService = fileStorageService;
        this.videoAnalysisProducer = videoAnalysisProducer;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.exerciseTemplateRepository = exerciseTemplateRepository;
        this.objectMapper = objectMapper;
        this.webSocketHandler = webSocketHandler;
    }

    @Transactional
    public VideoTaskDTO uploadVideo(MultipartFile file, Long userId, Long exerciseTemplateId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ExerciseTemplate template = exerciseTemplateRepository.findById(exerciseTemplateId)
                .orElseThrow(() -> new RuntimeException("Exercise template not found"));

        String taskId = "TASK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String storedPath = fileStorageService.storeFile(file);

        VideoAnalysisTask task = new VideoAnalysisTask();
        task.setTaskId(taskId);
        task.setUser(user);
        task.setExerciseTemplate(template);
        task.setOriginalFilename(file.getOriginalFilename());
        task.setStoredFilePath(storedPath);
        task.setFileSize(file.getSize());
        task.setStatus(VideoAnalysisTask.TaskStatus.UPLOADED);
        task.setProgress(5);

        taskRepository.save(task);

        VideoAnalysisMessage message = new VideoAnalysisMessage();
        message.setTaskId(taskId);
        message.setUserId(userId);
        message.setExerciseTemplateId(exerciseTemplateId);
        message.setVideoPath(storedPath);

        videoAnalysisProducer.sendVideoAnalysisTask(message);

        return VideoTaskDTO.fromEntity(task);
    }

    public VideoTaskDTO getTaskStatus(String taskId) {
        VideoAnalysisTask task = taskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        return VideoTaskDTO.fromEntity(task);
    }

    public List<VideoTaskDTO> getUserTasks(Long userId) {
        return taskRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(VideoTaskDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public Page<VideoTaskDTO> getUserTasksPaged(Long userId, Pageable pageable) {
        return taskRepository.findByUserId(userId, pageable)
                .map(VideoTaskDTO::fromEntity);
    }

    public void cancelTask(String taskId) {
        VideoAnalysisTask task = taskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (task.getStatus() == VideoAnalysisTask.TaskStatus.PENDING ||
            task.getStatus() == VideoAnalysisTask.TaskStatus.UPLOADED) {
            task.setStatus(VideoAnalysisTask.TaskStatus.CANCELLED);
            taskRepository.save(task);
            fileStorageService.deleteFile(task.getStoredFilePath());
        }
    }

    public long countUserTasksByStatus(Long userId, VideoAnalysisTask.TaskStatus status) {
        return taskRepository.countByUserIdAndStatus(userId, status);
    }

    public Double getUserAverageAccuracy(Long userId) {
        return taskRepository.getAverageAccuracyForUser(userId);
    }
}
