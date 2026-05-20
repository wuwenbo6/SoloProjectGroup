#include "MemoryStreamProcessor.h"

MemoryStreamProcessor::MemoryStreamProcessor(QObject* parent)
    : QObject(parent)
    , m_maxBufferSizeMB(64)
    , m_currentBufferSize(0)
    , m_processingMode(AdaptiveMode)
    , m_warningThreshold(50)
    , m_criticalThreshold(75)
    , m_emergencyThreshold(90)
    , m_droppedFrameCount(0)
    , m_processedFrameCount(0)
    , m_isRunning(false)
    , m_isPaused(false)
    , m_autoProcessTimer(new QTimer(this))
    , m_memoryCheckTimer(new QTimer(this))
    , m_autoProcessInterval(10)
    , m_memoryMonitoringEnabled(true)
    , m_peakMemoryUsage(0)
    , m_totalProcessingTime(0)
    , m_processingSampleCount(0)
    , m_currentWarningLevel(NormalLevel)
{
    connect(m_autoProcessTimer, &QTimer::timeout, this, &MemoryStreamProcessor::onAutoProcessTimer);
    connect(m_memoryCheckTimer, &QTimer::timeout, this, &MemoryStreamProcessor::checkMemoryUsage);
    
    m_memoryCheckTimer->start(500);
}

MemoryStreamProcessor::~MemoryStreamProcessor()
{
    stopProcessing();
    clearBuffer();
}

void MemoryStreamProcessor::setMaxBufferSize(int maxSizeMB)
{
    QMutexLocker locker(&m_mutex);
    m_maxBufferSizeMB = maxSizeMB;
}

int MemoryStreamProcessor::getMaxBufferSize() const
{
    return m_maxBufferSizeMB;
}

void MemoryStreamProcessor::setProcessingMode(ProcessingMode mode)
{
    QMutexLocker locker(&m_mutex);
    m_processingMode = mode;
}

MemoryStreamProcessor::ProcessingMode MemoryStreamProcessor::getProcessingMode() const
{
    return m_processingMode;
}

void MemoryStreamProcessor::setWarningThresholds(int warningPercent, int criticalPercent, int emergencyPercent)
{
    QMutexLocker locker(&m_mutex);
    m_warningThreshold = warningPercent;
    m_criticalThreshold = criticalPercent;
    m_emergencyThreshold = emergencyPercent;
}

bool MemoryStreamProcessor::pushData(const QByteArray& data, int frameType)
{
    QMutexLocker locker(&m_mutex);
    
    int dataSize = data.size();
    int maxBytes = m_maxBufferSizeMB * 1024 * 1024;
    
    if (m_currentBufferSize + dataSize > maxBytes) {
        int droppedCount = 0;
        
        switch (m_processingMode) {
            case DropOldestMode:
                while (m_currentBufferSize + dataSize > maxBytes && !m_buffer.isEmpty()) {
                    dropOldestFrames(1);
                    droppedCount++;
                }
                break;
                
            case DropNewestMode:
                if (m_currentBufferSize + dataSize > maxBytes) {
                    m_droppedFrameCount++;
                    droppedCount = 1;
                    emit framesDropped(droppedCount);
                    return false;
                }
                break;
                
            case BlockProducerMode:
                return false;
                
            case AdaptiveMode:
                dropOldestFrames(qMax(1, m_buffer.size() / 4));
                droppedCount = m_buffer.size() / 4;
                break;
        }
        
        if (droppedCount > 0) {
            emit framesDropped(droppedCount);
        }
    }
    
    DataFrame frame;
    frame.timestamp = QDateTime::currentMSecsSinceEpoch();
    frame.data = data;
    frame.frameType = frameType;
    frame.size = dataSize;
    
    m_buffer.append(frame);
    m_currentBufferSize += dataSize;
    
    if (m_currentBufferSize > m_peakMemoryUsage) {
        m_peakMemoryUsage = m_currentBufferSize;
    }
    
    m_bufferNotEmpty.wakeOne();
    return true;
}

QByteArray MemoryStreamProcessor::popData(int timeoutMs)
{
    DataFrame frame = popFrame(timeoutMs);
    return frame.data;
}

DataFrame MemoryStreamProcessor::popFrame(int timeoutMs)
{
    QMutexLocker locker(&m_mutex);
    
    if (m_buffer.isEmpty() && timeoutMs != 0) {
        if (timeoutMs < 0) {
            m_bufferNotEmpty.wait(&m_mutex);
        } else {
            m_bufferNotEmpty.wait(&m_mutex, timeoutMs);
        }
    }
    
    if (m_buffer.isEmpty()) {
        return DataFrame();
    }
    
    DataFrame frame = m_buffer.takeFirst();
    m_currentBufferSize -= frame.size;
    m_processedFrameCount++;
    
    return frame;
}

void MemoryStreamProcessor::startProcessing()
{
    m_isRunning = true;
    m_isPaused = false;
    m_autoProcessTimer->start(m_autoProcessInterval);
}

void MemoryStreamProcessor::stopProcessing()
{
    m_isRunning = false;
    m_autoProcessTimer->stop();
    m_bufferNotEmpty.wakeAll();
}

void MemoryStreamProcessor::pauseProcessing()
{
    m_isPaused = true;
}

void MemoryStreamProcessor::resumeProcessing()
{
    m_isPaused = false;
}

int MemoryStreamProcessor::getCurrentBufferSize() const
{
    QMutexLocker locker(&m_mutex);
    return m_currentBufferSize;
}

int MemoryStreamProcessor::getFrameCount() const
{
    QMutexLocker locker(&m_mutex);
    return m_buffer.size();
}

int MemoryStreamProcessor::getDroppedFrameCount() const
{
    return m_droppedFrameCount.load();
}

int MemoryStreamProcessor::getProcessedFrameCount() const
{
    return m_processedFrameCount.load();
}

MemoryStreamProcessor::MemoryWarningLevel MemoryStreamProcessor::getCurrentWarningLevel() const
{
    return m_currentWarningLevel;
}

float MemoryStreamProcessor::getMemoryUsagePercent() const
{
    QMutexLocker locker(&m_mutex);
    int maxBytes = m_maxBufferSizeMB * 1024 * 1024;
    return (maxBytes > 0) ? (m_currentBufferSize * 100.0f / maxBytes) : 0.0f;
}

void MemoryStreamProcessor::clearBuffer()
{
    QMutexLocker locker(&m_mutex);
    m_buffer.clear();
    m_currentBufferSize = 0;
}

void MemoryStreamProcessor::resetStatistics()
{
    QMutexLocker locker(&m_mutex);
    m_droppedFrameCount = 0;
    m_processedFrameCount = 0;
    m_peakMemoryUsage = 0;
    m_totalProcessingTime = 0;
    m_processingSampleCount = 0;
}

void MemoryStreamProcessor::setAutoProcessInterval(int ms)
{
    m_autoProcessInterval = ms;
    if (m_autoProcessTimer->isActive()) {
        m_autoProcessTimer->start(m_autoProcessInterval);
    }
}

void MemoryStreamProcessor::enableMemoryMonitoring(bool enabled)
{
    m_memoryMonitoringEnabled = enabled;
    if (enabled) {
        m_memoryCheckTimer->start(500);
    } else {
        m_memoryCheckTimer->stop();
    }
}

qint64 MemoryStreamProcessor::getPeakMemoryUsage() const
{
    return m_peakMemoryUsage;
}

qint64 MemoryStreamProcessor::getAverageProcessingTime() const
{
    return m_processingSampleCount > 0 ? m_totalProcessingTime / m_processingSampleCount : 0;
}

void MemoryStreamProcessor::onAutoProcessTimer()
{
    if (!m_isRunning || m_isPaused) return;
    processNextFrame();
}

void MemoryStreamProcessor::checkMemoryUsage()
{
    if (!m_memoryMonitoringEnabled) return;
    
    float usagePercent = getMemoryUsagePercent();
    MemoryWarningLevel newLevel = NormalLevel;
    
    if (usagePercent >= m_emergencyThreshold) {
        newLevel = EmergencyLevel;
    } else if (usagePercent >= m_criticalThreshold) {
        newLevel = CriticalLevel;
    } else if (usagePercent >= m_warningThreshold) {
        newLevel = WarningLevel;
    }
    
    if (newLevel != m_currentWarningLevel) {
        m_currentWarningLevel = newLevel;
        emit bufferStateChanged(newLevel);
        
        if (newLevel >= WarningLevel) {
            emit memoryUsageWarning(static_cast<int>(usagePercent));
            
            if (newLevel >= CriticalLevel) {
                qWarning() << "[MemoryStreamProcessor] Memory usage at critical level:" 
                           << static_cast<int>(usagePercent) << "%";
            }
        }
    }
    
    emit processingStatsUpdated(m_processedFrameCount.load(), 
                                m_droppedFrameCount.load(), 
                                m_buffer.size());
}

void MemoryStreamProcessor::dropOldestFrames(int count)
{
    for (int i = 0; i < count && !m_buffer.isEmpty(); i++) {
        DataFrame frame = m_buffer.takeFirst();
        m_currentBufferSize -= frame.size;
        m_droppedFrameCount++;
    }
}

void MemoryStreamProcessor::dropNewestFrames(int count)
{
    for (int i = 0; i < count && !m_buffer.isEmpty(); i++) {
        DataFrame frame = m_buffer.takeLast();
        m_currentBufferSize -= frame.size;
        m_droppedFrameCount++;
    }
}

void MemoryStreamProcessor::processNextFrame()
{
    QElapsedTimer timer;
    timer.start();
    
    DataFrame frame = popFrame(0);
    if (frame.size > 0) {
        emit frameProcessed(frame);
        
        qint64 elapsed = timer.elapsed();
        m_totalProcessingTime += elapsed;
        m_processingSampleCount++;
    }
}

void MemoryStreamProcessor::updateMemoryStats()
{
}
