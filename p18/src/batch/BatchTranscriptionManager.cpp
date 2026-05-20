#include "BatchTranscriptionManager.h"
#include <QUuid>
#include <QDebug>

BatchTranscriptionManager::BatchTranscriptionManager(QObject *parent)
    : QObject(parent)
    , m_progressTimer(new QTimer(this))
    , m_archiveManager(nullptr)
    , m_isPaused(false)
    , m_isCancelled(false)
{
    connect(m_progressTimer, &QTimer::timeout, this, &BatchTranscriptionManager::updateTaskProgress);
    m_progressTimer->setInterval(500);
}

void BatchTranscriptionManager::setArchiveManager(MediaArchiveManager* manager)
{
    m_archiveManager = manager;
}

QString BatchTranscriptionManager::createBatch(const QString& batchName, const QList<TranscriptionTask>& tasks)
{
    QString batchId = QUuid::createUuid().toString();
    
    QList<TranscriptionTask> validatedTasks;
    for (const TranscriptionTask& t : tasks) {
        TranscriptionTask task = t;
        if (task.taskId.isEmpty()) {
            task.taskId = QUuid::createUuid().toString();
        }
        task.status = "pending";
        task.progressPercent = 0;
        task.createdTime = QDateTime::currentDateTime();
        validatedTasks.append(task);
    }
    
    m_batches[batchId] = validatedTasks;
    
    if (m_archiveManager) {
        BatchTranscriptionJob job;
        job.jobId = batchId;
        job.name = batchName;
        job.createdDate = QDateTime::currentDateTime();
        job.status = "created";
        job.totalItems = validatedTasks.size();
        job.completedItems = 0;
        for (const TranscriptionTask& task : validatedTasks) {
            job.tapeModelIds.append(task.tapeModelId);
        }
        m_archiveManager->createBatchJob(job);
    }
    
    return batchId;
}

void BatchTranscriptionManager::startBatch(const QString& batchId)
{
    if (!m_batches.contains(batchId)) {
        return;
    }
    
    m_currentBatchId = batchId;
    m_isPaused = false;
    m_isCancelled = false;
    
    emit batchStarted(batchId);
    
    if (m_archiveManager) {
        BatchTranscriptionJob job = m_archiveManager->getBatchJob(batchId);
        job.startedDate = QDateTime::currentDateTime();
        job.status = "running";
        m_archiveManager->updateBatchJob(job);
    }
    
    m_progressTimer->start();
    processNextTask();
}

void BatchTranscriptionManager::pauseBatch(const QString& batchId)
{
    if (m_currentBatchId == batchId) {
        m_isPaused = true;
        m_progressTimer->stop();
        emit batchPaused(batchId);
        
        if (m_archiveManager) {
            BatchTranscriptionJob job = m_archiveManager->getBatchJob(batchId);
            job.status = "paused";
            m_archiveManager->updateBatchJob(job);
        }
    }
}

void BatchTranscriptionManager::resumeBatch(const QString& batchId)
{
    if (m_currentBatchId == batchId && m_isPaused) {
        m_isPaused = false;
        m_progressTimer->start();
        emit batchStarted(batchId);
        
        if (m_archiveManager) {
            BatchTranscriptionJob job = m_archiveManager->getBatchJob(batchId);
            job.status = "running";
            m_archiveManager->updateBatchJob(job);
        }
    }
}

void BatchTranscriptionManager::cancelBatch(const QString& batchId)
{
    m_isCancelled = true;
    m_progressTimer->stop();
    emit batchCancelled(batchId);
    
    if (m_archiveManager) {
        BatchTranscriptionJob job = m_archiveManager->getBatchJob(batchId);
        job.status = "cancelled";
        m_archiveManager->updateBatchJob(job);
    }
}

QList<TranscriptionTask> BatchTranscriptionManager::getBatchTasks(const QString& batchId) const
{
    return m_batches.value(batchId);
}

int BatchTranscriptionManager::getBatchProgress(const QString& batchId) const
{
    if (!m_batches.contains(batchId)) {
        return 0;
    }
    
    const QList<TranscriptionTask>& tasks = m_batches[batchId];
    if (tasks.isEmpty()) {
        return 0;
    }
    
    int totalProgress = 0;
    for (const TranscriptionTask& task : tasks) {
        totalProgress += task.progressPercent;
    }
    
    return totalProgress / tasks.size();
}

bool BatchTranscriptionManager::isRunning() const
{
    return m_progressTimer->isActive();
}

void BatchTranscriptionManager::processNextTask()
{
    if (m_isPaused || m_isCancelled) {
        return;
    }
    
    QString nextTaskId = findNextPendingTask(m_currentBatchId);
    if (nextTaskId.isEmpty()) {
        m_progressTimer->stop();
        emit batchCompleted(m_currentBatchId);
        
        if (m_archiveManager) {
            BatchTranscriptionJob job = m_archiveManager->getBatchJob(m_currentBatchId);
            job.status = "completed";
            job.completedDate = QDateTime::currentDateTime();
            m_archiveManager->updateBatchJob(job);
        }
        
        return;
    }
    
    m_currentTaskId = nextTaskId;
    
    QList<TranscriptionTask>& tasks = m_batches[m_currentBatchId];
    for (int i = 0; i < tasks.size(); i++) {
        if (tasks[i].taskId == nextTaskId) {
            tasks[i].status = "running";
            tasks[i].startedTime = QDateTime::currentDateTime();
            emit taskStarted(nextTaskId);
            break;
        }
    }
}

void BatchTranscriptionManager::updateTaskProgress()
{
    if (m_currentTaskId.isEmpty() || m_isPaused || m_isCancelled) {
        return;
    }
    
    QList<TranscriptionTask>& tasks = m_batches[m_currentBatchId];
    for (int i = 0; i < tasks.size(); i++) {
        if (tasks[i].taskId == m_currentTaskId) {
            tasks[i].progressPercent += 2;
            
            emit taskProgress(m_currentTaskId, tasks[i].progressPercent);
            emit batchProgress(m_currentBatchId, getBatchProgress(m_currentBatchId));
            
            if (tasks[i].progressPercent >= 100) {
                completeTask(m_currentTaskId, true);
            }
            break;
        }
    }
}

QString BatchTranscriptionManager::findNextPendingTask(const QString& batchId)
{
    if (!m_batches.contains(batchId)) {
        return QString();
    }
    
    const QList<TranscriptionTask>& tasks = m_batches[batchId];
    for (const TranscriptionTask& task : tasks) {
        if (task.status == "pending") {
            return task.taskId;
        }
    }
    
    return QString();
}

void BatchTranscriptionManager::completeTask(const QString& taskId, bool success)
{
    QList<TranscriptionTask>& tasks = m_batches[m_currentBatchId];
    for (int i = 0; i < tasks.size(); i++) {
        if (tasks[i].taskId == taskId) {
            tasks[i].status = success ? "completed" : "error";
            tasks[i].completedTime = QDateTime::currentDateTime();
            tasks[i].progressPercent = 100;
            emit taskCompleted(taskId);
            
            if (m_archiveManager) {
                MediaArchiveEntry entry;
                entry.tapeName = tasks[i].tapeName;
                entry.tapeModelId = tasks[i].tapeModelId;
                entry.digitizationDate = QDateTime::currentDateTime();
                entry.outputFilePath = tasks[i].outputPath;
                entry.durationSeconds = 3600;
                entry.fileSize = 1024 * 1024 * 500;
                m_archiveManager->addArchiveEntry(entry);
                
                BatchTranscriptionJob job = m_archiveManager->getBatchJob(m_currentBatchId);
                job.completedItems++;
                m_archiveManager->updateBatchJob(job);
            }
            
            break;
        }
    }
    
    m_currentTaskId.clear();
    processNextTask();
}
