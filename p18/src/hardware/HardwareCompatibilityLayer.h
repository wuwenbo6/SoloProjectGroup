#ifndef HARDWARECOMPATIBILITYLAYER_H
#define HARDWARECOMPATIBILITYLAYER_H

#include <QObject>
#include <QString>
#include <QMap>
#include <QVariant>
#include <QList>
#include <QUuid>

enum class HardwareGeneration {
    Gen_Unknown = 0,
    Gen_Legacy_ISA = 1,
    Gen_PCI = 2,
    Gen_PCIe = 3,
    Gen_USB1 = 4,
    Gen_USB2 = 5,
    Gen_USB3 = 6,
    Gen_Serial = 7,
    Gen_Parallel = 8
};

enum class DriverStatus {
    NotLoaded = 0,
    Loaded = 1,
    Failed = 2,
    CompatibilityMode = 3,
    FallbackMode = 4
};

struct HardwareDeviceInfo {
    QString deviceId;
    QString deviceName;
    QString manufacturer;
    QString serialNumber;
    HardwareGeneration generation;
    QString driverVersion;
    QString minDriverVersion;
    QString maxDriverVersion;
    bool requiresLegacyMode;
    bool supports64bit;
    bool supports32bit;
    int transferRateKbps;
    int maxBufferSizeKB;
    QMap<QString, QVariant> capabilities;
    
    HardwareDeviceInfo()
        : generation(HardwareGeneration::Gen_Unknown)
        , requiresLegacyMode(false)
        , supports64bit(true)
        , supports32bit(true)
        , transferRateKbps(0)
        , maxBufferSizeKB(64)
    {}
};

struct DriverCompatibilityProfile {
    QString profileId;
    QString targetDevicePattern;
    HardwareGeneration minGeneration;
    HardwareGeneration maxGeneration;
    bool useLegacyIO;
    bool useEmulationLayer;
    bool enableRetries;
    int maxRetries;
    int retryDelayMs;
    bool enableTimeoutAdjustment;
    int baseTimeoutMs;
    bool useSmallerBuffers;
    int maxTransferSizeBytes;
    bool enableErrorCorrection;
    QMap<QString, QVariant> driverSettings;
    
    DriverCompatibilityProfile()
        : minGeneration(HardwareGeneration::Gen_Unknown)
        , maxGeneration(HardwareGeneration::Gen_Unknown)
        , useLegacyIO(false)
        , useEmulationLayer(false)
        , enableRetries(true)
        , maxRetries(3)
        , retryDelayMs(100)
        , enableTimeoutAdjustment(true)
        , baseTimeoutMs(1000)
        , useSmallerBuffers(false)
        , maxTransferSizeBytes(4096)
        , enableErrorCorrection(true)
    {}
};

struct TransferResult {
    bool success;
    qint64 bytesTransferred;
    int retryCount;
    qint64 totalTimeMs;
    QString errorMessage;
    bool usedCompatibilityMode;
    bool usedFallbackMode;
    
    TransferResult()
        : success(false)
        , bytesTransferred(0)
        , retryCount(0)
        , totalTimeMs(0)
        , usedCompatibilityMode(false)
        , usedFallbackMode(false)
    {}
};

class HardwareCompatibilityLayer : public QObject
{
    Q_OBJECT
public:
    enum CompatibilityMode {
        AutoDetect = 0,
        NativeMode = 1,
        CompatibilityMode = 2,
        FallbackMode = 3,
        LegacyEmulation = 4
    };

    explicit HardwareCompatibilityLayer(QObject* parent = nullptr);
    ~HardwareCompatibilityLayer();

    void setCompatibilityMode(CompatibilityMode mode);
    CompatibilityMode getCompatibilityMode() const;

    bool registerDevice(const HardwareDeviceInfo& deviceInfo);
    bool unregisterDevice(const QString& deviceId);
    HardwareDeviceInfo getDeviceInfo(const QString& deviceId) const;
    QList<HardwareDeviceInfo> getAllDevices() const;

    bool registerCompatibilityProfile(const DriverCompatibilityProfile& profile);
    DriverCompatibilityProfile getBestProfileForDevice(const QString& deviceId) const;
    QList<DriverCompatibilityProfile> getAllProfiles() const;

    TransferResult performTransfer(const QString& deviceId, 
                                    const QByteArray& data, 
                                    bool isWriteOperation);
    
    TransferResult performTransferWithRetry(const QString& deviceId, 
                                            const QByteArray& data, 
                                            bool isWriteOperation,
                                            int customRetries = -1);

    bool initializeDevice(const QString& deviceId);
    bool shutdownDevice(const QString& deviceId);
    bool resetDevice(const QString& deviceId);

    DriverStatus getDriverStatus(const QString& deviceId) const;
    QString getLastError(const QString& deviceId) const;

    bool isLegacyDevice(const QString& deviceId) const;
    bool requiresEmulation(const QString& deviceId) const;
    
    void enablePerformanceOptimizations(bool enabled);
    void enableErrorLogging(bool enabled);
    
    QMap<QString, qint64> getTransferStatistics(const QString& deviceId) const;
    void resetStatistics(const QString& deviceId);

    bool exportDiagnosticsReport(const QString& filePath) const;
    QStringList getCompatibilityWarnings(const QString& deviceId) const;

signals:
    void deviceInitialized(const QString& deviceId, bool success);
    void deviceShutdown(const QString& deviceId);
    void transferCompleted(const QString& deviceId, const TransferResult& result);
    void compatibilityModeChanged(const QString& deviceId, CompatibilityMode mode);
    void driverStatusChanged(const QString& deviceId, DriverStatus status);
    void warningRaised(const QString& deviceId, const QString& warningMessage);

private:
    bool detectHardwareGeneration(const QString& deviceId);
    bool applyCompatibilityProfile(const QString& deviceId, 
                                   const DriverCompatibilityProfile& profile);
    TransferResult performNativeTransfer(const QString& deviceId, 
                                          const QByteArray& data, 
                                          bool isWriteOperation);
    TransferResult performCompatibilityTransfer(const QString& deviceId, 
                                                 const QByteArray& data, 
                                                 bool isWriteOperation);
    TransferResult performFallbackTransfer(const QString& deviceId, 
                                            const QByteArray& data, 
                                            bool isWriteOperation);
    
    bool initializeLegacyDevice(const QString& deviceId);
    bool initializeModernDevice(const QString& deviceId);
    
    void logTransferError(const QString& deviceId, const QString& error);
    void updateTransferStats(const QString& deviceId, const TransferResult& result);
    
    QMap<QString, HardwareDeviceInfo> m_devices;
    QMap<QString, DriverCompatibilityProfile> m_profiles;
    QMap<QString, DriverStatus> m_driverStatus;
    QMap<QString, QString> m_lastErrors;
    QMap<QString, QMap<QString, qint64>> m_transferStats;
    QMap<QString, QStringList> m_warnings;
    
    CompatibilityMode m_globalMode;
    bool m_performanceOptimizations;
    bool m_errorLoggingEnabled;
    int m_globalRetryCount;
    int m_globalRetryDelayMs;
};

#endif
