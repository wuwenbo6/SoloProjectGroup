package com.fittrack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.algorithm.OptimizedDTW;
import com.fittrack.dto.FeedbackDTO;
import com.fittrack.dto.FrameDataDTO;
import com.fittrack.entity.ExerciseTemplate;
import com.fittrack.repository.ExerciseTemplateRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MotionAnalysisService {

    private final ExerciseTemplateRepository exerciseTemplateRepository;
    private final JointAngleCalculator jointAngleCalculator;
    private final OptimizedDTW optimizedDTW;
    private final MotionPhaseDetector phaseDetector;
    private final SlidingWindowFilter windowFilter;
    private final ObjectMapper objectMapper;

    private final Map<String, SessionData> activeSessions = new ConcurrentHashMap<>();
    private static final int MIN_FRAMES_FOR_ANALYSIS = 10;
    private static final double ACCURACY_THRESHOLD = 70.0;
    private static final long STATS_CACHE_DURATION = 60000;

    public MotionAnalysisService(ExerciseTemplateRepository exerciseTemplateRepository,
                                  JointAngleCalculator jointAngleCalculator,
                                  OptimizedDTW optimizedDTW,
                                  MotionPhaseDetector phaseDetector,
                                  SlidingWindowFilter windowFilter,
                                  ObjectMapper objectMapper) {
        this.exerciseTemplateRepository = exerciseTemplateRepository;
        this.jointAngleCalculator = jointAngleCalculator;
        this.optimizedDTW = optimizedDTW;
        this.phaseDetector = phaseDetector;
        this.windowFilter = windowFilter;
        this.objectMapper = objectMapper;
    }

    public FeedbackDTO analyzeFrame(FrameDataDTO frameData) {
        String sessionId = frameData.getSessionId();
        SessionData sessionData = activeSessions.computeIfAbsent(sessionId, k -> new SessionData());

        optimizedDTW.getPerformanceStats().recordRequest();

        if (frameData.getExerciseTemplateId() != null && sessionData.template == null) {
            sessionData.template = exerciseTemplateRepository
                .findByIdWithFrames(frameData.getExerciseTemplateId())
                .orElse(null);
            if (sessionData.template != null) {
                loadTemplateAngles(sessionData);
            }
        }

        MotionPhaseDetector.MotionPhase phase = phaseDetector.detectPhase(
            frameData.getKeypoints(), frameData.getTimestamp()
        );

        SlidingWindowFilter.WindowResult windowResult = windowFilter.processFrame(
            frameData.getKeypoints(), frameData.getTimestamp(), phase
        );

        if (!windowResult.shouldProcess()) {
            optimizedDTW.getPerformanceStats().recordSkippedFrame();
            return createInitialFeedback(frameData.getTimestamp(), phase);
        }

        if (sessionData.templateAngles != null && !sessionData.templateAngles.isEmpty()) {
            return performOptimizedAnalysis(sessionData, windowResult.getFeatureSequence(),
                frameData.getTimestamp(), phase);
        }

        return createInitialFeedback(frameData.getTimestamp(), phase);
    }

    private void loadTemplateAngles(SessionData sessionData) {
        if (sessionData.template == null || sessionData.template.getTemplateFrames().isEmpty()) {
            return;
        }

        List<double[]> anglesList = new ArrayList<>();
        List<com.fittrack.entity.TemplateFrame> sortedFrames = sessionData.template.getTemplateFrames()
            .stream()
            .sorted(Comparator.comparing(com.fittrack.entity.TemplateFrame::getFrameOrder))
            .toList();

        for (com.fittrack.entity.TemplateFrame frame : sortedFrames) {
            try {
                if (frame.getAnglesJson() != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Double> angles = objectMapper.readValue(
                        frame.getAnglesJson(), Map.class
                    );
                    anglesList.add(jointAngleCalculator.toFeatureVector(angles));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        sessionData.templateAngles = anglesList;
    }

    private FeedbackDTO performOptimizedAnalysis(SessionData sessionData,
                                                 List<double[]> userSequence,
                                                 long timestamp,
                                                 MotionPhaseDetector.MotionPhase phase) {
        if (userSequence.size() < 5 || sessionData.templateAngles == null) {
            return createInitialFeedback(timestamp, phase);
        }

        optimizedDTW.getPerformanceStats().recordDTWComputation();

        double quickEstimate = optimizedDTW.fastDistanceEstimate(userSequence, sessionData.templateAngles);
        double estimateThreshold = 500;

        if (quickEstimate > estimateThreshold * 2) {
            FeedbackDTO feedback = new FeedbackDTO();
            feedback.setType("INFO");
            feedback.setAccuracy(Math.max(0, 50 - quickEstimate / estimateThreshold * 20));
            feedback.setRepsCount(sessionData.repsCount);
            feedback.setCorrections(Collections.emptyList());
            feedback.setTimestamp(timestamp);
            feedback.setMessage("动作偏离较大，请调整姿势");
            return feedback;
        }

        OptimizedDTW.DTWResult result = optimizedDTW.computeOptimized(userSequence, sessionData.templateAngles);

        optimizedDTW.getPerformanceStats().recordComputationTime(result.getComputationTime());
        optimizedDTW.getPerformanceStats().recordDistance(result.getDistance());

        if (result.isEarlyTerminated()) {
            optimizedDTW.getPerformanceStats().recordEarlyTermination();
        }

        double accuracy = result.getSimilarity();
        List<String> corrections = generateCorrections(userSequence, sessionData.templateAngles, accuracy);

        if (isRepCompleted(sessionData, phase, accuracy)) {
            sessionData.repsCount++;
            sessionData.lastRepAccuracy = accuracy;
        }

        FeedbackDTO feedback = new FeedbackDTO();
        feedback.setType(accuracy >= ACCURACY_THRESHOLD ? "CORRECT" : "CORRECTION");
        feedback.setAccuracy(accuracy);
        feedback.setRepsCount(sessionData.repsCount);
        feedback.setCorrections(corrections);
        feedback.setTimestamp(timestamp);

        if (!corrections.isEmpty()) {
            feedback.setMessage(corrections.get(0));
            feedback.setVoiceText(corrections.get(0));
        } else {
            feedback.setMessage("Good form! Keep it up!");
            feedback.setVoiceText("Good form! Keep it up!");
        }

        return feedback;
    }

    private List<String> generateCorrections(List<double[]> userSequence, List<double[]> template,
                                            double accuracy) {
        List<String> corrections = new ArrayList<>();

        if (accuracy >= 85) {
            return corrections;
        }

        String[] jointNames = {
            "左肘部", "右肘部", "左膝", "右膝", "左肩", "右肩", "左髋", "右髋"
        };

        double[] avgUser = averageSequence(userSequence);
        double[] avgTemplate = averageSequence(template);

        for (int i = 0; i < Math.min(jointNames.length, avgUser.length); i++) {
            double diff = Math.abs(avgUser[i] - avgTemplate[i]);
            if (diff > 25) {
                corrections.add(jointNames[i] + "角度需要调整（偏差" + String.format("%.1f", diff) + "度）");
            }
        }

        if (corrections.size() > 3) {
            corrections = corrections.subList(0, 3);
        }

        return corrections;
    }

    private double[] averageSequence(List<double[]> sequence) {
        if (sequence.isEmpty()) {
            return new double[0];
        }

        int dims = sequence.get(0).length;
        double[] avg = new double[dims];

        for (double[] frame : sequence) {
            for (int i = 0; i < dims; i++) {
                avg[i] += frame[i];
            }
        }

        for (int i = 0; i < dims; i++) {
            avg[i] /= sequence.size();
        }

        return avg;
    }

    private boolean isRepCompleted(SessionData sessionData, MotionPhaseDetector.MotionPhase phase,
                                  double accuracy) {
        if (phase == MotionPhaseDetector.MotionPhase.COMPLETED &&
            sessionData.lastPhase != MotionPhaseDetector.MotionPhase.COMPLETED &&
            accuracy >= ACCURACY_THRESHOLD - 10) {
            sessionData.lastPhase = phase;
            return true;
        }
        sessionData.lastPhase = phase;
        return false;
    }

    private FeedbackDTO createInitialFeedback(long timestamp, MotionPhaseDetector.MotionPhase phase) {
        FeedbackDTO feedback = new FeedbackDTO();
        feedback.setType("INFO");
        feedback.setMessage("分析中... 阶段: " + phase.getDescription());
        feedback.setVoiceText("Analyzing motion");
        feedback.setAccuracy(0.0);
        feedback.setRepsCount(0);
        feedback.setCorrections(Collections.emptyList());
        feedback.setTimestamp(timestamp);
        return feedback;
    }

    public void cleanupSession(String sessionId) {
        activeSessions.remove(sessionId);
    }

    public Map<String, Object> getPerformanceStats() {
        Map<String, Object> stats = new HashMap<>();
        OptimizedDTW.PerformanceStats perf = optimizedDTW.getPerformanceStats();

        stats.put("totalRequests", perf.getTotalRequests());
        stats.put("dtwComputations", perf.getDTWComputations());
        stats.put("skippedFrames", perf.getSkippedFrames());
        stats.put("earlyTerminations", perf.getEarlyTerminations());
        stats.put("skippingRate", String.format("%.1f%%", perf.getSkippingRate()));
        stats.put("averageComputationTimeNs", String.format("%.0f", perf.getAverageComputationTime()));
        stats.put("averageComputationTimeMs", String.format("%.2f", perf.getAverageComputationTime() / 1_000_000.0));
        stats.put("averageDistance", String.format("%.2f", perf.getAverageDistance()));
        stats.put("activeSessions", activeSessions.size());

        return stats;
    }

    public void resetPerformanceStats() {
        optimizedDTW.getPerformanceStats().reset();
    }

    private static class SessionData {
        ExerciseTemplate template;
        List<double[]> templateAngles;
        @SuppressWarnings("unused")
        List<double[]> userFrames = new ArrayList<>();
        int repsCount = 0;
        double lastRepAccuracy = 0;
        MotionPhaseDetector.MotionPhase lastPhase = MotionPhaseDetector.MotionPhase.IDLE;
    }
}
