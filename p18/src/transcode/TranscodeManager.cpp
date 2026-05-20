#include "TranscodeManager.h"
#include <QStandardPaths>
#include <QFileInfo>
#include <QDir>
#include <QDateTime>
#include <QUuid>
#include <QDebug>

TranscodeManager::TranscodeManager(QObject *parent)
    : QObject(parent)
    , m_currentProcess(nullptr)
    , m_isPaused(false)
    , m_isCancelled(false)
    , m_totalDurationMs(0)
    , m_completedCount(0)
    , m_failedCount(0)
{
    initDefaultProfiles();
    m_ffmpegPath = findFFmpegExecutable();
}

void TranscodeManager::initDefaultProfiles()
{
    TranscodeProfile archive;
    archive.profileId = "archive";
    archive.name = "归档质量 (高保真)";
    archive.containerFormat = "mp4";
    archive.videoCodec = "libx264";
    archive.audioCodec = "aac";
    archive.videoBitrateKbps = 10000;
    archive.audioBitrateKbps = 320;
    archive.width = 1920;
    archive.height = 1080;
    archive.fps = 29.97f;
    archive.preset = "medium";
    archive.useHardwareAccel = true;
    m_profiles[archive.profileId] = archive;
    
    TranscodeProfile web;
    web.profileId = "web";
    web.name = "网络发布 (兼容)";
    web.containerFormat = "mp4";
    web.videoCodec = "libx264";
    web.audioCodec = "aac";
    web.videoBitrateKbps = 5000;
    web.audioBitrateKbps = 192;
    web.width = 1280;
    web.height = 720;
    web.fps = 29.97f;
    web.preset = "fast";
    web.useHardwareAccel = true;
    m_profiles[web.profileId] = web;
    
    TranscodeProfile mobile;
    mobile.profileId = "mobile";
    mobile.name = "移动设备 (高效)";
    mobile.containerFormat = "mp4";
    mobile.videoCodec = "libx264";
    mobile.audioCodec = "aac";
    mobile.videoBitrateKbps = 2500;
    mobile.audioBitrateKbps = 128;
    mobile.width = 854;
    mobile.height = 480;
    mobile.fps = 25.0f;
    mobile.preset = "veryfast";
    mobile.useHardwareAccel = true;
    m_profiles[mobile.profileId] = mobile;
    
    TranscodeProfile hqAudio;
    hqAudio.profileId = "hq_audio";
    hqAudio.name = "音频提取 (无损)";
    hqAudio.containerFormat = "wav";
    hqAudio.videoCodec = "";
    hqAudio.audioCodec = "pcm_s16le";
    hqAudio.videoBitrateKbps = 0;
    hqAudio.audioBitrateKbps = 1536;
    hqAudio.width = 0;
    hqAudio.height = 0;
    hqAudio.fps = 0;
    hqAudio.preset = "";
    hqAudio.useHardwareAccel = false;
    m_profiles[hqAudio.profileId] = hqAudio;
    
    TranscodeProfile proRes;
    proRes.profileId = "prores";
    proRes.name = "后期编辑 (ProRes)";
    proRes.containerFormat = "mov";
    proRes.videoCodec = "prores_ks";
    proRes.audioCodec = "pcm_s16le";
    proRes.videoBitrateKbps = 50000;
    proRes.audioBitrateKbps = 1536;
    proRes.width = 1920;
    proRes.height = 1080;
    proRes.fps = 29.97f;
    proRes.preset = "";
    proRes.additionalArgs = "-profile:v 3";
    proRes.useHardwareAccel = false;
    m_profiles[proRes.profileId] = proRes;
}

QString TranscodeManager::findFFmpegExecutable()
{
    QStringList searchPaths;
    searchPaths.append(QStandardPaths::findExecutable("ffmpeg"));
    
#ifdef Q_OS_WIN
    searchPaths.append("C:/Program Files/ffmpeg/bin/ffmpeg.exe");
    searchPaths.append("C:/ffmpeg/bin/ffmpeg.exe");
#elif defined(Q_OS_MAC)
    searchPaths.append("/opt/homebrew/bin/ffmpeg");
    searchPaths.append("/usr/local/bin/ffmpeg");
    searchPaths.append("/Applications/ffmpeg");
#else
    searchPaths.append("/usr/bin/ffmpeg");
    searchPaths.append("/usr/local/bin/ffmpeg");
#endif
    
    for (const QString& path : searchPaths) {
        if (QFileInfo::exists(path) && QFileInfo(path).isExecutable()) {
            return path;
        }
    }
    
    return "";
}

bool TranscodeManager::checkFFmpegAvailable()
{
    if (m_ffmpegPath.isEmpty()) {
        m_ffmpegPath = findFFmpegExecutable();
    }
    
    return !m_ffmpegPath.isEmpty() && QFileInfo(m_ffmpegPath).isExecutable();
}

QString TranscodeManager::addTask(const QString& sourceFile, const QString& outputFile, const QString& profileId)
{
    if (!m_profiles.contains(profileId)) {
        return "";
    }
    
    TranscodeTask task;
    task.taskId = QUuid::createUuid().toString();
    task.sourceFile = sourceFile;
    task.outputFile = outputFile;
    task.profileId = profileId;
    task.status = "pending";
    task.progressPercent = 0;
    task.startTimeMs = 0;
    task.endTimeMs = 0;
    
    QFileInfo fi(sourceFile);
    task.fileSize = fi.size();
    
    m_tasks.append(task);
    return task.taskId;
}

void TranscodeManager::startBatch()
{
    if (!checkFFmpegAvailable()) {
        emit ffmpegNotFound();
        return;
    }
    
    m_isCancelled = false;
    m_isPaused = false;
    m_completedCount = 0;
    m_failedCount = 0;
    
    for (TranscodeTask& task : m_tasks) {
        if (task.status != "completed" && task.status != "failed") {
            task.status = "pending";
            task.progressPercent = 0;
            task.errorMessage.clear();
        }
    }
    
    emit batchStarted();
    processNextTask();
}

void TranscodeManager::processNextTask()
{
    if (m_isCancelled) {
        emit batchCompleted();
        return;
    }
    
    if (m_isPaused) {
        return;
    }
    
    QString nextTaskId;
    for (const TranscodeTask& task : m_tasks) {
        if (task.status == "pending") {
            nextTaskId = task.taskId;
            break;
        }
    }
    
    if (nextTaskId.isEmpty()) {
        emit batchCompleted();
        return;
    }
    
    m_currentTaskId = nextTaskId;
    
    for (TranscodeTask& task : m_tasks) {
        if (task.taskId == nextTaskId) {
            task.status = "running";
            task.startTimeMs = QDateTime::currentMSecsSinceEpoch();
            break;
        }
    }
    
    TranscodeProfile profile;
    TranscodeTask currentTask;
    for (const TranscodeTask& t : m_tasks) {
        if (t.taskId == nextTaskId) {
            currentTask = t;
            break;
        }
    }
    profile = m_profiles[currentTask.profileId];
    
    QString outputDir = QFileInfo(currentTask.outputFile).absolutePath();
    QDir().mkpath(outputDir);
    
    QString command = buildFFmpegCommand(currentTask, profile);
    
    cleanupProcess();
    m_currentProcess = new QProcess(this);
    
    connect(m_currentProcess, &QProcess::readyReadStandardOutput, this, &TranscodeManager::onProcessReadyRead);
    connect(m_currentProcess, &QProcess::readyReadStandardError, this, &TranscodeManager::onProcessReadyRead);
    connect(m_currentProcess, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, &TranscodeManager::onProcessFinished);
    connect(m_currentProcess, &QProcess::errorOccurred, this, &TranscodeManager::onProcessErrorOccurred);
    
    m_currentProcess->setProcessChannelMode(QProcess::MergedChannels);
    
    QStringList args = QProcess::splitCommand(command);
    QString program = args.takeFirst();
    
    emit taskStarted(nextTaskId);
    m_currentProcess->start(program, args);
}

QString TranscodeManager::buildFFmpegCommand(const TranscodeTask& task, const TranscodeProfile& profile)
{
    QStringList cmdParts;
    cmdParts.append(m_ffmpegPath);
    
    cmdParts.append("-y");
    cmdParts.append("-i");
    cmdParts.append(QString("\"%1\"").arg(task.sourceFile));
    
    if (profile.videoBitrateKbps > 0 && !profile.videoCodec.isEmpty()) {
        cmdParts.append("-c:v");
        cmdParts.append(profile.videoCodec);
        
        if (profile.videoCodec == "libx264" && !profile.preset.isEmpty()) {
            cmdParts.append("-preset");
            cmdParts.append(profile.preset);
        }
        
        cmdParts.append("-b:v");
        cmdParts.append(QString("%1k").arg(profile.videoBitrateKbps));
        
        if (profile.width > 0 && profile.height > 0) {
            cmdParts.append("-vf");
            cmdParts.append(QString("scale=%1:%2").arg(profile.width).arg(profile.height));
        }
    } else {
        cmdParts.append("-vn");
    }
    
    if (!profile.audioCodec.isEmpty()) {
        cmdParts.append("-c:a");
        cmdParts.append(profile.audioCodec);
        cmdParts.append("-b:a");
        cmdParts.append(QString("%1k").arg(profile.audioBitrateKbps));
    } else {
        cmdParts.append("-an");
    }
    
    if (!profile.additionalArgs.isEmpty()) {
        cmdParts.append(profile.additionalArgs);
    }
    
    cmdParts.append(QString("\"%1\"").arg(task.outputFile));
    
    return cmdParts.join(" ");
}

void TranscodeManager::parseFFmpegProgress(const QString& output)
{
    QRegularExpression timeRegex("time=(\\d+):(\\d+):(\\d+\\.\\d+)");
    QRegularExpressionMatch match = timeRegex.match(output);
    
    if (match.hasMatch()) {
        int hours = match.captured(1).toInt();
        int minutes = match.captured(2).toInt();
        float seconds = match.captured(3).toFloat();
        
        qint64 currentMs = (hours * 3600LL + minutes * 60LL) * 1000LL + static_cast<qint64>(seconds * 1000);
        
        for (TranscodeTask& task : m_tasks) {
            if (task.taskId == m_currentTaskId) {
                if (m_totalDurationMs > 0) {
                    int progress = static_cast<int>((currentMs * 100LL) / m_totalDurationMs);
                    task.progressPercent = qBound(0, progress, 100);
                } else {
                    task.progressPercent = 50;
                }
                emit taskProgress(m_currentTaskId, task.progressPercent);
                break;
            }
        }
        
        int pendingCount = 0;
        int runningTotal = 0;
        for (const TranscodeTask& task : m_tasks) {
            if (task.status == "pending") {
                pendingCount++;
            }
            runningTotal += task.progressPercent;
        }
        
        int overall = (runningTotal) / qMax(1, m_tasks.size());
        emit batchProgress(qBound(0, overall, 100));
    }
}

void TranscodeManager::onProcessReadyRead()
{
    if (!m_currentProcess) return;
    
    QByteArray output = m_currentProcess->readAll();
    parseFFmpegProgress(QString::fromUtf8(output));
}

void TranscodeManager::onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    for (TranscodeTask& task : m_tasks) {
        if (task.taskId == m_currentTaskId) {
            task.endTimeMs = QDateTime::currentMSecsSinceEpoch();
            
            if (exitCode == 0 && exitStatus == QProcess::NormalExit) {
                task.status = "completed";
                task.progressPercent = 100;
                QFileInfo fi(task.outputFile);
                task.outputFileSize = fi.size();
                m_completedCount++;
                emit taskCompleted(m_currentTaskId);
            } else {
                task.status = "failed";
                task.errorMessage = QString("Exit code: %1").arg(exitCode);
                m_failedCount++;
                emit taskFailed(m_currentTaskId, task.errorMessage);
            }
            break;
        }
    }
    
    cleanupProcess();
    m_currentTaskId.clear();
    
    QTimer::singleShot(100, this, &TranscodeManager::processNextTask);
}

void TranscodeManager::onProcessErrorOccurred(QProcess::ProcessError error)
{
    QString errorStr;
    switch (error) {
        case QProcess::FailedToStart: errorStr = "Failed to start"; break;
        case QProcess::Crashed: errorStr = "Crashed"; break;
        case QProcess::Timedout: errorStr = "Timed out"; break;
        case QProcess::ReadError: errorStr = "Read error"; break;
        case QProcess::WriteError: errorStr = "Write error"; break;
        default: errorStr = "Unknown error"; break;
    }
    
    for (TranscodeTask& task : m_tasks) {
        if (task.taskId == m_currentTaskId) {
            task.status = "failed";
            task.errorMessage = errorStr;
            m_failedCount++;
            emit taskFailed(m_currentTaskId, errorStr);
            break;
        }
    }
    
    cleanupProcess();
    m_currentTaskId.clear();
    
    QTimer::singleShot(1000, this, &TranscodeManager::processNextTask);
}

void TranscodeManager::cleanupProcess()
{
    if (m_currentProcess) {
        if (m_currentProcess->state() != QProcess::NotRunning) {
            m_currentProcess->kill();
            m_currentProcess->waitForFinished(1000);
        }
        delete m_currentProcess;
        m_currentProcess = nullptr;
    }
}

void TranscodeManager::pauseBatch()
{
    m_isPaused = true;
}

void TranscodeManager::resumeBatch()
{
    m_isPaused = false;
    processNextTask();
}

void TranscodeManager::cancelBatch()
{
    m_isCancelled = true;
    cleanupProcess();
}

void TranscodeManager::clearCompleted()
{
    QMutableListIterator<TranscodeTask> it(m_tasks);
    while (it.hasNext()) {
        it.next();
        if (it.value().status == "completed" || it.value().status == "failed") {
            it.remove();
        }
    }
}

void TranscodeManager::setFFmpegPath(const QString& path)
{
    m_ffmpegPath = path;
}

QString TranscodeManager::getFFmpegPath() const
{
    return m_ffmpegPath;
}

QList<TranscodeProfile> TranscodeManager::getAvailableProfiles() const
{
    return m_profiles.values();
}

TranscodeProfile TranscodeManager::getProfile(const QString& profileId) const
{
    return m_profiles.value(profileId);
}

void TranscodeManager::addCustomProfile(const TranscodeProfile& profile)
{
    m_profiles[profile.profileId] = profile;
}

QList<TranscodeTask> TranscodeManager::getTasks() const
{
    return m_tasks;
}

TranscodeTask TranscodeManager::getTask(const QString& taskId) const
{
    for (const TranscodeTask& task : m_tasks) {
        if (task.taskId == taskId) {
            return task;
        }
    }
    return TranscodeTask();
}

int TranscodeManager::getTotalProgress() const
{
    if (m_tasks.isEmpty()) return 0;
    
    int total = 0;
    for (const TranscodeTask& task : m_tasks) {
        total += task.progressPercent;
    }
    return total / m_tasks.size();
}

int TranscodeManager::getCompletedCount() const
{
    return m_completedCount;
}

int TranscodeManager::getFailedCount() const
{
    return m_failedCount;
}

QMap<QString, QString> TranscodeManager::getSupportedFormats()
{
    QMap<QString, QString> formats;
    formats["mp4"] = "MP4 (H.264/AAC)";
    formats["mov"] = "QuickTime MOV";
    formats["avi"] = "AVI Video";
    formats["mkv"] = "Matroska";
    formats["mp3"] = "MP3 Audio";
    formats["wav"] = "WAV Audio";
    formats["flac"] = "FLAC Audio";
    formats["webm"] = "WebM";
    return formats;
}
