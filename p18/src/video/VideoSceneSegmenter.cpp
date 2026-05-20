#include "VideoSceneSegmenter.h"
#include <QtMath>
#include <QPainter>
#include <QUuid>

VideoSceneSegmenter::VideoSceneSegmenter(QObject *parent)
    : QObject(parent)
    , m_frameCount(0)
    , m_detectionMode(IntelligentAuto)
    , m_sensitivity(0.7f)
    , m_minSegmentDurationMs(3000)
    , m_maxSegmentDurationMs(600000)
    , m_sceneChangeThreshold(0.25f)
    , m_averageBrightness(0.0f)
    , m_brightnessSampleCount(0)
    , m_inSilence(false)
    , m_silenceStartMs(0)
    , m_consecutiveSimilarFrames(0)
{
    m_segmentStartTime = 0;
    m_lastSceneChangeTime = 0;
}

void VideoSceneSegmenter::setDetectionMode(DetectionMode mode)
{
    m_detectionMode = mode;
}

void VideoSceneSegmenter::setSensitivity(float sensitivity)
{
    m_sensitivity = qBound(0.1f, sensitivity, 1.0f);
    m_sceneChangeThreshold = 0.4f - (m_sensitivity * 0.3f);
}

void VideoSceneSegmenter::setMinSegmentDuration(int ms)
{
    m_minSegmentDurationMs = qMax(500, ms);
}

void VideoSceneSegmenter::setMaxSegmentDuration(int ms)
{
    m_maxSegmentDurationMs = qMax(m_minSegmentDurationMs, ms);
}

void VideoSceneSegmenter::processFrame(const QImage& frame, qint64 timestampMs)
{
    if (m_frameCount == 0) {
        m_segmentStartTime = timestampMs;
        m_lastSceneChangeTime = timestampMs;
        m_currentSegment.startTimeMs = timestampMs;
        m_currentSegment.segmentId = QUuid::createUuid().toString();
    }
    
    if (detectBlackFrame(frame)) {
        emit blackFrameDetected(timestampMs);
        
        if (m_detectionMode == IntelligentAuto || m_detectionMode == SceneChangeWithMotion) {
            qint64 currentDuration = timestampMs - m_segmentStartTime;
            if (currentDuration > m_minSegmentDurationMs) {
                finalizeCurrentSegment(timestampMs);
                m_segmentStartTime = timestampMs;
            }
        }
    }
    
    if (!m_prevFrame.isNull() && (m_frameCount % 5 == 0)) {
        if (detectSceneChange(frame)) {
            qint64 currentDuration = timestampMs - m_segmentStartTime;
            if (currentDuration >= m_minSegmentDurationMs) {
                finalizeCurrentSegment(timestampMs);
                m_segmentStartTime = timestampMs;
            }
        }
    }
    
    checkSegmentBoundaries(timestampMs);
    
    QImage scaled = frame.scaled(160, 120, Qt::KeepAspectRatio, Qt::SmoothTransformation);
    m_currentSegment.thumbnail = scaled;
    
    m_prevFrame = frame.copy();
    m_frameCount++;
}

void VideoSceneSegmenter::processAudioLevel(float rmsLevel, float zcr, qint64 timestampMs)
{
    AudioMarker marker;
    marker.timeMs = timestampMs;
    marker.volumeLevel = rmsLevel;
    marker.zeroCrossRate = zcr;
    marker.isSilence = rmsLevel < 0.02f;
    marker.isLoudPeak = rmsLevel > 0.8f;
    
    if (marker.isSilence && !m_inSilence) {
        m_inSilence = true;
        m_silenceStartMs = timestampMs;
    } else if (!marker.isSilence && m_inSilence) {
        qint64 silenceDuration = timestampMs - m_silenceStartMs;
        if (silenceDuration > 500) {
            emit silenceDetected(m_silenceStartMs, timestampMs);
            
            if (m_detectionMode == AudioVideoCombined || m_detectionMode == IntelligentAuto) {
                qint64 currentDuration = timestampMs - m_segmentStartTime;
                if (currentDuration > m_minSegmentDurationMs) {
                    finalizeCurrentSegment(timestampMs);
                    m_segmentStartTime = timestampMs;
                }
            }
        }
        m_inSilence = false;
    }
    
    if (marker.isLoudPeak) {
        qint64 currentDuration = timestampMs - m_segmentStartTime;
        if (currentDuration > m_minSegmentDurationMs * 0.5f) {
            finalizeCurrentSegment(timestampMs);
            m_segmentStartTime = timestampMs;
        }
    }
    
    m_audioMarkers.append(marker);
    if (m_audioMarkers.size() > 1000) {
        m_audioMarkers.removeFirst();
    }
}

bool VideoSceneSegmenter::detectSceneChange(const QImage& currentFrame)
{
    float similarity = calculateFrameSimilarity(m_prevFrame, currentFrame);
    
    m_frameDifferenceHistory.append(1.0f - similarity);
    if (m_frameDifferenceHistory.size() > 30) {
        m_frameDifferenceHistory.removeFirst();
    }
    
    float avgDiff = 0.0f;
    for (float d : m_frameDifferenceHistory) {
        avgDiff += d;
    }
    avgDiff /= m_frameDifferenceHistory.size();
    
    float threshold = m_sceneChangeThreshold * (1.0f + avgDiff * 0.5f);
    
    if ((1.0f - similarity) > threshold) {
        m_consecutiveSimilarFrames = 0;
        emit sceneChangeDetected(m_currentSegment.startTimeMs + m_frameCount * 33, 1.0f - similarity);
        return true;
    }
    
    m_consecutiveSimilarFrames++;
    return false;
}

float VideoSceneSegmenter::calculateFrameSimilarity(const QImage& frame1, const QImage& frame2)
{
    if (frame1.size() != frame2.size()) {
        return 0.0f;
    }
    
    QImage small1 = frame1.scaled(64, 48, Qt::IgnoreAspectRatio, Qt::SmoothTransformation).convertToFormat(QImage::Format_Grayscale8);
    QImage small2 = frame2.scaled(64, 48, Qt::IgnoreAspectRatio, Qt::SmoothTransformation).convertToFormat(QImage::Format_Grayscale8);
    
    qint64 totalDiff = 0;
    int pixelCount = small1.width() * small1.height();
    
    for (int y = 0; y < small1.height(); y++) {
        const uchar* line1 = small1.scanLine(y);
        const uchar* line2 = small2.scanLine(y);
        for (int x = 0; x < small1.width(); x++) {
            int diff = line1[x] - line2[x];
            totalDiff += qAbs(diff);
        }
    }
    
    float avgDiff = static_cast<float>(totalDiff) / pixelCount / 255.0f;
    return 1.0f - avgDiff;
}

bool VideoSceneSegmenter::detectBlackFrame(const QImage& frame)
{
    QImage small = frame.scaled(32, 24, Qt::IgnoreAspectRatio, Qt::SmoothTransformation).convertToFormat(QImage::Format_Grayscale8);
    
    float totalBrightness = 0.0f;
    for (int y = 0; y < small.height(); y++) {
        const uchar* line = small.scanLine(y);
        for (int x = 0; x < small.width(); x++) {
            totalBrightness += line[x];
        }
    }
    
    float avgBrightness = totalBrightness / (small.width() * small.height()) / 255.0f;
    
    m_averageBrightness = (m_averageBrightness * m_brightnessSampleCount + avgBrightness) / (m_brightnessSampleCount + 1);
    m_brightnessSampleCount++;
    
    return avgBrightness < 0.08f;
}

void VideoSceneSegmenter::checkSegmentBoundaries(qint64 timestampMs)
{
    qint64 currentDuration = timestampMs - m_segmentStartTime;
    if (currentDuration >= m_maxSegmentDurationMs) {
        finalizeCurrentSegment(timestampMs);
        m_segmentStartTime = timestampMs;
    }
}

void VideoSceneSegmenter::finalizeCurrentSegment(qint64 endTimestamp)
{
    m_currentSegment.endTimeMs = endTimestamp;
    m_currentSegment.averageBrightness = m_averageBrightness;
    
    emit sceneDetected(m_currentSegment);
    m_detectedSegments.append(m_currentSegment);
    
    m_currentSegment = SceneSegment();
    m_currentSegment.startTimeMs = endTimestamp;
    m_currentSegment.segmentId = QUuid::createUuid().toString();
    m_brightnessSampleCount = 0;
    m_averageBrightness = 0.0f;
}

void VideoSceneSegmenter::reset()
{
    m_prevFrame = QImage();
    m_frameDifferenceHistory.clear();
    m_audioMarkers.clear();
    m_detectedSegments.clear();
    m_manualSegments.clear();
    m_currentSegment = SceneSegment();
    m_frameCount = 0;
    m_segmentStartTime = 0;
    m_lastSceneChangeTime = 0;
    m_averageBrightness = 0.0f;
    m_brightnessSampleCount = 0;
    m_inSilence = false;
    m_silenceStartMs = 0;
    m_consecutiveSimilarFrames = 0;
}

void VideoSceneSegmenter::finalizeDetection()
{
    if (m_currentSegment.startTimeMs > 0 && m_currentSegment.endTimeMs == 0) {
        m_currentSegment.endTimeMs = m_currentSegment.startTimeMs + m_frameCount * 33;
        m_currentSegment.averageBrightness = m_averageBrightness;
        m_detectedSegments.append(m_currentSegment);
    }
}

QList<SceneSegment> VideoSceneSegmenter::getDetectedSegments() const
{
    return m_detectedSegments;
}

QList<SceneSegment> VideoSceneSegmenter::getManualSegments() const
{
    return m_manualSegments;
}

void VideoSceneSegmenter::addManualSegment(qint64 startMs, qint64 endMs)
{
    SceneSegment segment;
    segment.startTimeMs = startMs;
    segment.endTimeMs = endMs;
    segment.segmentId = QUuid::createUuid().toString();
    m_manualSegments.append(segment);
}

float VideoSceneSegmenter::getSceneChangeThreshold() const
{
    return m_sceneChangeThreshold;
}

QList<int> VideoSceneSegmenter::getKeyframePositions(const SceneSegment& segment, int keyframeCount)
{
    QList<int> positions;
    qint64 duration = segment.endTimeMs - segment.startTimeMs;
    
    if (keyframeCount <= 0 || duration <= 0) {
        return positions;
    }
    
    for (int i = 0; i < keyframeCount; i++) {
        qint64 pos = segment.startTimeMs + (duration * i) / (keyframeCount - 1);
        positions.append(static_cast<int>(pos));
    }
    
    return positions;
}
