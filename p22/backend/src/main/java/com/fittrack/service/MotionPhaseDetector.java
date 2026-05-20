package com.fittrack.service;

import com.fittrack.dto.KeypointDTO;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class MotionPhaseDetector {

    public enum MotionPhase {
        IDLE("静止"),
        STARTING("起势"),
        DESCENDING("下蹲"),
        ASCENDING("起身"),
        COMPLETED("完成"),
        UNKNOWN("未知");

        private final String description;

        MotionPhase(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }

        public boolean shouldRunDTW() {
            return this == DESCENDING || this == ASCENDING;
        }
    }

    private static class FrameFeatures {
        double leftKneeAngle;
        double rightKneeAngle;
        double leftHipAngle;
        double rightHipAngle;
        double timestamp;
    }

    private static final int WINDOW_SIZE = 5;
    private static final double KNEE_BEND_THRESHOLD = 150;
    private static final double MOTION_THRESHOLD = 10;
    private static final int MIN_PHASE_FRAMES = 3;

    private final LinkedList<FrameFeatures> frameWindow = new LinkedList<>();
    private MotionPhase currentPhase = MotionPhase.IDLE;
    private int currentPhaseDuration = 0;
    private double lastKneeAngle = 180;
    private double phaseStartAngle = 180;

    public MotionPhase detectPhase(List<KeypointDTO> keypoints, long timestamp) {
        FrameFeatures features = extractFeatures(keypoints, timestamp);

        if (features == null) {
            return MotionPhase.UNKNOWN;
        }

        frameWindow.add(features);
        if (frameWindow.size() > WINDOW_SIZE) {
            frameWindow.removeFirst();
        }

        if (frameWindow.size() < 3) {
            return currentPhase;
        }

        MotionPhase newPhase = classifyPhase(features);

        if (newPhase != currentPhase) {
            if (isValidPhaseTransition(newPhase)) {
                currentPhaseDuration++;
                if (currentPhaseDuration >= MIN_PHASE_FRAMES) {
                    currentPhase = newPhase;
                    currentPhaseDuration = 0;
                    phaseStartAngle = getAverageKneeAngle();
                }
            } else {
                currentPhaseDuration = 0;
            }
        } else {
            currentPhaseDuration++;
        }

        lastKneeAngle = features.leftKneeAngle;
        return currentPhase;
    }

    private FrameFeatures extractFeatures(List<KeypointDTO> keypoints, long timestamp) {
        Map<String, KeypointDTO> keypointMap = new HashMap<>();
        for (KeypointDTO kp : keypoints) {
            keypointMap.put(kp.getName(), kp);
        }

        KeypointDTO leftHip = keypointMap.get("left_hip");
        KeypointDTO leftKnee = keypointMap.get("left_knee");
        KeypointDTO leftAnkle = keypointMap.get("left_ankle");
        KeypointDTO rightHip = keypointMap.get("right_hip");
        KeypointDTO rightKnee = keypointMap.get("right_knee");
        KeypointDTO rightAnkle = keypointMap.get("right_ankle");

        if (leftHip == null || leftKnee == null || leftAnkle == null ||
            rightHip == null || rightKnee == null || rightAnkle == null) {
            return null;
        }

        FrameFeatures features = new FrameFeatures();
        features.leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        features.rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
        features.leftHipAngle = calculateAngle(
            keypointMap.get("left_shoulder"), leftHip, leftKnee
        );
        features.rightHipAngle = calculateAngle(
            keypointMap.get("right_shoulder"), rightHip, rightKnee
        );
        features.timestamp = timestamp;
        return features;
    }

    private MotionPhase classifyPhase(FrameFeatures current) {
        double avgKneeAngle = (current.leftKneeAngle + current.rightKneeAngle) / 2;
        double angleChange = avgKneeAngle - lastKneeAngle;
        double windowTrend = calculateWindowTrend();

        if (avgKneeAngle >= KNEE_BEND_THRESHOLD && Math.abs(windowTrend) < 2) {
            return MotionPhase.IDLE;
        }

        if (avgKneeAngle >= 160 && Math.abs(windowTrend) < 5) {
            return currentPhase == MotionPhase.ASCENDING ? MotionPhase.COMPLETED : MotionPhase.IDLE;
        }

        if (currentPhase == MotionPhase.IDLE && angleChange < -MOTION_THRESHOLD) {
            return MotionPhase.STARTING;
        }

        if (windowTrend < -5) {
            return MotionPhase.DESCENDING;
        }

        if (windowTrend > 5) {
            return MotionPhase.ASCENDING;
        }

        return currentPhase;
    }

    private double calculateWindowTrend() {
        if (frameWindow.size() < 2) {
            return 0;
        }

        double sum = 0;
        int count = 0;

        for (int i = 1; i < frameWindow.size(); i++) {
            double prev = (frameWindow.get(i-1).leftKneeAngle + frameWindow.get(i-1).rightKneeAngle) / 2;
            double curr = (frameWindow.get(i).leftKneeAngle + frameWindow.get(i).rightKneeAngle) / 2;
            sum += (curr - prev);
            count++;
        }

        return count > 0 ? sum / count : 0;
    }

    private double getAverageKneeAngle() {
        if (frameWindow.isEmpty()) {
            return 180;
        }

        FrameFeatures last = frameWindow.getLast();
        return (last.leftKneeAngle + last.rightKneeAngle) / 2;
    }

    private boolean isValidPhaseTransition(MotionPhase newPhase) {
        Map<MotionPhase, Set<MotionPhase>> validTransitions = new HashMap<>();
        validTransitions.put(MotionPhase.IDLE,
            new HashSet<>(Arrays.asList(MotionPhase.STARTING, MotionPhase.IDLE)));
        validTransitions.put(MotionPhase.STARTING,
            new HashSet<>(Arrays.asList(MotionPhase.DESCENDING, MotionPhase.STARTING)));
        validTransitions.put(MotionPhase.DESCENDING,
            new HashSet<>(Arrays.asList(MotionPhase.DESCENDING, MotionPhase.ASCENDING, MotionPhase.COMPLETED)));
        validTransitions.put(MotionPhase.ASCENDING,
            new HashSet<>(Arrays.asList(MotionPhase.ASCENDING, MotionPhase.COMPLETED, MotionPhase.IDLE)));
        validTransitions.put(MotionPhase.COMPLETED,
            new HashSet<>(Arrays.asList(MotionPhase.IDLE, MotionPhase.STARTING)));
        validTransitions.put(MotionPhase.UNKNOWN,
            new HashSet<>(Arrays.asList(MotionPhase.values())));

        return validTransitions.getOrDefault(currentPhase, Collections.emptySet())
            .contains(newPhase);
    }

    private double calculateAngle(KeypointDTO a, KeypointDTO b, KeypointDTO c) {
        if (a == null || b == null || c == null) {
            return 180;
        }

        double[] vectorBA = {
            a.getX() - b.getX(),
            a.getY() - b.getY()
        };

        double[] vectorBC = {
            c.getX() - b.getX(),
            c.getY() - b.getY()
        };

        double dotProduct = vectorBA[0] * vectorBC[0] + vectorBA[1] * vectorBC[1];
        double magnitudeBA = Math.sqrt(vectorBA[0] * vectorBA[0] + vectorBA[1] * vectorBA[1]);
        double magnitudeBC = Math.sqrt(vectorBC[0] * vectorBC[0] + vectorBC[1] * vectorBC[1]);

        if (magnitudeBA == 0 || magnitudeBC == 0) {
            return 180;
        }

        double cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
        cosAngle = Math.max(-1.0, Math.min(1.0, cosAngle));

        return Math.toDegrees(Math.acos(cosAngle));
    }

    public MotionPhase getCurrentPhase() {
        return currentPhase;
    }

    public void reset() {
        currentPhase = MotionPhase.IDLE;
        currentPhaseDuration = 0;
        lastKneeAngle = 180;
        phaseStartAngle = 180;
        frameWindow.clear();
    }

    public Map<String, Object> getDebugInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("currentPhase", currentPhase.name());
        info.put("currentPhaseDescription", currentPhase.description);
        info.put("phaseDuration", currentPhaseDuration);
        info.put("lastKneeAngle", lastKneeAngle);
        info.put("shouldRunDTW", currentPhase.shouldRunDTW());
        info.put("windowSize", frameWindow.size());
        return info;
    }
}
