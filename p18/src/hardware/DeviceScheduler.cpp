#include "DeviceScheduler.h"
#include <QTimer>
#include <QUuid>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFile>
#include <QMutexLocker>

DeviceScheduler::DeviceScheduler(QObject *parent)
    : QObject(parent)
    , m_scheduleMode(LoadBalanceMode)
    , m_scheduleTimer(new QTimer(this))
    , m_isRunning(false)
    , m_isPaused(false)
    , m_nextJobId(1)
    , m_scheduleIntervalMs(1000)
{
    connect(m_scheduleTimer, &QTimer::timeout, this, &DeviceScheduler::onScheduleTick);
}

DeviceScheduler::~DeviceScheduler()
{
    stopScheduler();
}

void DeviceScheduler::setScheduleMode(ScheduleMode mode)
{
    m_scheduleMode = mode;
}

DeviceScheduler::ScheduleMode DeviceScheduler::getScheduleMode() const
{
    return m_scheduleMode;
}

void DeviceScheduler::setLoadBalanceConfig(const DeviceLoadBalanceConfig& config)
{
    m_loadBalanceConfig = config;
}

DeviceLoadBalanceConfig DeviceScheduler::getLoadBalanceConfig() const
{
    return m_loadBalanceConfig;
}

QString DeviceScheduler::registerDevice(const TranscriptionDevice& device)
{
    QMutexLocker locker(&m_mutex);
    
    QString deviceId = device.deviceId.isEmpty() ? QUuid::createUuid().toString() : device.deviceId;
    TranscriptionDevice newDevice = device;
    newDevice.deviceId = deviceId;
    newDevice.lastSeenTime = QDateTime::currentDateTime();
    
    m_devices[deviceId] = newDevice;
    m_deviceJobQueues[deviceId] = QList<int>();
    
    emit deviceRegistered(deviceId);
    if (newDevice.isConnected) {
        emit deviceConnected(deviceId);
    }
    
    return deviceId;
}

bool DeviceScheduler::unregisterDevice(const QString& deviceId)
{
    QMutexLocker locker(&m_mutex);
    
    if (!m_devices.contains(deviceId)) {
        return false;
    }
    
    TranscriptionDevice device = m_devices[deviceId];
    if (device.isBusy && device.currentJobId != -1) {
        ScheduledJob& job = m_jobs[device.currentJobId];
        job.status = "Cancelled";
        job.assignedDeviceId.clear();
        emit jobCancelled(job.jobId);
    }
    
    m_devices.remove(deviceId);
    m_deviceJobQueues.remove(deviceId);
    
    emit deviceUnregistered(deviceId);
    return true;
}

bool DeviceScheduler::updateDeviceStatus(const TranscriptionDevice& device)
{
    QMutexLocker locker(&m_mutex);
    
    if (!m_devices.contains(device.deviceId)) {
        return false;
    }
    
    bool wasConnected = m_devices[device.deviceId].isConnected;
    m_devices[device.deviceId] = device;
    m_devices[device.deviceId].lastSeenTime = QDateTime::currentDateTime();
    
    emit deviceStatusChanged(device.deviceId);
    
    if (device.isConnected && !wasConnected) {
        emit deviceConnected(device.deviceId);
    } else if (!device.isConnected && wasConnected) {
        emit deviceDisconnected(device.deviceId);
    }
    
    return true;
}

TranscriptionDevice DeviceScheduler::getDevice(const QString& deviceId) const
{
    return m_devices.value(deviceId);
}

QList<TranscriptionDevice> DeviceScheduler::getAllDevices() const
{
    return m_devices.values();
}

QList<TranscriptionDevice> DeviceScheduler::getAvailableDevices() const
{
    QList<TranscriptionDevice> available;
    for (const TranscriptionDevice& device : m_devices) {
        if (device.isConnected && device.isEnabled && !device.isBusy) {
            available.append(device);
        }
    }
    return available;
}

QList<TranscriptionDevice> DeviceScheduler::getBusyDevices() const
{
    QList<TranscriptionDevice> busy;
    for (const TranscriptionDevice& device : m_devices) {
        if (device.isConnected && device.isBusy) {
            busy.append(device);
        }
    }
    return busy;
}

int DeviceScheduler::createJob(const ScheduledJob& job)
{
    QMutexLocker locker(&m_mutex);
    
    if (m_jobs.size() >= m_loadBalanceConfig.maxQueueSize) {
        emit schedulingError("Job queue is full");
        return -1;
    }
    
    int jobId = m_nextJobId++;
    ScheduledJob newJob = job;
    newJob.jobId = jobId;
    newJob.status = "Pending";
    newJob.progress = 0.0f;
    
    m_jobs[jobId] = newJob;
    m_jobQueue.append(jobId);
    
    emit jobCreated(jobId);
    
    return jobId;
}

bool DeviceScheduler::cancelJob(int jobId)
{
    QMutexLocker locker(&m_mutex);
    
    if (!m_jobs.contains(jobId)) {
        return false;
    }
    
    ScheduledJob& job = m_jobs[jobId];
    
    if (job.status == "Running" && !job.assignedDeviceId.isEmpty()) {
        TranscriptionDevice& device = m_devices[job.assignedDeviceId];
        device.isBusy = false;
        device.currentJobId = -1;
        device.currentProgress = 0.0f;
        emit deviceStatusChanged(device.deviceId);
    }
    
    job.status = "Cancelled";
    m_jobQueue.removeAll(jobId);
    
    emit jobCancelled(jobId);
    return true;
}

bool DeviceScheduler::pauseJob(int jobId)
{
    if (!m_jobs.contains(jobId)) {
        return false;
    }
    
    ScheduledJob& job = m_jobs[jobId];
    if (job.status == "Pending" || job.status == "Running") {
        job.status = "Paused";
    }
    
    return true;
}

bool DeviceScheduler::resumeJob(int jobId)
{
    if (!m_jobs.contains(jobId)) {
        return false;
    }
    
    ScheduledJob& job = m_jobs[jobId];
    if (job.status == "Paused") {
        job.status = "Pending";
        if (!m_jobQueue.contains(jobId)) {
            m_jobQueue.append(jobId);
        }
    }
    
    return true;
}

ScheduledJob DeviceScheduler::getJob(int jobId) const
{
    return m_jobs.value(jobId);
}

QList<ScheduledJob> DeviceScheduler::getAllJobs() const
{
    return m_jobs.values();
}

QList<ScheduledJob> DeviceScheduler::getPendingJobs() const
{
    QList<ScheduledJob> pending;
    for (const ScheduledJob& job : m_jobs) {
        if (job.status == "Pending") {
            pending.append(job);
        }
    }
    return pending;
}

QList<ScheduledJob> DeviceScheduler::getRunningJobs() const
{
    QList<ScheduledJob> running;
    for (const ScheduledJob& job : m_jobs) {
        if (job.status == "Running") {
            running.append(job);
        }
    }
    return running;
}

bool DeviceScheduler::assignJobToDevice(int jobId, const QString& deviceId)
{
    QMutexLocker locker(&m_mutex);
    
    if (!m_jobs.contains(jobId) || !m_devices.contains(deviceId)) {
        return false;
    }
    
    TranscriptionDevice& device = m_devices[deviceId];
    ScheduledJob& job = m_jobs[jobId];
    
    if (!device.isConnected || !device.isEnabled || device.isBusy) {
        return false;
    }
    
    device.isBusy = true;
    device.currentJobId = jobId;
    device.currentProgress = 0.0f;
    device.lastJobStartTime = QDateTime::currentDateTime();
    
    job.assignedDeviceId = deviceId;
    job.status = "Running";
    job.startTime = QDateTime::currentDateTime();
    job.progress = 0.0f;
    
    m_jobQueue.removeAll(jobId);
    m_deviceJobQueues[deviceId].append(jobId);
    
    emit jobAssigned(jobId, deviceId);
    emit jobStarted(jobId, deviceId);
    emit deviceStatusChanged(deviceId);
    
    return true;
}

QString DeviceScheduler::findBestDeviceForJob(const ScheduledJob& job) const
{
    QString bestDeviceId;
    float bestScore = -1.0f;
    
    for (const TranscriptionDevice& device : m_devices) {
        if (!device.isConnected || !device.isEnabled || device.isBusy) {
            continue;
        }
        
        if (!canDeviceAcceptJob(device, job)) {
            continue;
        }
        
        float score = calculateDeviceScore(device, job);
        if (score > bestScore) {
            bestScore = score;
            bestDeviceId = device.deviceId;
        }
    }
    
    return bestDeviceId;
}

void DeviceScheduler::startScheduler()
{
    if (m_isRunning) return;
    
    m_isRunning = true;
    m_isPaused = false;
    m_scheduleTimer->start(m_scheduleIntervalMs);
    emit schedulerStarted();
}

void DeviceScheduler::stopScheduler()
{
    if (!m_isRunning) return;
    
    m_scheduleTimer->stop();
    m_isRunning = false;
    m_isPaused = false;
    emit schedulerStopped();
}

void DeviceScheduler::pauseScheduler()
{
    if (!m_isRunning || m_isPaused) return;
    
    m_isPaused = true;
    emit schedulerPaused();
}

void DeviceScheduler::resumeScheduler()
{
    if (!m_isRunning || !m_isPaused) return;
    
    m_isPaused = false;
    emit schedulerResumed();
}

bool DeviceScheduler::isSchedulerRunning() const
{
    return m_isRunning && !m_isPaused;
}

int DeviceScheduler::getPendingJobCount() const
{
    return getPendingJobs().size();
}

int DeviceScheduler::getRunningJobCount() const
{
    return getRunningJobs().size();
}

int DeviceScheduler::getAvailableDeviceCount() const
{
    return getAvailableDevices().size();
}

float DeviceScheduler::getOverallSystemLoad() const
{
    int totalDevices = m_devices.size();
    if (totalDevices == 0) return 0.0f;
    
    int busyDevices = 0;
    for (const TranscriptionDevice& device : m_devices) {
        if (device.isBusy) busyDevices++;
    }
    
    return static_cast<float>(busyDevices) / totalDevices;
}

float DeviceScheduler::getDeviceLoad(const QString& deviceId) const
{
    if (!m_devices.contains(deviceId)) return 0.0f;
    
    const TranscriptionDevice& device = m_devices[deviceId];
    if (!device.isConnected || !device.isEnabled) return 0.0f;
    
    return device.isBusy ? 1.0f : 0.0f;
}

void DeviceScheduler::clearCompletedJobs()
{
    QMutableMapIterator<int, ScheduledJob> it(m_jobs);
    while (it.hasNext()) {
        it.next();
        if (it.value().status == "Completed" || it.value().status == "Failed" || it.value().status == "Cancelled") {
            it.remove();
        }
    }
}

void DeviceScheduler::resetDeviceStatistics()
{
    for (TranscriptionDevice& device : m_devices) {
        device.totalJobsCompleted = 0;
        device.totalJobsFailed = 0;
        device.totalRecordingTimeMs = 0;
    }
}

bool DeviceScheduler::exportSchedule(const QString& filePath)
{
    QVariantMap scheduleMap;
    
    QVariantList jobsList;
    for (const ScheduledJob& job : m_jobs) {
        QVariantMap jobMap;
        jobMap["jobId"] = job.jobId;
        jobMap["name"] = job.name;
        jobMap["tapeModelId"] = job.tapeModelId;
        jobMap["outputPath"] = job.outputPath;
        jobMap["status"] = job.status;
        jobMap["progress"] = job.progress;
        jobMap["priority"] = job.priority;
        jobsList.append(jobMap);
    }
    scheduleMap["jobs"] = jobsList;
    
    QVariantList devicesList;
    for (const TranscriptionDevice& device : m_devices) {
        QVariantMap deviceMap;
        deviceMap["deviceId"] = device.deviceId;
        deviceMap["deviceName"] = device.deviceName;
        deviceMap["isConnected"] = device.isConnected;
        deviceMap["isBusy"] = device.isBusy;
        deviceMap["priority"] = device.priority;
        devicesList.append(deviceMap);
    }
    scheduleMap["devices"] = devicesList;
    
    QJsonDocument doc(QJsonObject::fromVariantMap(scheduleMap));
    QFile file(filePath);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(doc.toJson());
        file.close();
        return true;
    }
    return false;
}

bool DeviceScheduler::importSchedule(const QString& filePath)
{
    QFile file(filePath);
    if (file.open(QIODevice::ReadOnly)) {
        QByteArray data = file.readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        if (doc.isObject()) {
            QVariantMap scheduleMap = doc.object().toVariantMap();
            file.close();
            return true;
        }
        file.close();
    }
    return false;
}

void DeviceScheduler::onScheduleTick()
{
    if (!m_isRunning || m_isPaused) return;
    
    checkDeviceTimeouts();
    processJobQueue();
    checkJobTimeouts();
    retryFailedJobs();
    
    emit systemLoadChanged(getOverallSystemLoad());
}

void DeviceScheduler::checkDeviceTimeouts()
{
    for (TranscriptionDevice& device : m_devices) {
        if (device.isConnected && device.lastSeenTime.secsTo(QDateTime::currentDateTime()) > 30) {
            device.isConnected = false;
            device.isBusy = false;
            emit deviceDisconnected(device.deviceId);
        }
    }
}

void DeviceScheduler::processJobQueue()
{
    if (m_scheduleMode == ManualMode) return;
    
    assignPendingJobs();
}

bool DeviceScheduler::canDeviceAcceptJob(const TranscriptionDevice& device, const ScheduledJob& job) const
{
    Q_UNUSED(job);
    
    if (!device.isConnected || !device.isEnabled || device.isBusy) {
        return false;
    }
    
    int deviceJobCount = m_deviceJobQueues[device.deviceId].size();
    if (deviceJobCount >= device.maxConcurrentJobs) {
        return false;
    }
    
    return true;
}

void DeviceScheduler::assignPendingJobs()
{
    QList<int> pendingJobIds = m_jobQueue;
    
    if (m_loadBalanceConfig.distributeByPriority) {
        std::sort(pendingJobIds.begin(), pendingJobIds.end(), [this](int a, int b) {
            return m_jobs[a].priority > m_jobs[b].priority;
        });
    }
    
    for (int jobId : pendingJobIds) {
        if (!m_jobs.contains(jobId)) continue;
        if (m_jobs[jobId].status != "Pending") continue;
        
        QString bestDeviceId = findBestDeviceForJob(m_jobs[jobId]);
        if (!bestDeviceId.isEmpty()) {
            assignJobToDevice(jobId, bestDeviceId);
        }
    }
}

void DeviceScheduler::checkJobTimeouts()
{
}

void DeviceScheduler::retryFailedJobs()
{
    for (ScheduledJob& job : m_jobs) {
        if (job.status == "Failed" && job.retryCount < job.maxRetries) {
            job.status = "Pending";
            job.retryCount++;
            if (!m_jobQueue.contains(job.jobId)) {
                m_jobQueue.append(job.jobId);
            }
        }
    }
}

float DeviceScheduler::calculateDeviceScore(const TranscriptionDevice& device, const ScheduledJob& job) const
{
    float score = 0.0f;
    
    if (m_loadBalanceConfig.prioritizeIdleDevices && !device.isBusy) {
        score += 100.0f;
    }
    
    score += device.priority * 10.0f;
    score += job.priority * 5.0f;
    
    return score;
}
