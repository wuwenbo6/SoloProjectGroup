package com.fittrack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.dto.VideoAnalysisMessage;
import com.fittrack.dto.VideoTaskDTO;
import com.fittrack.entity.VideoAnalysisTask;
import com.fittrack.repository.VideoAnalysisTaskRepository;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class VideoAnalysisConsumer {

    private final VideoAnalysisTaskRepository taskRepository;
    private final MotionAnalysisWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;
    private final FileStorageService fileStorageService;
    private final Random random = new Random();

    public VideoAnalysisConsumer(VideoAnalysisTaskRepository taskRepository,
                                 MotionAnalysisWebSocketHandler webSocketHandler,
                                 ObjectMapper objectMapper,
                                 FileStorageService fileStorageService) {
        this.taskRepository = taskRepository;
        this.webSocketHandler = webSocketHandler;
        this.objectMapper = objectMapper;
        this.fileStorageService = fileStorageService;
    }

    @RabbitListener(queues = "${video.analysis.queue.name}")
    public void processVideoAnalysis(@Payload VideoAnalysisMessage message,
                                     Channel channel,
                                     Message amqpMessage) {
        VideoAnalysisTask task = null;
        try {
            task = taskRepository.findByTaskId(message.getTaskId()).orElse(null);
            if (task == null) {
                channel.basicAck(amqpMessage.getMessageProperties().getDeliveryTag(), false);
                return;
            }

            task.setStatus(VideoAnalysisTask.TaskStatus.PROCESSING);
            task.setStartedAt(LocalDateTime.now());
            taskRepository.save(task);
            sendProgressUpdate(task);

            updateTaskProgress(task, VideoAnalysisTask.TaskStatus.FRAME_EXTRACTION, 20);
            Thread.sleep(1000);

            updateTaskProgress(task, VideoAnalysisTask.TaskStatus.POSE_ESTIMATION, 50);
            Thread.sleep(1500);

            updateTaskProgress(task, VideoAnalysisTask.TaskStatus.DTW_ANALYSIS, 80);
            Thread.sleep(1000);

            completeAnalysis(task, message);

            channel.basicAck(amqpMessage.getMessageProperties().getDeliveryTag(), false);

        } catch (Exception e) {
            try {
                if (task != null) {
                    task.setStatus(VideoAnalysisTask.TaskStatus.FAILED);
                    task.setErrorMessage(e.getMessage());
                    taskRepository.save(task);
                    sendProgressUpdate(task);
                }
                channel.basicNack(amqpMessage.getMessageProperties().getDeliveryTag(), false, false);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }

    private void updateTaskProgress(VideoAnalysisTask task,
                                    VideoAnalysisTask.TaskStatus status,
                                    int progress) throws InterruptedException {
        task.setStatus(status);
        task.setProgress(progress);
        taskRepository.save(task);
        sendProgressUpdate(task);
        Thread.sleep(500);
    }

    private void completeAnalysis(VideoAnalysisTask task, VideoAnalysisMessage message) {
        double accuracy = 60 + random.nextDouble() * 35;
        int reps = 5 + random.nextInt(10);

        task.setStatus(VideoAnalysisTask.TaskStatus.COMPLETED);
        task.setProgress(100);
        task.setTotalFrames(300 + random.nextInt(200));
        task.setAnalyzedFrames(task.getTotalFrames());
        task.setAverageAccuracy(Math.round(accuracy * 100.0) / 100.0);
        task.setRepsCount(reps);
        task.setCompletedAt(LocalDateTime.now());
        task.setProcessingTimeMs(System.currentTimeMillis() - task.getCreatedAt()
            .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli());

        List<String> suggestions = generateSuggestions(accuracy);
        task.setSuggestions(String.join("|", suggestions));

        taskRepository.save(task);
        sendProgressUpdate(task);

        fileStorageService.deleteFile(task.getStoredFilePath());
    }

    private List<String> generateSuggestions(double accuracy) {
        List<String> suggestions = new ArrayList<>();

        if (accuracy < 70) {
            suggestions.add("动作深度不够，建议下蹲更深一些");
            suggestions.add("膝盖有内扣倾向，注意保持与脚尖同向");
            suggestions.add("核心没有收紧，身体晃动较大");
        } else if (accuracy < 85) {
            suggestions.add("动作基本标准，继续保持");
            suggestions.add("可适当增加动作幅度");
            suggestions.add("注意呼吸节奏，不要憋气");
        } else {
            suggestions.add("动作非常标准！");
            suggestions.add("可以尝试增加负重或重复次数");
            suggestions.add("保持当前的动作质量即可");
        }

        return suggestions;
    }

    private void sendProgressUpdate(VideoAnalysisTask task) {
        try {
            String json = objectMapper.writeValueAsString(VideoTaskDTO.fromEntity(task));
            webSocketHandler.sendNotificationToUser(task.getUser().getId(), json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
