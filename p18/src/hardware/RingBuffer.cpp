#include "RingBuffer.h"
#include <QtMath>
#include <QDebug>
#include <cstring>

RingBuffer::RingBuffer(QObject *parent, int capacity)
    : QObject(parent)
    , m_capacity(capacity)
    , m_writeIndex(0)
    , m_readIndex(0)
    , m_usedBytes(0)
    , m_mode(OverwriteMode)
    , m_monitorLatency(true)
    , m_totalBytesWritten(0)
    , m_totalBytesRead(0)
    , m_peakMemoryUsage(0)
    , m_overrunCount(0)
    , m_underrunCount(0)
    , m_lastWriteSize(0)
{
    m_buffer = new char[capacity];
    m_lastWriteTimer.start();
}

RingBuffer::~RingBuffer()
{
    delete[] m_buffer;
}

qint64 RingBuffer::write(const QByteArray& data, int timeoutMs)
{
    return write(data.constData(), data.size(), timeoutMs);
}

qint64 RingBuffer::write(const char* data, qint64 size, int timeoutMs)
{
    if (size <= 0) return 0;
    
    QMutexLocker locker(&m_mutex);
    
    qint64 freeSpace = m_capacity - m_usedBytes.loadAcquire();
    
    if (freeSpace < size) {
        switch (m_mode) {
            case BlockingMode:
                if (timeoutMs == 0) {
                    return 0;
                }
                while (freeSpace < size) {
                    if (!m_writeReady.wait(&m_mutex, timeoutMs)) {
                        return 0;
                    }
                    freeSpace = m_capacity - m_usedBytes.loadAcquire();
                }
                break;
                
            case OverwriteMode:
                m_readIndex = (m_readIndex + size - freeSpace) % m_capacity;
                m_usedBytes.fetchAndStoreOrdered(m_capacity - size + freeSpace);
                m_overrunCount++;
                emit bufferOverrun();
                break;
                
            case DropNewestMode:
                return 0;
        }
    }
    
    qint64 bytesWritten = writeInternal(data, size);
    
    if (m_monitorLatency) {
        updateLatencyStats(bytesWritten);
    }
    
    {
        QMutexLocker statsLocker(&m_statsMutex);
        m_totalBytesWritten += bytesWritten;
        qint64 currentUsage = m_usedBytes.loadAcquire();
        if (currentUsage > m_peakMemoryUsage) {
            m_peakMemoryUsage = currentUsage;
        }
    }
    
    m_readReady.wakeAll();
    emit bufferReadyRead(bytesAvailable());
    
    return bytesWritten;
}

QByteArray RingBuffer::read(qint64 maxSize, int timeoutMs)
{
    QByteArray result(maxSize, 0);
    qint64 bytesRead = read(result.data(), maxSize, timeoutMs);
    if (bytesRead < maxSize) {
        result.truncate(bytesRead);
    }
    return result;
}

qint64 RingBuffer::read(char* buffer, qint64 maxSize, int timeoutMs)
{
    if (maxSize <= 0) return 0;
    
    QMutexLocker locker(&m_mutex);
    
    qint64 available = m_usedBytes.loadAcquire();
    
    if (available == 0) {
        if (timeoutMs == 0) {
            return 0;
        }
        if (!m_readReady.wait(&m_mutex, timeoutMs)) {
            m_underrunCount++;
            emit bufferUnderrun();
            return 0;
        }
        available = m_usedBytes.loadAcquire();
    }
    
    qint64 toRead = qMin(available, maxSize);
    qint64 bytesRead = readInternal(buffer, toRead);
    
    {
        QMutexLocker statsLocker(&m_statsMutex);
        m_totalBytesRead += bytesRead;
    }
    
    m_writeReady.wakeAll();
    
    return bytesRead;
}

QByteArray RingBuffer::peek(qint64 maxSize) const
{
    QMutexLocker locker(&m_mutex);
    
    qint64 available = m_usedBytes.loadAcquire();
    qint64 toRead = qMin(available, maxSize);
    
    QByteArray result(toRead, 0);
    
    qint64 firstChunk = qMin(toRead, m_capacity - m_readIndex);
    std::memcpy(result.data(), m_buffer + m_readIndex, static_cast<size_t>(firstChunk));
    
    if (toRead > firstChunk) {
        qint64 secondChunk = toRead - firstChunk;
        std::memcpy(result.data() + firstChunk, m_buffer, static_cast<size_t>(secondChunk));
    }
    
    return result;
}

qint64 RingBuffer::writeInternal(const char* data, qint64 size)
{
    qint64 firstChunk = qMin(size, m_capacity - m_writeIndex);
    std::memcpy(m_buffer + m_writeIndex, data, static_cast<size_t>(firstChunk));
    
    if (size > firstChunk) {
        qint64 secondChunk = size - firstChunk;
        std::memcpy(m_buffer, data + firstChunk, static_cast<size_t>(secondChunk));
    }
    
    m_writeIndex = (m_writeIndex + size) % m_capacity;
    m_usedBytes.fetchAndAddOrdered(static_cast<int>(size));
    
    return size;
}

qint64 RingBuffer::readInternal(char* buffer, qint64 maxSize)
{
    qint64 firstChunk = qMin(maxSize, m_capacity - m_readIndex);
    std::memcpy(buffer, m_buffer + m_readIndex, static_cast<size_t>(firstChunk));
    
    if (maxSize > firstChunk) {
        qint64 secondChunk = maxSize - firstChunk;
        std::memcpy(buffer + firstChunk, m_buffer, static_cast<size_t>(secondChunk));
    }
    
    m_readIndex = (m_readIndex + maxSize) % m_capacity;
    m_usedBytes.fetchAndSubOrdered(static_cast<int>(maxSize));
    
    return maxSize;
}

void RingBuffer::updateLatencyStats(qint64 bytes)
{
    qint64 elapsed = m_lastWriteTimer.nsecsElapsed();
    
    if (m_lastWriteSize > 0) {
        float bandwidth = (m_lastWriteSize * 1.0e9f) / elapsed;
        float transferTimeMs = (bytes * 1000.0f) / bandwidth;
        
        {
            QMutexLocker statsLocker(&m_statsMutex);
            m_latencySamples.append(transferTimeMs);
            
            while (m_latencySamples.size() > 1000) {
                m_latencySamples.removeFirst();
            }
            
            if (transferTimeMs > 50.0f) {
                emit highLatencyDetected(transferTimeMs);
            }
        }
    }
    
    m_lastWriteTimer.restart();
    m_lastWriteSize = bytes;
}

qint64 RingBuffer::bytesAvailable() const
{
    return m_usedBytes.loadAcquire();
}

qint64 RingBuffer::bytesFree() const
{
    return m_capacity - m_usedBytes.loadAcquire();
}

bool RingBuffer::isEmpty() const
{
    return m_usedBytes.loadAcquire() == 0;
}

bool RingBuffer::isFull() const
{
    return m_usedBytes.loadAcquire() == m_capacity;
}

void RingBuffer::clear()
{
    QMutexLocker locker(&m_mutex);
    m_writeIndex = 0;
    m_readIndex = 0;
    m_usedBytes = 0;
}

void RingBuffer::reset()
{
    clear();
    resetStatistics();
}

void RingBuffer::setBufferMode(BufferMode mode)
{
    QMutexLocker locker(&m_mutex);
    m_mode = mode;
}

BufferStats RingBuffer::statistics() const
{
    QMutexLocker locker(&m_statsMutex);
    
    BufferStats stats;
    stats.totalBytesWritten = m_totalBytesWritten;
    stats.totalBytesRead = m_totalBytesRead;
    stats.peakMemoryUsage = m_peakMemoryUsage;
    stats.overrunCount = m_overrunCount;
    stats.underrunCount = m_underrunCount;
    stats.currentFillPercent = (m_usedBytes.loadAcquire() * 100.0f) / m_capacity;
    
    float sum = 0.0f;
    for (float sample : m_latencySamples) {
        sum += sample;
    }
    stats.averageLatencyMs = m_latencySamples.isEmpty() ? 0.0f : sum / m_latencySamples.size();
    
    return stats;
}

void RingBuffer::resetStatistics()
{
    QMutexLocker locker(&m_statsMutex);
    m_totalBytesWritten = 0;
    m_totalBytesRead = 0;
    m_peakMemoryUsage = 0;
    m_overrunCount = 0;
    m_underrunCount = 0;
    m_latencySamples.clear();
}

void RingBuffer::setLatencyMonitoring(bool enabled)
{
    QMutexLocker locker(&m_statsMutex);
    m_monitorLatency = enabled;
}

qint64 RingBuffer::optimalTransferSize() const
{
    qint64 pageSize = 4096;
    qint64 optimal = qSqrt(m_capacity * 0.1f);
    optimal = ((optimal + pageSize - 1) / pageSize) * pageSize;
    return qMax(pageSize, optimal);
}
