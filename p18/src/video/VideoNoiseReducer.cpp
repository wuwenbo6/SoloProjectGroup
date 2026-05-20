#include "VideoNoiseReducer.h"
#include <QtMath>
#include <QPainter>

VideoNoiseReducer::VideoNoiseReducer(QObject *parent)
    : QObject(parent)
    , m_frameCount(0)
    , m_temporalBufferValid(false)
{
}

void VideoNoiseReducer::setParameters(const DenoiseParameters& params)
{
    m_params = params;
}

DenoiseParameters VideoNoiseReducer::getParameters() const
{
    return m_params;
}

NoiseProfile VideoNoiseReducer::analyzeNoise(const QImage& frame)
{
    NoiseProfile profile;
    
    if (frame.isNull()) return profile;
    
    QImage grayFrame = frame.convertToFormat(QImage::Format_Grayscale8);
    int width = grayFrame.width();
    int height = grayFrame.height();
    
    QVector<float> noiseValues;
    noiseValues.reserve(width * height);
    
    float totalNoise = 0.0f;
    
    for (int y = 2; y < height - 2; y++) {
        for (int x = 2; x < width - 2; x++) {
            float noise = calculateLocalNoise(grayFrame, x, y, 0);
            totalNoise += noise;
            noiseValues.append(noise);
        }
    }
    
    profile.luminanceNoise = totalNoise / noiseValues.size();
    profile.chrominanceNoise = profile.luminanceNoise * 0.5f;
    profile.grainLevel = profile.luminanceNoise * 2.0f;
    profile.histogram = calculateNoiseHistogram(getNoiseMap(frame));
    
    emit noiseProfileUpdated(profile);
    return profile;
}

QImage VideoNoiseReducer::processFrame(const QImage& frame)
{
    if (frame.isNull()) return QImage();
    
    QImage result = frame.convertToFormat(QImage::Format_ARGB32);
    
    if (m_params.enableDenoise) {
        result = applySpatialDenoise(result);
        
        if (m_params.temporalStrength > 0 && m_temporalBufferValid) {
            result = applyTemporalDenoise(result);
        }
    }
    
    if (m_params.enableSharpen) {
        result = applySharpen(result);
    }
    
    m_temporalBuffer = result;
    m_temporalBufferValid = true;
    m_frameCount++;
    
    emit processingComplete(result);
    return result;
}

QImage VideoNoiseReducer::getNoiseMap(const QImage& frame)
{
    if (frame.isNull()) return QImage();
    
    QImage grayFrame = frame.convertToFormat(QImage::Format_Grayscale8);
    QImage noiseMap(frame.size(), QImage::Format_Grayscale8);
    
    int width = grayFrame.width();
    int height = grayFrame.height();
    
    for (int y = 0; y < height; y++) {
        uchar* dstLine = noiseMap.scanLine(y);
        
        for (int x = 0; x < width; x++) {
            if (x > 1 && x < width - 2 && y > 1 && y < height - 2) {
                float noise = calculateLocalNoise(grayFrame, x, y, 0);
                dstLine[x] = qBound(0, static_cast<int>(noise * 255.0f), 255);
            } else {
                dstLine[x] = 0;
            }
        }
    }
    
    return noiseMap;
}

QImage VideoNoiseReducer::getNoiseDistribution()
{
    return QImage();
}

void VideoNoiseReducer::resetTemporalBuffer()
{
    m_temporalBufferValid = false;
    m_frameCount = 0;
}

QImage VideoNoiseReducer::applySpatialDenoise(const QImage& input)
{
    QImage result(input.size(), input.format());
    
    int width = input.width();
    int height = input.height();
    
    float lumStrength = m_params.luminanceStrength;
    float chromStrength = m_params.chrominanceStrength;
    
    for (int y = 0; y < height; y++) {
        const uchar* srcLine = input.scanLine(y);
        uchar* dstLine = result.scanLine(y);
        
        for (int x = 0; x < width; x++) {
            int idx = x * 4;
            
            if (x == 0 || x == width - 1 || y == 0 || y == height - 1) {
                dstLine[idx] = srcLine[idx];
                dstLine[idx + 1] = srcLine[idx + 1];
                dstLine[idx + 2] = srcLine[idx + 2];
                dstLine[idx + 3] = srcLine[idx + 3];
                continue;
            }
            
            float sumR = 0, sumG = 0, sumB = 0;
            float weightSum = 0;
            
            for (int ky = -2; ky <= 2; ky++) {
                for (int kx = -2; kx <= 2; kx++) {
                    const uchar* srcNeighbor = input.scanLine(y + ky) + (x + kx) * 4;
                    
                    float dist = qSqrt(kx * kx + ky * ky);
                    float weight = qExp(-dist * dist / 2.0f);
                    
                    float colorDist = 
                        qAbs(srcNeighbor[0] - srcLine[idx]) +
                        qAbs(srcNeighbor[1] - srcLine[idx + 1]) +
                        qAbs(srcNeighbor[2] - srcLine[idx + 2]);
                    
                    colorDist /= (255.0f * 3.0f);
                    weight *= qExp(-colorDist * colorDist * 10.0f);
                    
                    sumR += srcNeighbor[0] * weight;
                    sumG += srcNeighbor[1] * weight;
                    sumB += srcNeighbor[2] * weight;
                    weightSum += weight;
                }
            }
            
            if (weightSum > 0) {
                float blend = lumStrength;
                dstLine[idx] = srcLine[idx] * (1 - blend) + (sumR / weightSum) * blend;
                dstLine[idx + 1] = srcLine[idx + 1] * (1 - blend) + (sumG / weightSum) * blend;
                dstLine[idx + 2] = srcLine[idx + 2] * (1 - blend) + (sumB / weightSum) * blend;
                dstLine[idx + 3] = srcLine[idx + 3];
            }
        }
    }
    
    return result;
}

QImage VideoNoiseReducer::applyTemporalDenoise(const QImage& input)
{
    QImage result(input.size(), input.format());
    
    float alpha = 1.0f - m_params.temporalStrength;
    
    for (int y = 0; y < input.height(); y++) {
        const uchar* srcLine = input.scanLine(y);
        const uchar* prevLine = m_temporalBuffer.scanLine(y);
        uchar* dstLine = result.scanLine(y);
        
        for (int x = 0; x < input.width(); x++) {
            int idx = x * 4;
            
            dstLine[idx] = srcLine[idx] * alpha + prevLine[idx] * (1 - alpha);
            dstLine[idx + 1] = srcLine[idx + 1] * alpha + prevLine[idx + 1] * (1 - alpha);
            dstLine[idx + 2] = srcLine[idx + 2] * alpha + prevLine[idx + 2] * (1 - alpha);
            dstLine[idx + 3] = srcLine[idx + 3];
        }
    }
    
    return result;
}

QImage VideoNoiseReducer::applySharpen(const QImage& input)
{
    QImage result(input.size(), input.format());
    
    float amount = m_params.sharpenAmount;
    
    float kernel[3][3] = {
        { 0, -1,  0 },
        {-1,  5, -1 },
        { 0, -1,  0 }
    };
    
    for (int y = 1; y < input.height() - 1; y++) {
        uchar* dstLine = result.scanLine(y);
        
        for (int x = 1; x < input.width() - 1; x++) {
            int idx = x * 4;
            
            for (int c = 0; c < 3; c++) {
                float sum = 0;
                
                for (int ky = -1; ky <= 1; ky++) {
                    for (int kx = -1; kx <= 1; kx++) {
                        const uchar* srcNeighbor = input.scanLine(y + ky) + (x + kx) * 4;
                        sum += srcNeighbor[c] * kernel[ky + 1][kx + 1];
                    }
                }
                
                float original = input.scanLine(y)[idx + c];
                float sharpened = original + (sum - original) * amount;
                dstLine[idx + c] = qBound(0, static_cast<int>(sharpened), 255);
            }
            
            dstLine[idx + 3] = input.scanLine(y)[idx + 3];
        }
    }
    
    for (int x = 0; x < input.width(); x++) {
        for (int c = 0; c < 4; c++) {
            result.scanLine(0)[x * 4 + c] = input.scanLine(0)[x * 4 + c];
            result.scanLine(input.height() - 1)[x * 4 + c] = input.scanLine(input.height() - 1)[x * 4 + c];
        }
    }
    
    for (int y = 0; y < input.height(); y++) {
        result.scanLine(y)[3] = input.scanLine(y)[3];
        result.scanLine(y)[(input.width() - 1) * 4 + 3] = input.scanLine(y)[(input.width() - 1) * 4 + 3];
    }
    
    return result;
}

float VideoNoiseReducer::calculateLocalNoise(const QImage& input, int x, int y, int channel)
{
    Q_UNUSED(channel)
    
    float center = input.scanLine(y)[x] / 255.0f;
    float sumDiff = 0.0f;
    
    for (int ky = -1; ky <= 1; ky++) {
        for (int kx = -1; kx <= 1; kx++) {
            if (kx == 0 && ky == 0) continue;
            
            float neighbor = input.scanLine(y + ky)[x + kx] / 255.0f;
            sumDiff += qAbs(center - neighbor);
        }
    }
    
    return sumDiff / 8.0f;
}

QVector<float> VideoNoiseReducer::calculateNoiseHistogram(const QImage& noiseMap)
{
    QVector<float> histogram(64, 0.0f);
    
    if (noiseMap.isNull()) return histogram;
    
    int totalPixels = noiseMap.width() * noiseMap.height();
    
    for (int y = 0; y < noiseMap.height(); y++) {
        const uchar* line = noiseMap.scanLine(y);
        
        for (int x = 0; x < noiseMap.width(); x++) {
            int bin = (line[x] * histogram.size()) / 256;
            bin = qBound(0, bin, histogram.size() - 1);
            histogram[bin]++;
        }
    }
    
    for (int i = 0; i < histogram.size(); i++) {
        histogram[i] /= totalPixels;
    }
    
    return histogram;
}
