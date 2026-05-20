package com.quakedetect.app.algorithm

import kotlin.math.sqrt

class StaLtaDetector(
    private val staWindowSize: Int = 20,
    private val ltaWindowSize: Int = 200,
    private val threshold: Double = 3.5,
    private val minDuration: Int = 10
) {
    private val staBuffer = ArrayDeque<Double>()
    private val ltaBuffer = ArrayDeque<Double>()
    private var triggerCount = 0
    private var isTriggered = false
    
    private val gravityFilter = GravityFilter()
    private val highPassFilterX = HighPassFilter(cutoffFrequency = 1.0, sampleRate = 20.0)
    private val highPassFilterY = HighPassFilter(cutoffFrequency = 1.0, sampleRate = 20.0)
    private val highPassFilterZ = HighPassFilter(cutoffFrequency = 1.0, sampleRate = 20.0)
    private val frequencyAnalyzer = FrequencyAnalyzer()
    
    private var lastMotionType = MotionType.UNKNOWN
    private var motionTypeCounter = 0
    
    enum class MotionType {
        UNKNOWN,
        WALKING,
        EARTHQUAKE,
        NOISE
    }
    
    fun addSample(accelX: Float, accelY: Float, accelZ: Float): DetectionResult {
        val (filteredX, filteredY, filteredZ) = gravityFilter.process(accelX, accelY, accelZ)
        
        val hpX = highPassFilterX.process(filteredX)
        val hpY = highPassFilterY.process(filteredY)
        val hpZ = highPassFilterZ.process(filteredZ)
        
        val magnitude = sqrt(hpX * hpX + hpY * hpY + hpZ * hpZ)
        
        frequencyAnalyzer.addSample(magnitude)
        
        staBuffer.addLast(magnitude)
        ltaBuffer.addLast(magnitude)
        
        if (staBuffer.size > staWindowSize) staBuffer.removeFirst()
        if (ltaBuffer.size > ltaWindowSize) ltaBuffer.removeFirst()
        
        val sta = calculateAverage(staBuffer)
        val lta = calculateAverage(ltaBuffer)
        
        val ratio = if (lta > 0.001) sta / lta else 0.0
        
        val motionType = detectMotionType(magnitude, ratio)
        
        val wasTriggered = isTriggered
        val isAboveThreshold = ratio >= threshold && motionType == MotionType.EARTHQUAKE
        
        if (isAboveThreshold) {
            triggerCount++
            if (triggerCount >= minDuration && !isTriggered) {
                isTriggered = true
            }
        } else {
            triggerCount = (triggerCount - 1).coerceAtLeast(0)
            if (triggerCount == 0) {
                isTriggered = false
            }
        }
        
        return DetectionResult(
            magnitude = magnitude,
            sta = sta,
            lta = lta,
            ratio = ratio,
            isTriggered = isTriggered,
            triggerStart = isTriggered && !wasTriggered,
            intensity = calculateIntensity(magnitude),
            motionType = motionType,
            isEarthquakeFrequency = frequencyAnalyzer.isEarthquakeFrequency()
        )
    }
    
    private fun detectMotionType(magnitude: Double, staLtaRatio: Double): MotionType {
        if (magnitude < 0.1) {
            return MotionType.NOISE
        }
        
        val isQuakeFreq = frequencyAnalyzer.isEarthquakeFrequency()
        
        if (magnitude > 15.0) {
            return MotionType.WALKING
        }
        
        if (staLtaRatio > 2.0 && isQuakeFreq) {
            return MotionType.EARTHQUAKE
        }
        
        if (staLtaRatio > 1.5 && !isQuakeFreq) {
            motionTypeCounter++
            if (motionTypeCounter > 20) {
                motionTypeCounter = 0
                return MotionType.WALKING
            }
        }
        
        return MotionType.UNKNOWN
    }
    
    private fun calculateAverage(buffer: List<Double>): Double {
        if (buffer.isEmpty()) return 0.0
        return buffer.sum() / buffer.size
    }
    
    private fun calculateIntensity(magnitude: Double): Double {
        return (magnitude * 2).coerceIn(0.0, 10.0)
    }
    
    fun reset() {
        staBuffer.clear()
        ltaBuffer.clear()
        triggerCount = 0
        isTriggered = false
        gravityFilter.reset()
        highPassFilterX.reset()
        highPassFilterY.reset()
        highPassFilterZ.reset()
        frequencyAnalyzer.reset()
        motionTypeCounter = 0
        lastMotionType = MotionType.UNKNOWN
    }
}

data class DetectionResult(
    val magnitude: Double,
    val sta: Double,
    val lta: Double,
    val ratio: Double,
    val isTriggered: Boolean,
    val triggerStart: Boolean,
    val intensity: Double,
    val motionType: StaLtaDetector.MotionType,
    val isEarthquakeFrequency: Boolean
)
