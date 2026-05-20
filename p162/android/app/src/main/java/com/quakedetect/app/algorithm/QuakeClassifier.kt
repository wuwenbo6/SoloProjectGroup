package com.quakedetect.app.algorithm

import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sqrt

class QuakeClassifier {

    data class FeatureVector(
        val meanAmplitude: Double,
        val stdAmplitude: Double,
        val peakFrequency: Double,
        val spectralCentroid: Double,
        val duration: Double,
        val riseTime: Double,
        val maxRatio: Double,
        val zeroCrossingRate: Double
    )

    data class ClassificationResult(
        val isEarthquake: Boolean,
        val earthquakeProbability: Double,
        val humanActivityProbability: Double,
        val confidence: Double,
        val features: FeatureVector
    )

    private class LogisticRegression(
        private val weights: DoubleArray,
        private val bias: Double
    ) {
        fun predictProbability(features: DoubleArray): Double {
            var z = bias
            for (i in features.indices) {
                z += weights[i] * features[i]
            }
            return 1.0 / (1.0 + exp(-z))
        }
    }

    private val earthquakeModel = LogisticRegression(
        weights = doubleArrayOf(
            0.8,
            1.2,
            -0.5,
            0.9,
            1.5,
            0.7,
            1.1,
            -0.8
        ),
        bias = -3.0
    )

    fun extractFeatures(samples: List<Double>, sampleRate: Double = 20.0): FeatureVector {
        if (samples.isEmpty()) {
            return FeatureVector(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        }

        val n = samples.size
        val mean = samples.average()

        var variance = 0.0
        var maxVal = Double.MIN_VALUE
        var minVal = Double.MAX_VALUE
        var maxIndex = 0

        for (i in samples.indices) {
            val diff = samples[i] - mean
            variance += diff * diff
            if (samples[i] > maxVal) {
                maxVal = samples[i]
                maxIndex = i
            }
            if (samples[i] < minVal) {
                minVal = samples[i]
            }
        }
        variance /= n
        val std = sqrt(variance)

        val peakFreq = calculatePeakFrequency(samples, sampleRate)
        val specCentroid = calculateSpectralCentroid(samples, sampleRate)
        val duration = n / sampleRate
        val riseTime = maxIndex / sampleRate

        val threshold = mean
        var zeroCrossings = 0
        for (i in 1 until n) {
            if ((samples[i - 1] < threshold && samples[i] >= threshold) ||
                (samples[i - 1] >= threshold && samples[i] < threshold)) {
                zeroCrossings++
            }
        }
        val zcr = zeroCrossings.toDouble() / duration

        val maxRatio = if (minVal > 0.001) maxVal / minVal else maxVal

        return FeatureVector(
            meanAmplitude = mean,
            stdAmplitude = std,
            peakFrequency = peakFreq,
            spectralCentroid = specCentroid,
            duration = duration,
            riseTime = riseTime,
            maxRatio = maxRatio,
            zeroCrossingRate = zcr
        )
    }

    private fun calculatePeakFrequency(samples: List<Double>, sampleRate: Double): Double {
        val n = samples.size.coerceAtMost(64)
        if (n < 16) return 0.0

        val freqs = DoubleArray(5)
        for (k in 0 until 5) {
            val centerFreq = (k + 0.5) * 2.0
            var energy = 0.0
            for (t in 0 until n) {
                val omega = 2.0 * Math.PI * centerFreq / sampleRate * t
                energy += samples[t] * Math.cos(omega)
            }
            freqs[k] = Math.abs(energy)
        }

        var maxIdx = 0
        var maxEnergy = 0.0
        for (i in freqs.indices) {
            if (freqs[i] > maxEnergy) {
                maxEnergy = freqs[i]
                maxIdx = i
            }
        }

        return (maxIdx + 0.5) * 2.0
    }

    private fun calculateSpectralCentroid(samples: List<Double>, sampleRate: Double): Double {
        val n = samples.size.coerceAtMost(64)
        if (n < 16) return 0.0

        var weightedSum = 0.0
        var totalEnergy = 0.0

        for (k in 0 until 5) {
            val centerFreq = (k + 0.5) * 2.0
            var energy = 0.0
            for (t in 0 until n) {
                val omega = 2.0 * Math.PI * centerFreq / sampleRate * t
                energy += samples[t] * Math.cos(omega)
            }
            energy = Math.abs(energy)
            weightedSum += centerFreq * energy
            totalEnergy += energy
        }

        return if (totalEnergy > 0.001) weightedSum / totalEnergy else 0.0
    }

    fun classify(features: FeatureVector): ClassificationResult {
        val featureArray = normalizeFeatures(features)

        val quakeProb = earthquakeModel.predictProbability(featureArray)
        val humanProb = 1.0 - quakeProb

        val confidence = Math.abs(quakeProb - 0.5) * 2.0

        return ClassificationResult(
            isEarthquake = quakeProb > 0.6,
            earthquakeProbability = quakeProb,
            humanActivityProbability = humanProb,
            confidence = confidence,
            features = features
        )
    }

    private fun normalizeFeatures(features: FeatureVector): DoubleArray {
        return doubleArrayOf(
            (features.meanAmplitude - 5.0) / 10.0,
            (features.stdAmplitude - 3.0) / 8.0,
            (features.peakFrequency - 4.0) / 6.0,
            (features.spectralCentroid - 4.0) / 6.0,
            (features.duration - 5.0) / 15.0,
            (features.riseTime - 2.0) / 8.0,
            (features.maxRatio - 5.0) / 20.0,
            (features.zeroCrossingRate - 5.0) / 10.0
        )
    }

    fun classifyFromSamples(samples: List<Double>, sampleRate: Double = 20.0): ClassificationResult {
        val features = extractFeatures(samples, sampleRate)
        return classify(features)
    }
}

class FeatureBuffer(private val maxSize: Int = 500) {
    private val buffer = ArrayDeque<Double>()

    fun add(value: Double) {
        buffer.addLast(value)
        if (buffer.size > maxSize) {
            buffer.removeFirst()
        }
    }

    fun getRecent(windowSize: Int): List<Double> {
        return buffer.takeLast(windowSize.coerceAtMost(buffer.size))
    }

    fun clear() {
        buffer.clear()
    }

    fun size(): Int = buffer.size
}
