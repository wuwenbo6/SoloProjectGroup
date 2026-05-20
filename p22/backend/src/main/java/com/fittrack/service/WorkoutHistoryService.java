package com.fittrack.service;

import com.fittrack.dto.FrameDataDTO;
import com.fittrack.entity.*;
import com.fittrack.repository.FrameDataRepository;
import com.fittrack.repository.KeypointRepository;
import com.fittrack.repository.UserRepository;
import com.fittrack.repository.WorkoutSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class WorkoutHistoryService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final FrameDataRepository frameDataRepository;
    private final KeypointRepository keypointRepository;
    private final UserRepository userRepository;

    private final Map<String, WorkoutSession> activeSessions = new ConcurrentHashMap<>();

    public WorkoutHistoryService(WorkoutSessionRepository workoutSessionRepository,
                                  FrameDataRepository frameDataRepository,
                                  KeypointRepository keypointRepository,
                                  UserRepository userRepository) {
        this.workoutSessionRepository = workoutSessionRepository;
        this.frameDataRepository = frameDataRepository;
        this.keypointRepository = keypointRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public WorkoutSession startSession(Long userId, Long exerciseTemplateId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ExerciseTemplate template = new ExerciseTemplate();
        template.setId(exerciseTemplateId);

        WorkoutSession session = new WorkoutSession();
        session.setUser(user);
        session.setExerciseTemplate(template);
        session.setStartTime(LocalDateTime.now());
        session.setRepsCount(0);
        session.setAverageAccuracy(0.0);

        return workoutSessionRepository.save(session);
    }

    @Transactional
    public void endSession(Long sessionId, int repsCount, double averageAccuracy) {
        WorkoutSession session = workoutSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        session.setEndTime(LocalDateTime.now());
        session.setRepsCount(repsCount);
        session.setAverageAccuracy(averageAccuracy);
        session.setFeedbackSummary(generateSummary(repsCount, averageAccuracy));

        workoutSessionRepository.save(session);
    }

    @Transactional
    public void saveFrameData(Long sessionId, FrameDataDTO frameDataDTO) {
        WorkoutSession session = workoutSessionRepository.getReferenceById(sessionId);

        FrameData frameData = new FrameData();
        frameData.setWorkoutSession(session);
        frameData.setTimestamp(frameDataDTO.getTimestamp());
        frameData.setFrameNumber(frameDataDTO.getFrameNumber());
        frameData.setCreatedAt(LocalDateTime.now());

        frameData = frameDataRepository.save(frameData);

        List<Keypoint> keypoints = new ArrayList<>();
        for (var kpDTO : frameDataDTO.getKeypoints()) {
            Keypoint keypoint = new Keypoint();
            keypoint.setName(kpDTO.getName());
            keypoint.setX(kpDTO.getX());
            keypoint.setY(kpDTO.getY());
            keypoint.setZ(kpDTO.getZ());
            keypoint.setVisibility(kpDTO.getVisibility());
            keypoint.setFrameData(frameData);
            keypoints.add(keypoint);
        }

        keypointRepository.saveAll(keypoints);
    }

    public List<WorkoutSession> getUserHistory(Long userId) {
        return workoutSessionRepository.findByUserIdOrderByStartTimeDesc(userId);
    }

    public List<WorkoutSession> getUserHistoryByDateRange(Long userId, LocalDateTime start, LocalDateTime end) {
        return workoutSessionRepository.findByUserIdAndDateRange(userId, start, end);
    }

    private String generateSummary(int repsCount, double accuracy) {
        if (accuracy >= 90) {
            return String.format("Excellent! Completed %d reps with %.1f%% accuracy. Keep up the great form!", repsCount, accuracy);
        } else if (accuracy >= 75) {
            return String.format("Good job! Completed %d reps with %.1f%% accuracy. Focus on improving your form.", repsCount, accuracy);
        } else {
            return String.format("Completed %d reps with %.1f%% accuracy. Consider reviewing the proper technique for this exercise.", repsCount, accuracy);
        }
    }
}
