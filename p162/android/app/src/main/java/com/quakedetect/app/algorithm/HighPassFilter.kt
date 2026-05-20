package com.quakedetect.app.algorithm

import kotlin.math.exp
import kotlin.math.PI

class HighPassFilter(
    private val cutoffFrequency: Double = 0.5,
    private val sampleRate: Double = 20.0,
    private val order: Int = 2
) {
    private var x1 = 0.0
    private var x2 = 0.0
    private var y1 = 0.0
    private var y2 = 0.0
    
    private var a0 = 0.0
    private var a1 = 0.0
    private var a2 = 0.0
    private var b1 = 0.0
    private var b2 = 0.0
    
    init {
        calculateCoefficients()
    }
    
    private fun calculateCoefficients() {
        val omega = 2.0 * PI * cutoffFrequency / sampleRate
        val cosw = kotlin.math.cos(omega)
        val sinw = kotlin.math.sin(omega)
        val alpha = sinw / (2.0 * 0.7071)
        
        val scale = 1.0 + alpha
        
        a0 = (1.0 + cosw) / 2.0 / scale
        a1 = -(1.0 + cosw) / scale
        a2 = (1.0 + cosw) / 2.0 / scale
        b1 = -2.0 * cosw / scale
        b2 = (1.0 - alpha) / scale
    }
    
    fun process(input: Double): Double {
        val output = a0 * input + a1 * x1 + a2 * x2 - b1 * y1 - b2 * y2
        
        x2 = x1
        x1 = input
        y2 = y1
        y1 = output
        
        return output
    }
    
    fun reset() {
        x1 = 0.0
        x2 = 0.0
        y1 = 0.0
        y2 = 0.0
    }
}

class GravityFilter {
    private val alpha = 0.8
    
    private var gravityX = 0.0
    private var gravityY = 0.0
    private var gravityZ = 0.0
    
    fun process(x: Float, y: Float, z: Float): Triple<Double, Double, Double> {
        gravityX = alpha * gravityX + (1 - alpha) * x
        gravityY = alpha * gravityY + (1 - alpha) * y
        gravityZ = alpha * gravityZ + (1 - alpha) * z
        
        return Triple(
            x.toDouble() - gravityX,
            y.toDouble() - gravityY,
            z.toDouble() - gravityZ
        )
    }
    
    fun reset() {
        gravityX = 0.0
        gravityY = 0.0
        gravityZ = 0.0
    }
}

class FrequencyAnalyzer(
    private val windowSize: Int = 64,
    private val sampleRate: Double = 20.0
) {
    private val signalBuffer = ArrayDeque<Double>()
    private val energyByBand = DoubleArray(5)
    
    fun addSample(value: Double) {
        signalBuffer.addLast(value)
        if (signalBuffer.size > windowSize) {
            signalBuffer.removeFirst()
        }
        
        if (signalBuffer.size >= 16) {
            analyzeFrequency()
        }
    }
    
    private fun analyzeFrequency() {
        val n = signalBuffer.size.coerceAtMost(32)
        val values = signalBuffer.takeLast(n)
        
        energyByBand.fill(0.0)
        
        for (k in 0 until 5) {
            val freqLow = k * 2.0
            val freqHigh = (k + 1) * 2.0
            
            for (t in 0 until n) {
                val omega = 2.0 * PI * (freqLow + freqHigh) / 2.0 / sampleRate * t
                energyByBand[k] += values[t] * kotlin.math.cos(omega)
            }
            energyByBand[k] = kotlin.math.abs(energyByBand[k]) / n
        }
    }
    
    fun getDominantFrequencyBand(): Int {
        var maxIndex = 0
        var maxEnergy = 0.0
        for (i in energyByBand.indices) {
            if (energyByBand[i] > maxEnergy) {
                maxEnergy = energyByBand[i]
                maxIndex = i
            }
        }
        return maxIndex
    }
    
    fun isEarthquakeFrequency(): Boolean {
        if (signalBuffer.size < 16) return true
        
        val totalEnergy = energyByBand.sum()
        if (totalEnergy < 0.01) return false
        
        val earthquakeBandEnergy = energyByBand[1] + energyByBand[2]
        val ratio = earthquakeBandEnergy / totalEnergy
        
        return ratio > 0.4
    }
    
    fun reset() {
        signalBuffer.clear()
        energyByBand.fill(0.0)
    }
}
