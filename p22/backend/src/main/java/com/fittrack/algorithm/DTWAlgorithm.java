package com.fittrack.algorithm;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DTWAlgorithm {

    private static final int DEFAULT_WINDOW_SIZE = 10;

    public double calculateDistance(double[] sequence1, double[] sequence2) {
        int n = sequence1.length;
        int m = sequence2.length;

        double[][] dtw = new double[n + 1][m + 1];

        for (int i = 0; i <= n; i++) {
            for (int j = 0; j <= m; j++) {
                dtw[i][j] = Double.POSITIVE_INFINITY;
            }
        }
        dtw[0][0] = 0;

        int window = Math.max(DEFAULT_WINDOW_SIZE, Math.abs(n - m));

        for (int i = 1; i <= n; i++) {
            for (int j = Math.max(1, i - window); j <= Math.min(m, i + window); j++) {
                double cost = Math.abs(sequence1[i - 1] - sequence2[j - 1]);
                dtw[i][j] = cost + min(
                        dtw[i - 1][j],
                        dtw[i][j - 1],
                        dtw[i - 1][j - 1]
                );
            }
        }

        return dtw[n][m];
    }

    public double calculateMultiDimensionalDistance(List<double[]> sequence1, List<double[]> sequence2) {
        int n = sequence1.size();
        int m = sequence2.size();

        double[][] dtw = new double[n + 1][m + 1];

        for (int i = 0; i <= n; i++) {
            for (int j = 0; j <= m; j++) {
                dtw[i][j] = Double.POSITIVE_INFINITY;
            }
        }
        dtw[0][0] = 0;

        int window = Math.max(DEFAULT_WINDOW_SIZE, Math.abs(n - m));

        for (int i = 1; i <= n; i++) {
            for (int j = Math.max(1, i - window); j <= Math.min(m, i + window); j++) {
                double cost = euclideanDistance(sequence1.get(i - 1), sequence2.get(j - 1));
                dtw[i][j] = cost + min(
                        dtw[i - 1][j],
                        dtw[i][j - 1],
                        dtw[i - 1][j - 1]
                );
            }
        }

        return dtw[n][m];
    }

    private double min(double a, double b, double c) {
        return Math.min(a, Math.min(b, c));
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

    public double calculateSimilarityScore(double[] sequence1, double[] sequence2) {
        double distance = calculateDistance(sequence1, sequence2);
        double maxDistance = calculateMaxPossibleDistance(sequence1, sequence2);
        return Math.max(0, 100 * (1 - distance / maxDistance));
    }

    private double calculateMaxPossibleDistance(double[] seq1, double[] seq2) {
        double max1 = getMaxValue(seq1);
        double max2 = getMaxValue(seq2);
        double maxVal = Math.max(max1, max2);
        return maxVal * Math.max(seq1.length, seq2.length);
    }

    private double getMaxValue(double[] seq) {
        double max = Double.NEGATIVE_INFINITY;
        for (double v : seq) {
            if (v > max) {
                max = v;
            }
        }
        return max;
    }
}
