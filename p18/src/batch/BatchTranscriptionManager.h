#ifndef BATCHTRANSCRIPTIONMANAGER_H
#define BATCHTRANSCRIPTIONMANAGER_H

#include <QObject>
#include <QTimer>
#include <QDateTime>
#include <QFileInfoList>
#include "../archive/MediaArchiveManager.h"

struct TranscriptionTask {
    QString taskId;
    QString tapeName;
    QString tapeModelId;
    QString inputPath;
    QString outputPath;
    QString status;
    int progressPercent;
    QString errorMessage;
    QDateTime createdTime;
    QDateTime startedTime;
    QDateTime completedTime;
};

class BatchTranscriptionManager : public QObject
{
    Q_OBJECT
public:
    explicit BatchTranscriptionManager(QObject *parent = nullptr);
    
    void setArchiveManager(MediaArchiveManager* manager);
    
    QString createBatch(const QString& batchName, const QList<TranscriptionTask>& tasks);
    void startBatch(const QString& batchId);
    void pauseBatch(const QString& batchId);
    void resumeBatch(const QString& batchId);
    void cancelBatch(const QString& batchId);
    
    QList<TranscriptionTask> getBatchTasks(const QString& batchId) const;
    int getBatchProgress(const QString& batchId) const;
    
    bool isRunning() const;

signals:
    void batchStarted(const QString& batchId);
    void batchProgress(const QString& batchId, int percentComplete);
    void batchCompleted(const QString& batchId);
    void batchPaused(const QString& batchId);
    void batchCancelled(const QString& batchId);
    void taskStarted(const QString& taskId);
    void taskProgress(const QString& taskId, int percent);
    void taskCompleted(const QString& taskId);
    void taskError(const QString& taskId, const QString& error);

private slots:
    void processNextTask();
    void updateTaskProgress();

private:
    QString findNextPendingTask(const QString& batchId);
    void completeTask(const QString& taskId, bool success);
    
    QMap<QString, QList<TranscriptionTask>> m_batches;
    QString m_currentBatchId;
    QString m_currentTaskId;
    QTimer* m_progressTimer;
    MediaArchiveManager* m_archiveManager;
    bool m_isPaused;
    bool m_isCancelled;
};

#endif
