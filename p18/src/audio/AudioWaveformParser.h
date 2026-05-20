#ifndef AUDIOWAVEFORMPARSER_H
#define AUDIOWAVEFORMPARSER_H

#include <QObject>
#include <QVector>
#include <QMutex>
#include <QAudioFormat>

struct AudioChannelData {
    QVector<float> samples;
    float rmsLevel;
    float peakLevel;
    float highFreqNoiseLevel;
    float noiseFloor;
    bool isClipping;
};

class AudioWaveformParser : public QObject
{
    Q_OBJECT
public:
    explicit AudioWaveformParser(QObject *parent = nullptr);
    
    void setAudioFormat(int sampleRate, int channelCount, int sampleSize);
    void setBufferSize(int milliseconds);
    void setNoiseThreshold(float threshold);
    
    void processAudioData(const QByteArray& data);
    
    AudioChannelData getChannelData(int channel) const;
    int getChannelCount() const { return m_channelCount; }
    
    float getRMSLevel(int channel) const;
    float getPeakLevel(int channel) const;
    float getHighFreqNoise(int channel) const;
    bool hasHighFreqDistortion(int channel) const;
    
    void clear();
    void resetDCFilter();

signals:
    void waveformUpdated();
    void levelUpdated(int channel, float rms, float peak);
    void noiseDetected(int channel, float level, bool isDistortion);

private:
    void parsePCMData(const QByteArray& data);
    void calculateLevels();
    void analyzeHighFrequencyNoise(int channel);
    float calculateZeroCrossingRate(const QVector<float>& samples);
    void applyDCRemoval(QVector<float>& samples);

    QAudioFormat m_format;
    int m_sampleRate;
    int m_channelCount;
    int m_sampleSize;
    int m_bufferSizeMs;
    
    QVector<AudioChannelData> m_channelData;
    QVector<QVector<float>> m_sampleBuffer;
    QVector<float> m_dcOffsets;
    QVector<float> m_prevSamples;
    mutable QMutex m_mutex;
    
    int m_samplesPerBuffer;
    int m_currentSampleIndex;
    float m_noiseThreshold;
    const float HIGH_FREQ_THRESHOLD = 0.15f;
    const float CLIP_THRESHOLD = 0.95f;
};

#endif
