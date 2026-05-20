#ifndef CLOUDSYNCMANAGER_H
#define CLOUDSYNCMANAGER_H

#include <QObject>
#include <QString>
#include <QVariantMap>
#include <QDateTime>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QTimer>

struct SyncConfig {
    QString serverUrl;
    QString apiKey;
    QString userId;
    QString deviceId;
    bool autoSyncEnabled;
    int syncIntervalMinutes;
    bool syncConfigs;
    bool syncArchives;
    bool syncTapeModels;
    bool useEncryption;
    
    SyncConfig()
        : autoSyncEnabled(false)
        , syncIntervalMinutes(30)
        , syncConfigs(true)
        , syncArchives(true)
        , syncTapeModels(true)
        , useEncryption(true)
    {}
};

struct SyncLogEntry {
    QString logId;
    QDateTime timestamp;
    QString operation;
    QString status;
    QString details;
    qint64 bytesTransferred;
    int itemsSynced;
    
    SyncLogEntry()
        : bytesTransferred(0)
        , itemsSynced(0)
    {}
};

class CloudSyncManager : public QObject
{
    Q_OBJECT
public:
    enum SyncStatus {
        Idle,
        Syncing,
        Success,
        Failed,
        ConnectionError,
        AuthenticationError
    };
    
    explicit CloudSyncManager(QObject *parent = nullptr);
    ~CloudSyncManager();
    
    void setSyncConfig(const SyncConfig& config);
    SyncConfig getSyncConfig() const;
    
    bool isConnected() const;
    SyncStatus getCurrentStatus() const;
    QString getStatusMessage() const;
    
    bool testConnection();
    void startAutoSync();
    void stopAutoSync();
    
    bool pushAllConfigs();
    bool pullAllConfigs();
    bool pushConfig(const QString& configId, const QVariantMap& configData);
    QVariantMap pullConfig(const QString& configId);
    
    bool pushArchiveEntry(const QString& entryId);
    bool pullArchiveEntry(const QString& entryId);
    bool pushAllArchives();
    bool pullAllArchives();
    
    bool pushTapeModel(const QString& modelId);
    bool pullTapeModel(const QString& modelId);
    bool pushAllTapeModels();
    bool pullAllTapeModels();
    
    QList<SyncLogEntry> getSyncHistory(int limit = 50) const;
    void clearSyncHistory();
    
    qint64 getTotalSyncedBytes() const;
    int getTotalSyncedItems() const;
    
    bool exportSyncConfig(const QString& filePath);
    bool importSyncConfig(const QString& filePath);

signals:
    void syncStarted();
    void syncProgress(int percent, const QString& message);
    void syncCompleted(bool success);
    void statusChanged(SyncStatus status);
    void connectionStateChanged(bool connected);
    void configSynced(const QString& configId);
    void archiveSynced(const QString& entryId);
    void tapeModelSynced(const QString& modelId);
    void syncError(const QString& errorMessage);

private slots:
    void onAutoSyncTimer();
    void onNetworkReplyFinished(QNetworkReply* reply);
    void onNetworkError(QNetworkReply::NetworkError error);

private:
    bool uploadData(const QString& endpoint, const QVariantMap& data);
    QVariantMap downloadData(const QString& endpoint);
    bool authenticate();
    
    QString generateSignature(const QString& data) const;
    QByteArray encryptData(const QByteArray& data) const;
    QByteArray decryptData(const QByteArray& data) const;
    
    void addSyncLog(const QString& operation, const QString& status, 
                    const QString& details, qint64 bytes = 0, int items = 0);
    
    SyncConfig m_syncConfig;
    QNetworkAccessManager* m_networkManager;
    QTimer* m_autoSyncTimer;
    
    SyncStatus m_currentStatus;
    QString m_statusMessage;
    bool m_isConnected;
    QString m_authToken;
    
    QList<SyncLogEntry> m_syncHistory;
    qint64 m_totalSyncedBytes;
    int m_totalSyncedItems;
    
    int m_currentSyncProgress;
    QString m_currentSyncOperation;
};

#endif
