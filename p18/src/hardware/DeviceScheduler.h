#ifndef DEVICESCHEDULER_H
#define DEVICESCHEDULER_H

#include <QObject>
#include <QString>
#include <QList>
#include <QMap>
#include <QDateTime>
#include <QMutex>

struct TranscriptionDevice {
    QString deviceId;
    QString deviceName;
    QString deviceType;
    QString serialNumber;
    QString firmwareVersion;
    QString connectionType;
    QString portName;
    
    bool isConnected;
    bool isBusy;
    bool isEnabled;
    
    int currentJobId;
    float currentProgress;
    QString currentStatus;
    
    int totalJobsCompleted;
    int totalJobsFailed;
    qint64 totalRecordingTimeMs;
    
    QDateTime lastSeenTime;
    QDateTime lastJobStartTime;
    QDateTime lastJobCompleteTime;
    
    int priority;
    int maxConcurrentJobs;
    
    QMap<QString, QVariant> capabilities;
    
    TranscriptionDevice()
        : isConnected(false)
        , isBusy(false)
        , isEnabled(true)
        , currentJobId(-1)
        , currentProgress(0.0f)
        , totalJobsCompleted(0)
        , totalJobsFailed(0)
        , totalRecordingTimeMs(0)
        , priority(0)
        , maxConcurrentJobs(1)
    {}
};

struct ScheduledJob {
    int jobId;
    QString name;
    QString tapeModelId;
    QString outputPath;
    QDateTime scheduledTime;
    QDateTime startTime;
    QDateTime completeTime;
    
    QString status;
    float progress;
    QString assignedDeviceId;
    
    int priority;
    int retryCount;
    int maxRetries;
    
    QMap<QString, QVariant> jobParameters;
    
    ScheduledJob()
        : jobId(-1)
        , progress(0.0f)
        , priority(0)
        , retryCount(0)
        , maxRetries(3)
    {}
};

struct DeviceLoadBalanceConfig {
    bool enableLoadBalancing;
    bool prioritizeIdleDevices;
    bool distributeByPriority;
    int maxQueueSize;
    float maxDeviceLoadThreshold;
    
    DeviceLoadBalanceConfig()
        : enableLoadBalancing(true)
        , prioritizeIdleDevices(true)
        , distributeByPriority(true)
        , maxQueueSize(100)
        , maxDeviceLoadThreshold(0.9f)
    {}
};

class DeviceScheduler : public QObject
{
    Q_OBJECT
public:
    enum ScheduleMode {
        ManualMode,
        AutoMode,
        PriorityMode,
        LoadBalanceMode
    };
    
    explicit DeviceScheduler(QObject *parent = nullptr);
    ~DeviceScheduler();
    
    void setScheduleMode(ScheduleMode mode);
    ScheduleMode getScheduleMode() const;
    
    void setLoadBalanceConfig(const DeviceLoadBalanceConfig& config);
    DeviceLoadBalanceConfig getLoadBalanceConfig() const;
    
    QString registerDevice(const TranscriptionDevice& device);
    bool unregisterDevice(const QString& deviceId);
    bool updateDeviceStatus(const TranscriptionDevice& device);
    TranscriptionDevice getDevice(const QString& deviceId) const;
    QList<TranscriptionDevice> getAllDevices() const;
    QList<TranscriptionDevice> getAvailableDevices() const;
    QList<TranscriptionDevice> getBusyDevices() const;
    
    int createJob(const ScheduledJob& job);
    bool cancelJob(int jobId);
    bool pauseJob(int jobId);
    bool resumeJob(int jobId);
    ScheduledJob getJob(int jobId) const;
    QList<ScheduledJob> getAllJobs() const;
    QList<ScheduledJob> getPendingJobs() const;
    QList<ScheduledJob> getRunningJobs() const;
    
    bool assignJobToDevice(int jobId, const QString& deviceId);
    QString findBestDeviceForJob(const ScheduledJob& job) const;
    
    void startScheduler();
    void stopScheduler();
    void pauseScheduler();
    void resumeScheduler();
    
    bool isSchedulerRunning() const;
    int getPendingJobCount() const;
    int getRunningJobCount() const;
    int getAvailableDeviceCount() const;
    
    float getOverallSystemLoad() const;
    float getDeviceLoad(const QString& deviceId) const;
    
    void clearCompletedJobs();
    void resetDeviceStatistics();
    
    bool exportSchedule(const QString& filePath);
    bool importSchedule(const QString& filePath);

signals:
    void deviceRegistered(const QString& deviceId);
    void deviceUnregistered(const QString& deviceId);
    void deviceStatusChanged(const QString& deviceId);
    void deviceConnected(const QString& deviceId);
    void deviceDisconnected(const QString& deviceId);
    
    void jobCreated(int jobId);
    void jobStarted(int jobId, const QString& deviceId);
    void jobProgress(int jobId, float progress);
    void jobCompleted(int jobId);
    void jobFailed(int jobId, const QString& error);
    void jobCancelled(int jobId);
    void jobAssigned(int jobId, const QString& deviceId);
    
    void schedulerStarted();
    void schedulerStopped();
    void schedulerPaused();
    void schedulerResumed();
    
    void systemLoadChanged(float load);
    void schedulingError(const QString& errorMessage);

private slots:
    void onScheduleTick();
    void checkDeviceTimeouts();
    void processJobQueue();

private:
    bool canDeviceAcceptJob(const TranscriptionDevice& device, const ScheduledJob& job) const;
    void assignPendingJobs();
    void checkJobTimeouts();
    void retryFailedJobs();
    
    float calculateDeviceScore(const TranscriptionDevice& device, const ScheduledJob& job) const;
    
    ScheduleMode m_scheduleMode;
    DeviceLoadBalanceConfig m_loadBalanceConfig;
    
    QMap<QString, TranscriptionDevice> m_devices;
    QMap<int, ScheduledJob> m_jobs;
    
    QTimer* m_scheduleTimer;
    QMutex m_mutex;
    
    bool m_isRunning;
    bool m_isPaused;
    
    int m_nextJobId;
    int m_scheduleIntervalMs;
    
    QList<int> m_jobQueue;
    QMap<QString, QList<int>> m_deviceJobQueues;
};

#endif
