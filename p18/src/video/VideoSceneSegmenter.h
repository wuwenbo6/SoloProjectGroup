#ifndef VIDEOSCENESEGMENTER_H
#define VIDEOSCENESEGMENTER_H

#include <QObject>
#include <QImage>
#include <QVector>
#include <QDateTime>

struct SceneSegment {
    qint64 startTimeMs;
    qint64 endTimeMs;
    float sceneChangeScore;
    float averageBrightness;
    float averageContrast;
    float motionLevel;
    bool isBlackFrame;
    bool isHighMotion;
    QString segmentId;
    QImage thumbnail;
};

struct AudioMarker {
    qint64 timeMs;
    float volumeLevel;
    float zeroCrossRate;
    bool isSilence;
    bool isLoudPeak;
};

class VideoSceneSegmenter : public QObject
{
    Q_OBJECT
public:
    enum DetectionMode {
        SceneChangeOnly,
        AudioVideoCombined,
        SceneChangeWithMotion,
        IntelligentAuto
    };
    
    explicit VideoSceneSegmenter(QObject *parent = nullptr);
    
    void setDetectionMode(DetectionMode mode);
    void setSensitivity(float sensitivity);
    void setMinSegmentDuration(int ms);
    void setMaxSegmentDuration(int ms);
    
    void processFrame(const QImage& frame, qint64 timestampMs);
    void processAudioLevel(float rmsLevel, float zcr, qint64 timestampMs);
    
    QList<SceneSegment> getDetectedSegments() const;
    QList<SceneSegment> getManualSegments() const;
    void addManualSegment(qint64 startMs, qint64 endMs);
    
    void reset();
    void finalizeDetection();
    
    float getSceneChangeThreshold() const;
    float calculateFrameSimilarity(const QImage& frame1, const QImage& frame2);
    
    static QList<int> getKeyframePositions(const SceneSegment& segment, int keyframeCount = 3);

signals:
    void sceneDetected(const SceneSegment& segment);
    void sceneChangeDetected(qint64 timestampMs, float score);
    void blackFrameDetected(qint64 timestampMs);
    void silenceDetected(qint64 startMs, qint64 endMs);

private:
    bool detectSceneChange(const QImage& currentFrame);
    bool detectBlackFrame(const QImage& frame);
    void updateMotionDetection(const QImage& currentFrame);
    void checkSegmentBoundaries(qint64 timestampMs);
    void finalizeCurrentSegment(qint64 endTimestamp);
    
    QImage m_prevFrame;
    QVector<float> m_frameDifferenceHistory;
    QVector<AudioMarker> m_audioMarkers;
    QList<SceneSegment> m_detectedSegments;
    QList<SceneSegment> m_manualSegments;
    
    SceneSegment m_currentSegment;
    qint64 m_segmentStartTime;
    qint64 m_lastSceneChangeTime;
    int m_frameCount;
    
    DetectionMode m_detectionMode;
    float m_sensitivity;
    int m_minSegmentDurationMs;
    int m_maxSegmentDurationMs;
    float m_sceneChangeThreshold;
    
    float m_averageBrightness;
    int m_brightnessSampleCount;
    
    bool m_inSilence;
    qint64 m_silenceStartMs;
    int m_consecutiveSimilarFrames;
};

#endif
