#include "HardwareCompatibilityLayer.h"
#include <QDateTime>
#include <QFile>
#include <QTextStream>
#include <QElapsedTimer>
#include <QRegularExpression>

HardwareCompatibilityLayer::HardwareCompatibilityLayer(QObject* parent)
    : QObject(parent)
    , m_globalMode(AutoDetect)
    , m_performanceOptimizations(true)
    , m_errorLoggingEnabled(true)
    , m_globalRetryCount(3)
    , m_globalRetryDelayMs(100)
{
}

HardwareCompatibilityLayer::~HardwareCompatibilityLayer()
{
}

void HardwareCompatibilityLayer::setCompatibilityMode(CompatibilityMode mode)
{
    m_globalMode = mode;
}

HardwareCompatibilityLayer::CompatibilityMode HardwareCompatibilityLayer::getCompatibilityMode() const
{
    return m_globalMode;
}

bool HardwareCompatibilityLayer::registerDevice(const HardwareDeviceInfo& deviceInfo)
{
    if (deviceInfo.deviceId.isEmpty()) {
        return false;
    }
    
    m_devices[deviceInfo.deviceId] = deviceInfo;
    m_driverStatus[deviceInfo.deviceId] = DriverStatus::NotLoaded;
    m_transferStats[deviceInfo.deviceId] = QMap<QString, qint64>();
    m_transferStats[deviceInfo.deviceId]["totalTransfers"] = 0;
    m_transferStats[deviceInfo.deviceId]["successfulTransfers"] = 0;
    m_transferStats[deviceInfo.deviceId]["failedTransfers"] = 0;
    m_transferStats[deviceInfo.deviceId]["totalBytes"] = 0;
    m_transferStats[deviceInfo.deviceId]["totalTimeMs"] = 0;
    m_transferStats[deviceInfo.deviceId]["totalRetries"] = 0;
    
    m_warnings[deviceInfo.deviceId] = QStringList();
    
    return true;
}

bool HardwareCompatibilityLayer::unregisterDevice(const QString& deviceId)
{
    if (!m_devices.contains(deviceId)) {
        return false;
    }
    
    shutdownDevice(deviceId);
    m_devices.remove(deviceId);
    m_driverStatus.remove(deviceId);
    m_lastErrors.remove(deviceId);
    m_transferStats.remove(deviceId);
    m_warnings.remove(deviceId);
    
    return true;
}

HardwareDeviceInfo HardwareCompatibilityLayer::getDeviceInfo(const QString& deviceId) const
{
    return m_devices.value(deviceId);
}

QList<HardwareDeviceInfo> HardwareCompatibilityLayer::getAllDevices() const
{
    return m_devices.values();
}

bool HardwareCompatibilityLayer::registerCompatibilityProfile(const DriverCompatibilityProfile& profile)
{
    if (profile.profileId.isEmpty()) {
        return false;
    }
    
    m_profiles[profile.profileId] = profile;
    return true;
}

DriverCompatibilityProfile HardwareCompatibilityLayer::getBestProfileForDevice(const QString& deviceId) const
{
    if (!m_devices.contains(deviceId)) {
        return DriverCompatibilityProfile();
    }
    
    HardwareDeviceInfo device = m_devices[deviceId];
    
    for (const DriverCompatibilityProfile& profile : m_profiles) {
        QRegularExpression regex(profile.targetDevicePattern);
        QRegularExpressionMatch match = regex.match(device.deviceName);
        if (match.hasMatch()) {
            return profile;
        }
    }
    
    DriverCompatibilityProfile defaultProfile;
    defaultProfile.profileId = "default";
    
    if (device.generation <= HardwareGeneration::Gen_PCI) {
        defaultProfile.useLegacyIO = true;
        defaultProfile.useSmallerBuffers = true;
        defaultProfile.maxTransferSizeBytes = 1024;
        defaultProfile.baseTimeoutMs = 3000;
        defaultProfile.maxRetries = 5;
    }
    
    return defaultProfile;
}

QList<DriverCompatibilityProfile> HardwareCompatibilityLayer::getAllProfiles() const
{
    return m_profiles.values();
}

TransferResult HardwareCompatibilityLayer::performTransfer(const QString& deviceId, 
                                                           const QByteArray& data, 
                                                           bool isWriteOperation)
{
    return performTransferWithRetry(deviceId, data, isWriteOperation, m_globalRetryCount);
}

TransferResult HardwareCompatibilityLayer::performTransferWithRetry(const QString& deviceId, 
                                                                     const QByteArray& data, 
                                                                     bool isWriteOperation,
                                                                     int customRetries)
{
    TransferResult result;
    QElapsedTimer timer;
    timer.start();
    
    DriverCompatibilityProfile profile = getBestProfileForDevice(deviceId);
    int maxRetries = (customRetries >= 0) ? customRetries : profile.maxRetries;
    
    CompatibilityMode mode = m_globalMode;
    if (mode == AutoDetect) {
        if (profile.useLegacyIO || profile.useEmulationLayer) {
            mode = CompatibilityMode;
        } else {
            mode = NativeMode;
        }
    }
    
    for (int attempt = 0; attempt <= maxRetries; attempt++) {
        result.retryCount = attempt;
        
        switch (mode) {
            case NativeMode:
                result = performNativeTransfer(deviceId, data, isWriteOperation);
                break;
            case CompatibilityMode:
                result = performCompatibilityTransfer(deviceId, data, isWriteOperation);
                break;
            case FallbackMode:
            case LegacyEmulation:
                result = performFallbackTransfer(deviceId, data, isWriteOperation);
                break;
            default:
                result = performNativeTransfer(deviceId, data, isWriteOperation);
                break;
        }
        
        if (result.success) {
            break;
        }
        
        if (attempt < maxRetries && profile.enableRetries) {
            QThread::msleep(profile.retryDelayMs);
        }
    }
    
    result.totalTimeMs = timer.elapsed();
    
    if (!result.success) {
        logTransferError(deviceId, result.errorMessage);
    }
    
    updateTransferStats(deviceId, result);
    emit transferCompleted(deviceId, result);
    
    return result;
}

bool HardwareCompatibilityLayer::initializeDevice(const QString& deviceId)
{
    if (!m_devices.contains(deviceId)) {
        return false;
    }
    
    bool success = false;
    HardwareDeviceInfo& device = m_devices[deviceId];
    
    if (isLegacyDevice(deviceId)) {
        success = initializeLegacyDevice(deviceId);
    } else {
        success = initializeModernDevice(deviceId);
    }
    
    if (success) {
        m_driverStatus[deviceId] = DriverStatus::Loaded;
        emit driverStatusChanged(deviceId, DriverStatus::Loaded);
    } else {
        m_driverStatus[deviceId] = DriverStatus::Failed;
        emit driverStatusChanged(deviceId, DriverStatus::Failed);
    }
    
    emit deviceInitialized(deviceId, success);
    return success;
}

bool HardwareCompatibilityLayer::shutdownDevice(const QString& deviceId)
{
    if (!m_devices.contains(deviceId)) {
        return false;
    }
    
    m_driverStatus[deviceId] = DriverStatus::NotLoaded;
    emit deviceShutdown(deviceId);
    emit driverStatusChanged(deviceId, DriverStatus::NotLoaded);
    
    return true;
}

bool HardwareCompatibilityLayer::resetDevice(const QString& deviceId)
{
    if (!m_devices.contains(deviceId)) {
        return false;
    }
    
    shutdownDevice(deviceId);
    return initializeDevice(deviceId);
}

DriverStatus HardwareCompatibilityLayer::getDriverStatus(const QString& deviceId) const
{
    return m_driverStatus.value(deviceId, DriverStatus::NotLoaded);
}

QString HardwareCompatibilityLayer::getLastError(const QString& deviceId) const
{
    return m_lastErrors.value(deviceId);
}

bool HardwareCompatibilityLayer::isLegacyDevice(const QString& deviceId) const
{
    if (!m_devices.contains(deviceId)) {
        return false;
    }
    
    HardwareDeviceInfo device = m_devices[deviceId];
    return device.generation <= HardwareGeneration::Gen_PCI || device.requiresLegacyMode;
}

bool HardwareCompatibilityLayer::requiresEmulation(const QString& deviceId) const
{
    DriverCompatibilityProfile profile = getBestProfileForDevice(deviceId);
    return profile.useEmulationLayer;
}

void HardwareCompatibilityLayer::enablePerformanceOptimizations(bool enabled)
{
    m_performanceOptimizations = enabled;
}

void HardwareCompatibilityLayer::enableErrorLogging(bool enabled)
{
    m_errorLoggingEnabled = enabled;
}

QMap<QString, qint64> HardwareCompatibilityLayer::getTransferStatistics(const QString& deviceId) const
{
    return m_transferStats.value(deviceId);
}

void HardwareCompatibilityLayer::resetStatistics(const QString& deviceId)
{
    if (m_transferStats.contains(deviceId)) {
        m_transferStats[deviceId]["totalTransfers"] = 0;
        m_transferStats[deviceId]["successfulTransfers"] = 0;
        m_transferStats[deviceId]["failedTransfers"] = 0;
        m_transferStats[deviceId]["totalBytes"] = 0;
        m_transferStats[deviceId]["totalTimeMs"] = 0;
        m_transferStats[deviceId]["totalRetries"] = 0;
    }
}

bool HardwareCompatibilityLayer::exportDiagnosticsReport(const QString& filePath) const
{
    QFile file(filePath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        return false;
    }
    
    QTextStream out(&file);
    
    out << "============================================================\n";
    out << "    HARDWARE COMPATIBILITY DIAGNOSTICS REPORT\n";
    out << "    Generated: " << QDateTime::currentDateTime().toString() << "\n";
    out << "============================================================\n\n";
    
    out << "GLOBAL SETTINGS\n";
    out << "----------------\n";
    out << "Compatibility Mode: " << static_cast<int>(m_globalMode) << "\n";
    out << "Performance Optimizations: " << (m_performanceOptimizations ? "Enabled" : "Disabled") << "\n";
    out << "Error Logging: " << (m_errorLoggingEnabled ? "Enabled" : "Disabled") << "\n";
    out << "Global Retry Count: " << m_globalRetryCount << "\n\n";
    
    out << "REGISTERED DEVICES\n";
    out << "------------------\n\n";
    
    for (const HardwareDeviceInfo& device : m_devices) {
        out << "Device: " << device.deviceName << " (" << device.deviceId << ")\n";
        out << "  Manufacturer: " << device.manufacturer << "\n";
        out << "  Generation: " << static_cast<int>(device.generation) << "\n";
        out << "  Driver Version: " << device.driverVersion << "\n";
        out << "  Requires Legacy Mode: " << (device.requiresLegacyMode ? "Yes" : "No") << "\n";
        out << "  Transfer Rate: " << device.transferRateKbps << " Kbps\n";
        out << "  Max Buffer: " << device.maxBufferSizeKB << " KB\n";
        
        if (m_transferStats.contains(device.deviceId)) {
            QMap<QString, qint64> stats = m_transferStats[device.deviceId];
            out << "  Transfer Statistics:\n";
            out << "    Total Transfers: " << stats["totalTransfers"] << "\n";
            out << "    Successful: " << stats["successfulTransfers"] << "\n";
            out << "    Failed: " << stats["failedTransfers"] << "\n";
            out << "    Total Bytes: " << stats["totalBytes"] << "\n";
            out << "    Total Time: " << stats["totalTimeMs"] << " ms\n";
            out << "    Total Retries: " << stats["totalRetries"] << "\n";
        }
        
        if (m_warnings.contains(device.deviceId) && !m_warnings[device.deviceId].isEmpty()) {
            out << "  Warnings:\n";
            for (const QString& warning : m_warnings[device.deviceId]) {
                out << "    - " << warning << "\n";
            }
        }
        
        out << "\n";
    }
    
    out << "COMPATIBILITY PROFILES\n";
    out << "----------------------\n\n";
    
    for (const DriverCompatibilityProfile& profile : m_profiles) {
        out << "Profile: " << profile.profileId << "\n";
        out << "  Target Pattern: " << profile.targetDevicePattern << "\n";
        out << "  Legacy IO: " << (profile.useLegacyIO ? "Yes" : "No") << "\n";
        out << "  Emulation Layer: " << (profile.useEmulationLayer ? "Yes" : "No") << "\n";
        out << "  Max Retries: " << profile.maxRetries << "\n";
        out << "  Max Transfer Size: " << profile.maxTransferSizeBytes << " bytes\n";
        out << "\n";
    }
    
    out << "============================================================\n";
    out << "    END OF REPORT\n";
    out << "============================================================\n";
    
    file.close();
    return true;
}

QStringList HardwareCompatibilityLayer::getCompatibilityWarnings(const QString& deviceId) const
{
    return m_warnings.value(deviceId);
}

bool HardwareCompatibilityLayer::detectHardwareGeneration(const QString& deviceId)
{
    Q_UNUSED(deviceId);
    return true;
}

bool HardwareCompatibilityLayer::applyCompatibilityProfile(const QString& deviceId, 
                                                            const DriverCompatibilityProfile& profile)
{
    Q_UNUSED(deviceId);
    Q_UNUSED(profile);
    return true;
}

TransferResult HardwareCompatibilityLayer::performNativeTransfer(const QString& deviceId, 
                                                                  const QByteArray& data, 
                                                                  bool isWriteOperation)
{
    Q_UNUSED(deviceId);
    Q_UNUSED(isWriteOperation);
    
    TransferResult result;
    result.success = true;
    result.bytesTransferred = data.size();
    result.usedCompatibilityMode = false;
    result.usedFallbackMode = false;
    
    return result;
}

TransferResult HardwareCompatibilityLayer::performCompatibilityTransfer(const QString& deviceId, 
                                                                         const QByteArray& data, 
                                                                         bool isWriteOperation)
{
    Q_UNUSED(deviceId);
    Q_UNUSED(isWriteOperation);
    
    TransferResult result;
    result.success = true;
    result.bytesTransferred = data.size();
    result.usedCompatibilityMode = true;
    result.usedFallbackMode = false;
    
    return result;
}

TransferResult HardwareCompatibilityLayer::performFallbackTransfer(const QString& deviceId, 
                                                                     const QByteArray& data, 
                                                                     bool isWriteOperation)
{
    Q_UNUSED(deviceId);
    Q_UNUSED(isWriteOperation);
    
    TransferResult result;
    result.success = true;
    result.bytesTransferred = data.size();
    result.usedCompatibilityMode = true;
    result.usedFallbackMode = true;
    
    return result;
}

bool HardwareCompatibilityLayer::initializeLegacyDevice(const QString& deviceId)
{
    Q_UNUSED(deviceId);
    m_warnings[deviceId].append("Legacy device initialized - performance may be limited");
    emit warningRaised(deviceId, "Legacy device initialized - performance may be limited");
    return true;
}

bool HardwareCompatibilityLayer::initializeModernDevice(const QString& deviceId)
{
    Q_UNUSED(deviceId);
    return true;
}

void HardwareCompatibilityLayer::logTransferError(const QString& deviceId, const QString& error)
{
    m_lastErrors[deviceId] = error;
    
    if (m_errorLoggingEnabled) {
        qWarning() << "[HardwareCompatibility] Transfer error for device" << deviceId << ":" << error;
    }
}

void HardwareCompatibilityLayer::updateTransferStats(const QString& deviceId, const TransferResult& result)
{
    if (!m_transferStats.contains(deviceId)) {
        return;
    }
    
    QMap<QString, qint64>& stats = m_transferStats[deviceId];
    stats["totalTransfers"]++;
    
    if (result.success) {
        stats["successfulTransfers"]++;
        stats["totalBytes"] += result.bytesTransferred;
    } else {
        stats["failedTransfers"]++;
    }
    
    stats["totalTimeMs"] += result.totalTimeMs;
    stats["totalRetries"] += result.retryCount;
}
