#ifndef MEMORYSTREAMPROCESSOR_H
#define MEMORYSTREAMPROCESSOR_H

#include <QObject>
#include <QByteArray>
#include <QList>
#include <QMutex>
#include <QWaitCondition>
#include <QTimer>
#include <QElapsedTimer>
#include <QDebug>
#include <atomic>

struct DataFrame {
    qint64 timestamp;
    QByteArray data;
    int frameType;
    int size;
    
    DataFrame() : timestamp(0), frameType(0), size(0) {}
};

class MemoryStreamProcessor : public QObject
{
    Q_OBJECT
public:
    enum ProcessingMode {
        DropOldestMode,
        DropNewestMode,
        BlockProducerMode,
        AdaptiveMode
    };
    
    enum MemoryWarningLevel {
        NormalLevel,
        WarningLevel,
        CriticalLevel,
        EmergencyLevel
    };

    explicit MemoryStreamProcessor(QObject* parent = nullptr);
    ~MemoryStreamProcessor();

    void setMaxBufferSize(int maxSizeMB);
    int getMaxBufferSize() const;
    
    void setProcessingMode(ProcessingMode mode);
    ProcessingMode getProcessingMode() const;
    
    void setWarningThresholds(int warningPercent, int criticalPercent, int emergencyPercent);
    
    bool pushData(const QByteArray& data, int frameType = 0);
    QByteArray popData(int timeoutMs = -1);
    DataFrame popFrame(int timeoutMs = -1);
    
    void startProcessing();
    void stopProcessing();
    void pauseProcessing();
    void resumeProcessing();
    
    int getCurrentBufferSize() const;
    int getFrameCount() const;
    int getDroppedFrameCount() const;
    int getProcessedFrameCount() const;
    
    MemoryWarningLevel getCurrentWarningLevel() const;
    float getMemoryUsagePercent() const;
    
    void clearBuffer();
    void resetStatistics();
    
    void setAutoProcessInterval(int ms);
    void enableMemoryMonitoring(bool enabled);
    
    qint64 getPeakMemoryUsage() const;
    qint64 getAverageProcessingTime() const;

signals:
    void frameProcessed(const DataFrame& frame);
    void bufferStateChanged(MemoryWarningLevel level);
    void memoryUsageWarning(int percentUsed);
    void framesDropped(int count);
    void processingStatsUpdated(int processed, int dropped, int pending);

private slots:
    void onAutoProcessTimer();
    void checkMemoryUsage();

private:
    void dropOldestFrames(int count);
    void dropNewestFrames(int count);
    void processNextFrame();
    void updateMemoryStats();
    
    QList<DataFrame> m_buffer;
    mutable QMutex m_mutex;
    QWaitCondition m_bufferNotEmpty;
    
    int m_maxBufferSizeMB;
    int m_currentBufferSize;
    ProcessingMode m_processingMode;
    
    int m_warningThreshold;
    int m_criticalThreshold;
    int m_emergencyThreshold;
    
    std::atomic<int> m_droppedFrameCount;
    std::atomic<int> m_processedFrameCount;
    
    bool m_isRunning;
    bool m_isPaused;
    
    QTimer* m_autoProcessTimer;
    QTimer* m_memoryCheckTimer;
    int m_autoProcessInterval;
    bool m_memoryMonitoringEnabled;
    
    qint64 m_peakMemoryUsage;
    qint64 m_totalProcessingTime;
    int m_processingSampleCount;
    
    MemoryWarningLevel m_currentWarningLevel;
};

#endif
