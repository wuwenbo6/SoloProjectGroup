#ifndef TRANSCODEMANAGER_H
#define TRANSCODEMANAGER_H

#include <QObject>
#include <QStringList>
#include <QProcess>
#include <QVector>
#include <QMap>

struct TranscodeProfile {
    QString profileId;
    QString name;
    QString containerFormat;
    QString videoCodec;
    QString audioCodec;
    int videoBitrateKbps;
    int audioBitrateKbps;
    int width;
    int height;
    float fps;
    QString preset;
    QString additionalArgs;
    bool useHardwareAccel;
};

struct TranscodeTask {
    QString taskId;
    QString sourceFile;
    QString outputFile;
    QString profileId;
    QString status;
    int progressPercent;
    qint64 startTimeMs;
    qint64 endTimeMs;
    QString errorMessage;
    qint64 fileSize;
    qint64 outputFileSize;
};

class TranscodeManager : public QObject
{
    Q_OBJECT
public:
    enum TranscodeStatus {
        Idle,
        Running,
        Paused,
        Completed,
        Failed
    };
    
    explicit TranscodeManager(QObject *parent = nullptr);
    
    QString addTask(const QString& sourceFile, const QString& outputFile, const QString& profileId);
    void startBatch();
    void pauseBatch();
    void resumeBatch();
    void cancelBatch();
    void clearCompleted();
    
    void setFFmpegPath(const QString& path);
    QString getFFmpegPath() const;
    bool checkFFmpegAvailable();
    
    QList<TranscodeProfile> getAvailableProfiles() const;
    TranscodeProfile getProfile(const QString& profileId) const;
    void addCustomProfile(const TranscodeProfile& profile);
    
    QList<TranscodeTask> getTasks() const;
    TranscodeTask getTask(const QString& taskId) const;
    
    int getTotalProgress() const;
    int getCompletedCount() const;
    int getFailedCount() const;
    
    static QMap<QString, QString> getSupportedFormats() const;

signals:
    void taskStarted(const QString& taskId);
    void taskProgress(const QString& taskId, int percent);
    void taskCompleted(const QString& taskId);
    void taskFailed(const QString& taskId, const QString& error);
    void batchStarted();
    void batchProgress(int overallPercent);
    void batchCompleted();
    void batchFailed(const QString& error);
    void ffmpegNotFound();

private slots:
    void processNextTask();
    void onProcessReadyRead();
    void onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onProcessErrorOccurred(QProcess::ProcessError error);
    void parseFFmpegProgress(const QString& output);
    void cleanupProcess();

private:
    QString buildFFmpegCommand(const TranscodeTask& task, const TranscodeProfile& profile);
    QString findFFmpegExecutable();
    void updateTaskStatus(const QString& taskId, const QString& status);
    
    QList<TranscodeTask> m_tasks;
    QMap<QString, TranscodeProfile> m_profiles;
    
    QProcess* m_currentProcess;
    QString m_currentTaskId;
    QString m_ffmpegPath;
    
    bool m_isPaused;
    bool m_isCancelled;
    qint64 m_totalDurationMs;
    int m_completedCount;
    int m_failedCount;
    
    void initDefaultProfiles();
};

#endif
