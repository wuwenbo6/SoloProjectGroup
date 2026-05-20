package com.fittrack.service;

import com.fittrack.dto.KeypointDTO;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SlidingWindowFilter {

    public static class WindowResult {
        private final boolean shouldProcess;
        private final boolean isKeyframe;
        private final double significanceScore;
        private final List<double[]> featureSequence;

        public WindowResult(boolean shouldProcess, boolean isKeyframe, double significanceScore,
                           List<double[]> featureSequence) {
            this.shouldProcess = shouldProcess;
            this.isKeyframe = isKeyframe;
            this.significanceScore = significanceScore;
            this.featureSequence = featureSequence;
        }

        public boolean shouldProcess() { return shouldProcess; }
        public boolean isKeyframe() { return isKeyframe; }
        public double getSignificanceScore() { return significanceScore; }
        public List<double[]> getFeatureSequence() { return featureSequence; }
    }

    private static class FrameData {
        long timestamp;
        double[] features;
        double velocity;
    }

    private static final int MAX_WINDOW_SIZE = 30;
    private static final int MIN_WINDOW_FOR_DTW = 10;
    private static final double VELOCITY_THRESHOLD = 2.0;
    private static final double SIGNIFICANCE_THRESHOLD = 0.3;

    private final LinkedList<FrameData> frameBuffer = new LinkedList<>();
    private int frameSkipCounter = 0;
    private static final int SKIP_INTERVAL = 3;

    public WindowResult processFrame(List<KeypointDTO> keypoints, long timestamp,
                                     MotionPhaseDetector.MotionPhase phase) {
        double[] features = extractFeatures(keypoints);

        FrameData frameData = new FrameData();
        frameData.timestamp = timestamp;
        frameData.features = features;
        frameData.velocity = calculateVelocity(features);

        frameBuffer.add(frameData);
        if (frameBuffer.size() > MAX_WINDOW_SIZE) {
            frameBuffer.removeFirst();
        }

        boolean isKeyframe = isKeyframe(frameData, phase);
        double significanceScore = calculateSignificanceScore();

        if (!phase.shouldRunDTW()) {
            frameSkipCounter++;
            return new WindowResult(false, isKeyframe, significanceScore, Collections.emptyList());
        }

        if (frameSkipCounter < SKIP_INTERVAL && !isKeyframe) {
            frameSkipCounter++;
            return new WindowResult(false, false, significanceScore, Collections.emptyList());
        }

        frameSkipCounter = 0;

        if (frameBuffer.size() >= MIN_WINDOW_FOR_DTW) {
            List<double[]> featureSequence = new ArrayList<>();
            int step = Math.max(1, frameBuffer.size() / MIN_WINDOW_FOR_DTW);

            for (int i = 0; i < frameBuffer.size(); i += step) {
                featureSequence.add(frameBuffer.get(i).features);
            }

            return new WindowResult(true, isKeyframe, significanceScore, featureSequence);
        }

        return new WindowResult(false, isKeyframe, significanceScore, Collections.emptyList());
    }

    private double[] extractFeatures(List<KeypointDTO> keypoints) {
        Map<String, KeypointDTO> keypointMap = new HashMap<>();
        for (KeypointDTO kp : keypoints) {
            keypointMap.put(kp.getName(), kp);
        }

        double[] features = new double[8];

        features[0] = getJointAngle(keypointMap, "left_shoulder", "left_elbow", "left_wrist");
        features[1] = getJointAngle(keypointMap, "right_shoulder", "right_elbow", "right_wrist");
        features[2] = getJointAngle(keypointMap, "left_hip", "left_knee", "left_ankle");
        features[3] = getJointAngle(keypointMap, "right_hip", "right_knee", "right_ankle");
        features[4] = getJointAngle(keypointMap, "left_shoulder", "left_hip", "left_knee");
        features[5] = getJointAngle(keypointMap, "right_shoulder", "right_hip", "right_knee");
        features[6] = getRelativeHeight(keypointMap, "left_hip", "left_ankle");
        features[7] = getRelativeHeight(keypointMap, "right_hip", "right_ankle");

        return features;
    }

    private double getJointAngle(Map<String, KeypointDTO> keypointMap, String aName, String bName, String cName) {
        KeypointDTO a = keypointMap.get(aName);
        KeypointDTO b = keypointMap.get(bName);
        KeypointDTO c = keypointMap.get(cName);

        if (a == null || b == null || c == null) {
            return 180;
        }

        double[] vectorBA = {a.getX() - b.getX(), a.getY() - b.getY()};
        double[] vectorBC = {c.getX() - b.getX(), c.getY() - b.getY()};

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

    private double getRelativeHeight(Map<String, KeypointDTO> keypointMap, String upper, String lower) {
        KeypointDTO u = keypointMap.get(upper);
        KeypointDTO l = keypointMap.get(lower);

        if (u == null || l == null) {
            return 0;
        }

        return l.getY() - u.getY();
    }

    private double calculateVelocity(double[] currentFeatures) {
        if (frameBuffer.isEmpty()) {
            return 0;
        }

        double[] prevFeatures = frameBuffer.getLast().features;
        double sum = 0;

        for (int i = 0; i < currentFeatures.length; i++) {
            sum += Math.abs(currentFeatures[i] - prevFeatures[i]);
        }

        return sum / currentFeatures.length;
    }

    private boolean isKeyframe(FrameData frameData, MotionPhaseDetector.MotionPhase phase) {
        if (frameBuffer.size() < 2) {
            return true;
        }

        if (frameData.velocity > VELOCITY_THRESHOLD) {
            return true;
        }

        if (phase.shouldRunDTW() && hasSignificantChange(frameData)) {
            return true;
        }

        return false;
    }

    private boolean hasSignificantChange(FrameData current) {
        if (frameBuffer.size() < 5) {
            return false;
        }

        double[] avg = new double[current.features.length];
        for (int i = frameBuffer.size() - 5; i < frameBuffer.size(); i++) {
            for (int j = 0; j < avg.length; j++) {
                avg[j] += frameBuffer.get(i).features[j];
            }
        }

        for (int i = 0; i < avg.length; i++) {
            avg[i] /= 5;
        }

        double diff = 0;
        for (int i = 0; i < avg.length; i++) {
            diff += Math.abs(current.features[i] - avg[i]);
        }

        return diff / avg.length > SIGNIFICANCE_THRESHOLD;
    }

    private double calculateSignificanceScore() {
        if (frameBuffer.size() < 5) {
            return 0;
        }

        double totalVelocity = 0;
        int count = 0;

        for (FrameData frame : frameBuffer) {
            totalVelocity += frame.velocity;
            count++;
        }

        return count > 0 ? totalVelocity / count : 0;
    }

    public void reset() {
        frameBuffer.clear();
        frameSkipCounter = 0;
    }

    public int getBufferSize() {
        return frameBuffer.size();
    }
}
