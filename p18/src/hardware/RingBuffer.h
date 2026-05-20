#ifndef RINGBUFFER_H
#define RINGBUFFER_H

#include <QObject>
#include <QByteArray>
#include <QMutex>
#include <QWaitCondition>
#include <QAtomicInt>
#include <QElapsedTimer>
#include <QVector>

struct BufferStats {
    qint64 totalBytesWritten;
    qint64 totalBytesRead;
    qint64 peakMemoryUsage;
    float averageLatencyMs;
    int overrunCount;
    int underrunCount;
    float currentFillPercent;
};

class RingBuffer : public QObject
{
    Q_OBJECT
public:
    enum BufferMode {
        BlockingMode,
        OverwriteMode,
        DropNewestMode
    };
    
    explicit RingBuffer(QObject *parent = nullptr, int capacity = 1024 * 1024 * 16);
    ~RingBuffer();
    
    qint64 write(const QByteArray& data, int timeoutMs = -1);
    qint64 write(const char* data, qint64 size, int timeoutMs = -1);
    
    QByteArray read(qint64 maxSize, int timeoutMs = -1);
    qint64 read(char* buffer, qint64 maxSize, int timeoutMs = -1);
    
    QByteArray peek(qint64 maxSize) const;
    
    qint64 bytesAvailable() const;
    qint64 bytesFree() const;
    qint64 capacity() const { return m_capacity; }
    
    void setBufferMode(BufferMode mode);
    BufferMode bufferMode() const { return m_mode; }
    
    void clear();
    void reset();
    
    bool isEmpty() const;
    bool isFull() const;
    
    BufferStats statistics() const;
    void resetStatistics();
    
    void setLatencyMonitoring(bool enabled);
    bool isLatencyMonitoringEnabled() const { return m_monitorLatency; }
    
    qint64 optimalTransferSize() const;
    
signals:
    void bufferFull();
    void bufferEmpty();
    void bufferOverrun();
    void bufferUnderrun();
    void highLatencyDetected(float latencyMs);
    void bufferReadyRead(int bytesAvailable);

private:
    qint64 writeInternal(const char* data, qint64 size);
    qint64 readInternal(char* buffer, qint64 maxSize);
    void updateLatencyStats(qint64 bytes);
    
    char* m_buffer;
    qint64 m_capacity;
    qint64 m_writeIndex;
    qint64 m_readIndex;
    QAtomicInt m_usedBytes;
    
    mutable QMutex m_mutex;
    QWaitCondition m_writeReady;
    QWaitCondition m_readReady;
    
    BufferMode m_mode;
    bool m_monitorLatency;
    
    mutable QMutex m_statsMutex;
    qint64 m_totalBytesWritten;
    qint64 m_totalBytesRead;
    qint64 m_peakMemoryUsage;
    QVector<float> m_latencySamples;
    int m_overrunCount;
    int m_underrunCount;
    
    QElapsedTimer m_lastWriteTimer;
    qint64 m_lastWriteSize;
};

#endif
