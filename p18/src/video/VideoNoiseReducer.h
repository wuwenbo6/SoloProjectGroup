#ifndef VIDENOISEREDUCER_H
#define VIDENOISEREDUCER_H

#include <QObject>
#include <QImage>
#include <QVector>

struct NoiseProfile {
    float luminanceNoise;
    float chrominanceNoise;
    float grainLevel;
    QVector<float> histogram;
};

struct DenoiseParameters {
    float luminanceStrength;
    float chrominanceStrength;
    float temporalStrength;
    float sharpenAmount;
    bool enableDenoise;
    bool enableSharpen;
    
    DenoiseParameters()
        : luminanceStrength(0.5f)
        , chrominanceStrength(0.3f)
        , temporalStrength(0.2f)
        , sharpenAmount(0.1f)
        , enableDenoise(true)
        , enableSharpen(false)
    {}
};

class VideoNoiseReducer : public QObject
{
    Q_OBJECT
public:
    explicit VideoNoiseReducer(QObject *parent = nullptr);
    
    void setParameters(const DenoiseParameters& params);
    DenoiseParameters getParameters() const;
    
    NoiseProfile analyzeNoise(const QImage& frame);
    QImage processFrame(const QImage& frame);
    
    QImage getNoiseMap(const QImage& frame);
    QImage getNoiseDistribution();
    
    void resetTemporalBuffer();

signals:
    void noiseProfileUpdated(const NoiseProfile& profile);
    void processingComplete(const QImage& result);

private:
    QImage applySpatialDenoise(const QImage& input);
    QImage applyTemporalDenoise(const QImage& input);
    QImage applySharpen(const QImage& input);
    
    float calculateLocalNoise(const QImage& input, int x, int y, int channel);
    QVector<float> calculateNoiseHistogram(const QImage& noiseMap);
    
    DenoiseParameters m_params;
    QImage m_temporalBuffer;
    int m_frameCount;
    bool m_temporalBufferValid;
};

#endif
