#include "AudioWaveformParser.h"
#include <QtMath>
#include <QDebug>

AudioWaveformParser::AudioWaveformParser(QObject *parent)
    : QObject(parent)
    , m_sampleRate(44100)
    , m_channelCount(2)
    , m_sampleSize(16)
    , m_bufferSizeMs(1000)
    , m_samplesPerBuffer(44100)
    , m_currentSampleIndex(0)
    , m_noiseThreshold(0.02f)
{
    setAudioFormat(44100, 2, 16);
    setBufferSize(1000);
}

void AudioWaveformParser::setAudioFormat(int sampleRate, int channelCount, int sampleSize)
{
    QMutexLocker locker(&m_mutex);
    
    m_sampleRate = sampleRate;
    m_channelCount = channelCount;
    m_sampleSize = sampleSize;
    
    m_format.setSampleRate(sampleRate);
    m_format.setChannelCount(channelCount);
    m_format.setSampleSize(sampleSize);
    m_format.setCodec("audio/pcm");
    m_format.setByteOrder(QAudioFormat::LittleEndian);
    m_format.setSampleType(QAudioFormat::SignedInt);
    
    m_samplesPerBuffer = m_sampleRate * m_bufferSizeMs / 1000;
    
    m_sampleBuffer.resize(m_channelCount);
    m_channelData.resize(m_channelCount);
    m_dcOffsets.resize(m_channelCount, 0.0f);
    m_prevSamples.resize(m_channelCount, 0.0f);
    
    for (int i = 0; i < m_channelCount; i++) {
        m_sampleBuffer[i].resize(m_samplesPerBuffer);
        m_sampleBuffer[i].fill(0.0f);
        m_channelData[i].samples.resize(m_samplesPerBuffer);
        m_channelData[i].samples.fill(0.0f);
        m_channelData[i].rmsLevel = 0.0f;
        m_channelData[i].peakLevel = 0.0f;
        m_channelData[i].highFreqNoiseLevel = 0.0f;
        m_channelData[i].noiseFloor = 0.0f;
        m_channelData[i].isClipping = false;
    }
    
    m_currentSampleIndex = 0;
}

void AudioWaveformParser::setNoiseThreshold(float threshold)
{
    m_noiseThreshold = qBound(0.001f, threshold, 1.0f);
}

void AudioWaveformParser::setBufferSize(int milliseconds)
{
    m_bufferSizeMs = milliseconds;
    setAudioFormat(m_sampleRate, m_channelCount, m_sampleSize);
}

void AudioWaveformParser::processAudioData(const QByteArray& data)
{
    QMutexLocker locker(&m_mutex);
    parsePCMData(data);
    calculateLevels();
    
    for (int ch = 0; ch < m_channelCount; ch++) {
        analyzeHighFrequencyNoise(ch);
    }
    
    emit waveformUpdated();
}

void AudioWaveformParser::parsePCMData(const QByteArray& data)
{
    int bytesPerSample = m_sampleSize / 8;
    int bytesPerFrame = bytesPerSample * m_channelCount;
    int frameCount = data.size() / bytesPerFrame;
    
    float maxValue = (1 << (m_sampleSize - 1)) - 1;
    
    for (int i = 0; i < frameCount; i++) {
        for (int ch = 0; ch < m_channelCount; ch++) {
            int offset = i * bytesPerFrame + ch * bytesPerSample;
            float normalized = 0.0f;
            
            if (m_sampleSize == 16) {
                qint16 sample = *reinterpret_cast<const qint16*>(data.constData() + offset);
                normalized = sample / maxValue;
            } else if (m_sampleSize == 24) {
                qint32 sample = (data[offset] & 0xFF) | 
                               ((data[offset + 1] & 0xFF) << 8) | 
                               ((data[offset + 2] & 0xFF) << 16);
                if (sample & 0x800000) sample |= 0xFF000000;
                normalized = sample / 8388607.0f;
            } else if (m_sampleSize == 32) {
                qint32 sample = *reinterpret_cast<const qint32*>(data.constData() + offset);
                normalized = sample / 2147483647.0f;
            }
            
            m_dcOffsets[ch] = m_dcOffsets[ch] * 0.999f + normalized * 0.001f;
            normalized -= m_dcOffsets[ch];
            
            m_sampleBuffer[ch][m_currentSampleIndex] = qBound(-1.0f, normalized, 1.0f);
        }
        
        m_currentSampleIndex = (m_currentSampleIndex + 1) % m_samplesPerBuffer;
    }
    
    for (int ch = 0; ch < m_channelCount; ch++) {
        m_channelData[ch].samples = m_sampleBuffer[ch];
    }
}

void AudioWaveformParser::calculateLevels()
{
    for (int ch = 0; ch < m_channelCount; ch++) {
        float sumSquares = 0.0f;
        float peak = 0.0f;
        
        int windowSize = qMin(1024, m_samplesPerBuffer);
        int startIdx = (m_currentSampleIndex - windowSize + m_samplesPerBuffer) % m_samplesPerBuffer;
        
        for (int i = 0; i < windowSize; i++) {
            int idx = (startIdx + i) % m_samplesPerBuffer;
            float sample = m_sampleBuffer[ch][idx];
            sumSquares += sample * sample;
            peak = qMax(peak, qAbs(sample));
        }
        
        float rms = qSqrt(sumSquares / windowSize);
        m_channelData[ch].rmsLevel = rms;
        m_channelData[ch].peakLevel = peak;
        
        emit levelUpdated(ch, rms, peak);
    }
}

AudioChannelData AudioWaveformParser::getChannelData(int channel) const
{
    QMutexLocker locker(&m_mutex);
    if (channel >= 0 && channel < m_channelData.size()) {
        return m_channelData[channel];
    }
    return AudioChannelData();
}

float AudioWaveformParser::getRMSLevel(int channel) const
{
    QMutexLocker locker(&m_mutex);
    if (channel >= 0 && channel < m_channelData.size()) {
        return m_channelData[channel].rmsLevel;
    }
    return 0.0f;
}

float AudioWaveformParser::getPeakLevel(int channel) const
{
    QMutexLocker locker(&m_mutex);
    if (channel >= 0 && channel < m_channelData.size()) {
        return m_channelData[channel].peakLevel;
    }
    return 0.0f;
}

void AudioWaveformParser::clear()
{
    QMutexLocker locker(&m_mutex);
    for (int i = 0; i < m_channelCount; i++) {
        m_sampleBuffer[i].fill(0.0f);
        m_channelData[i].samples.fill(0.0f);
        m_channelData[i].rmsLevel = 0.0f;
        m_channelData[i].peakLevel = 0.0f;
        m_channelData[i].highFreqNoiseLevel = 0.0f;
        m_channelData[i].noiseFloor = 0.0f;
        m_channelData[i].isClipping = false;
    }
    m_currentSampleIndex = 0;
}

float AudioWaveformParser::getHighFreqNoise(int channel) const
{
    QMutexLocker locker(&m_mutex);
    if (channel >= 0 && channel < m_channelData.size()) {
        return m_channelData[channel].highFreqNoiseLevel;
    }
    return 0.0f;
}

bool AudioWaveformParser::hasHighFreqDistortion(int channel) const
{
    QMutexLocker locker(&m_mutex);
    if (channel >= 0 && channel < m_channelData.size()) {
        return m_channelData[channel].highFreqNoiseLevel > HIGH_FREQ_THRESHOLD;
    }
    return false;
}

void AudioWaveformParser::resetDCFilter()
{
    QMutexLocker locker(&m_mutex);
    m_dcOffsets.fill(0.0f);
}

void AudioWaveformParser::analyzeHighFrequencyNoise(int channel)
{
    if (channel < 0 || channel >= m_channelCount) return;
    
    int analysisWindow = qMin(512, m_samplesPerBuffer);
    int startIdx = (m_currentSampleIndex - analysisWindow + m_samplesPerBuffer) % m_samplesPerBuffer;
    
    QVector<float> windowSamples;
    windowSamples.reserve(analysisWindow);
    for (int i = 0; i < analysisWindow; i++) {
        int idx = (startIdx + i) % m_samplesPerBuffer;
        windowSamples.append(m_sampleBuffer[channel][idx]);
    }
    
    float sumDiffSq = 0.0f;
    int diffCount = 0;
    for (int i = 1; i < windowSamples.size(); i++) {
        float diff = windowSamples[i] - windowSamples[i - 1];
        sumDiffSq += diff * diff;
        diffCount++;
    }
    
    float diffRMS = 0.0f;
    if (diffCount > 0) {
        diffRMS = qSqrt(sumDiffSq / diffCount);
    }
    
    float signalRMS = m_channelData[channel].rmsLevel;
    float noiseRatio = 0.0f;
    if (signalRMS > m_noiseThreshold) {
        noiseRatio = diffRMS / signalRMS;
    }
    
    float zcr = calculateZeroCrossingRate(windowSamples);
    float highFreqScore = (noiseRatio * 0.6f + zcr * 0.4f);
    
    m_channelData[channel].highFreqNoiseLevel = qBound(0.0f, highFreqScore, 1.0f);
    
    float absMax = 0.0f;
    for (float s : windowSamples) {
        absMax = qMax(absMax, qAbs(s));
    }
    m_channelData[channel].isClipping = absMax > CLIP_THRESHOLD;
    
    if (highFreqScore > HIGH_FREQ_THRESHOLD || m_channelData[channel].isClipping) {
        emit noiseDetected(channel, highFreqScore, m_channelData[channel].isClipping);
    }
}

float AudioWaveformParser::calculateZeroCrossingRate(const QVector<float>& samples)
{
    if (samples.size() < 2) return 0.0f;
    
    int crossings = 0;
    for (int i = 1; i < samples.size(); i++) {
        if ((samples[i] >= 0 && samples[i - 1] < 0) ||
            (samples[i] < 0 && samples[i - 1] >= 0)) {
            crossings++;
        }
    }
    
    return static_cast<float>(crossings) / samples.size();
}

void AudioWaveformParser::applyDCRemoval(QVector<float>& samples)
{
    if (samples.isEmpty()) return;
    
    float sum = 0.0f;
    for (float s : samples) {
        sum += s;
    }
    float dc = sum / samples.size();
    
    for (int i = 0; i < samples.size(); i++) {
        samples[i] -= dc;
    }
}
