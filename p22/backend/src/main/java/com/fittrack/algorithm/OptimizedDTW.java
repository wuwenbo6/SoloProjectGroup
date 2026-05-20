package com.fittrack.algorithm;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OptimizedDTW {

    private static final int SAKOE_CHABA_BAND = 5;
    private static final double EARLY_TERMINATION_THRESHOLD = 1000;

    public static class DTWResult {
        private final double distance;
        private final double similarity;
        private final int pathLength;
        private final long computationTime;
        private final boolean earlyTerminated;

        public DTWResult(double distance, double similarity, int pathLength, long computationTime,
                        boolean earlyTerminated) {
            this.distance = distance;
            this.similarity = similarity;
            this.pathLength = pathLength;
            this.computationTime = computationTime;
            this.earlyTerminated = earlyTerminated;
        }

        public double getDistance() { return distance; }
        public double getSimilarity() { return similarity; }
        public int getPathLength() { return pathLength; }
        public long getComputationTime() { return computationTime; }
        public boolean isEarlyTerminated() { return earlyTerminated; }
    }

    public DTWResult computeOptimized(List<double[]> sequence1, List<double[]> sequence2) {
        long startTime = System.nanoTime();

        int n = sequence1.size();
        int m = sequence2.size();

        if (Math.abs(n - m) > SAKOE_CHABA_BAND * 2) {
            long time = System.nanoTime() - startTime;
            return new DTWResult(Double.POSITIVE_INFINITY, 0, 0, time, false);
        }

        double[] prevRow = new double[m + 1];
        double[] currRow = new double[m + 1];

        for (int j = 0; j <= m; j++) {
            prevRow[j] = Double.POSITIVE_INFINITY;
        }
        prevRow[0] = 0;

        double minPath = Double.POSITIVE_INFINITY;
        boolean earlyTerminated = false;

        for (int i = 1; i <= n; i++) {
            currRow[0] = Double.POSITIVE_INFINITY;

            int jStart = Math.max(1, i - SAKOE_CHABA_BAND);
            int jEnd = Math.min(m, i + SAKOE_CHABA_BAND);

            for (int j = 1; j < jStart; j++) {
                currRow[j] = Double.POSITIVE_INFINITY;
            }

            for (int j = jStart; j <= jEnd; j++) {
                double cost = euclideanDistance(sequence1.get(i - 1), sequence2.get(j - 1));

                currRow[j] = cost + min(
                    prevRow[j],
                    currRow[j - 1],
                    prevRow[j - 1]
                );
            }

            for (int j = jEnd + 1; j <= m; j++) {
                currRow[j] = Double.POSITIVE_INFINITY;
            }

            double currentMin = minRow(currRow, jStart, jEnd);
            if (currentMin < minPath) {
                minPath = currentMin;
            }

            if (minPath > EARLY_TERMINATION_THRESHOLD) {
                earlyTerminated = true;
                break;
            }

            double[] temp = prevRow;
            prevRow = currRow;
            currRow = temp;
        }

        double distance = prevRow[m];
        double maxDistance = calculateMaxDistance(sequence1, sequence2);
        double similarity = Math.max(0, 100 * (1 - distance / maxDistance));

        long computationTime = System.nanoTime() - startTime;

        return new DTWResult(
            distance,
            similarity,
            n + m,
            computationTime,
            earlyTerminated
        );
    }

    public double fastDistanceEstimate(List<double[]> sequence1, List<double[]> sequence2) {
        int sampleSize = Math.min(5, Math.min(sequence1.size(), sequence2.size()));
        int step1 = sequence1.size() / Math.max(1, sampleSize);
        int step2 = sequence2.size() / Math.max(1, sampleSize);

        double total = 0;
        int count = 0;

        for (int i = 0; i < sampleSize; i++) {
            int idx1 = Math.min(i * step1, sequence1.size() - 1);
            int idx2 = Math.min(i * step2, sequence2.size() - 1);
            total += euclideanDistance(sequence1.get(idx1), sequence2.get(idx2));
            count++;
        }

        return count > 0 ? total / count * Math.max(sequence1.size(), sequence2.size()) : 0;
    }

    private double euclideanDistance(double[] a, double[] b) {
        if (a.length != b.length) {
            throw new IllegalArgumentException("Vectors must have the same length");
        }

        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            double diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    private double min(double a, double b, double c) {
        return Math.min(a, Math.min(b, c));
    }

    private double minRow(double[] row, int start, int end) {
        double min = Double.POSITIVE_INFINITY;
        for (int i = start; i <= end; i++) {
            if (row[i] < min) {
                min = row[i];
            }
        }
        return min;
    }

    private double calculateMaxDistance(List<double[]> seq1, List<double[]> seq2) {
        double maxVal = 180;
        int dimensions = seq1.get(0).length;
        int maxLength = Math.max(seq1.size(), seq2.size());
        return maxVal * dimensions * maxLength;
    }

    public static class PerformanceStats {
        private int totalRequests = 0;
        private int dtwComputations = 0;
        private int skippedFrames = 0;
        private int earlyTerminations = 0;
        private long totalComputationTime = 0;
        private double averageDistance = 0;

        public synchronized void recordRequest() { totalRequests++; }
        public synchronized void recordDTWComputation() { dtwComputations++; }
        public synchronized void recordSkippedFrame() { skippedFrames++; }
        public synchronized void recordEarlyTermination() { earlyTerminations++; }
        public synchronized void recordComputationTime(long time) { totalComputationTime += time; }
        public synchronized void recordDistance(double distance) {
            averageDistance = (averageDistance * (dtwComputations - 1) + distance) / dtwComputations;
        }

        public int getTotalRequests() { return totalRequests; }
        public int getDTWComputations() { return dtwComputations; }
        public int getSkippedFrames() { return skippedFrames; }
        public int getEarlyTerminations() { return earlyTerminations; }
        public long getTotalComputationTime() { return totalComputationTime; }
        public double getAverageComputationTime() {
            return dtwComputations > 0 ? (double) totalComputationTime / dtwComputations : 0;
        }
        public double getAverageDistance() { return averageDistance; }
        public double getSkippingRate() {
            return totalRequests > 0 ? (double) skippedFrames / totalRequests * 100 : 0;
        }

        public void reset() {
            totalRequests = 0;
            dtwComputations = 0;
            skippedFrames = 0;
            earlyTerminations = 0;
            totalComputationTime = 0;
            averageDistance = 0;
        }
    }

    private final PerformanceStats performanceStats = new PerformanceStats();

    public PerformanceStats getPerformanceStats() {
        return performanceStats;
    }
}
