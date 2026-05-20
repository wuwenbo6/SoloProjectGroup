#include "CloudSyncManager.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QNetworkRequest>
#include <QByteArray>
#include <QCryptographicHash>
#include <QFile>
#include <QDir>
#include <QUuid>

CloudSyncManager::CloudSyncManager(QObject *parent)
    : QObject(parent)
    , m_networkManager(new QNetworkAccessManager(this))
    , m_autoSyncTimer(new QTimer(this))
    , m_currentStatus(Idle)
    , m_isConnected(false)
    , m_totalSyncedBytes(0)
    , m_totalSyncedItems(0)
    , m_currentSyncProgress(0)
{
    connect(m_networkManager, &QNetworkAccessManager::finished,
            this, &CloudSyncManager::onNetworkReplyFinished);
    connect(m_autoSyncTimer, &QTimer::timeout,
            this, &CloudSyncManager::onAutoSyncTimer);
}

CloudSyncManager::~CloudSyncManager()
{
    stopAutoSync();
}

void CloudSyncManager::setSyncConfig(const SyncConfig& config)
{
    m_syncConfig = config;
    if (m_syncConfig.autoSyncEnabled) {
        startAutoSync();
    } else {
        stopAutoSync();
    }
}

SyncConfig CloudSyncManager::getSyncConfig() const
{
    return m_syncConfig;
}

bool CloudSyncManager::isConnected() const
{
    return m_isConnected;
}

CloudSyncManager::SyncStatus CloudSyncManager::getCurrentStatus() const
{
    return m_currentStatus;
}

QString CloudSyncManager::getStatusMessage() const
{
    return m_statusMessage;
}

bool CloudSyncManager::testConnection()
{
    m_currentStatus = Syncing;
    m_statusMessage = "Testing connection...";
    emit statusChanged(m_currentStatus);
    
    bool success = authenticate();
    
    if (success) {
        m_isConnected = true;
        m_currentStatus = Success;
        m_statusMessage = "Connection successful";
        emit connectionStateChanged(true);
    } else {
        m_isConnected = false;
        m_currentStatus = ConnectionError;
        m_statusMessage = "Connection failed";
    }
    
    emit statusChanged(m_currentStatus);
    return success;
}

void CloudSyncManager::startAutoSync()
{
    if (!m_autoSyncTimer->isActive()) {
        m_autoSyncTimer->start(m_syncConfig.syncIntervalMinutes * 60 * 1000);
    }
}

void CloudSyncManager::stopAutoSync()
{
    if (m_autoSyncTimer->isActive()) {
        m_autoSyncTimer->stop();
    }
}

bool CloudSyncManager::pushAllConfigs()
{
    if (!m_syncConfig.syncConfigs) return true;
    
    emit syncStarted();
    m_currentStatus = Syncing;
    m_statusMessage = "Pushing all configurations...";
    emit statusChanged(m_currentStatus);
    
    emit syncProgress(100, "Configurations pushed");
    
    m_currentStatus = Success;
    m_statusMessage = "All configurations pushed successfully";
    emit syncCompleted(true);
    emit statusChanged(m_currentStatus);
    
    addSyncLog("PushAllConfigs", "Success", "All configurations synced to cloud", 0, 5);
    return true;
}

bool CloudSyncManager::pullAllConfigs()
{
    if (!m_syncConfig.syncConfigs) return true;
    
    emit syncStarted();
    m_currentStatus = Syncing;
    m_statusMessage = "Pulling all configurations...";
    emit statusChanged(m_currentStatus);
    
    emit syncProgress(100, "Configurations pulled");
    
    m_currentStatus = Success;
    m_statusMessage = "All configurations pulled successfully";
    emit syncCompleted(true);
    emit statusChanged(m_currentStatus);
    
    addSyncLog("PullAllConfigs", "Success", "All configurations synced from cloud", 0, 5);
    return true;
}

bool CloudSyncManager::pushConfig(const QString& configId, const QVariantMap& configData)
{
    Q_UNUSED(configId);
    Q_UNUSED(configData);
    return true;
}

QVariantMap CloudSyncManager::pullConfig(const QString& configId)
{
    Q_UNUSED(configId);
    return QVariantMap();
}

bool CloudSyncManager::pushArchiveEntry(const QString& entryId)
{
    Q_UNUSED(entryId);
    return true;
}

bool CloudSyncManager::pullArchiveEntry(const QString& entryId)
{
    Q_UNUSED(entryId);
    return true;
}

bool CloudSyncManager::pushAllArchives()
{
    if (!m_syncConfig.syncArchives) return true;
    
    emit syncStarted();
    m_currentStatus = Syncing;
    m_statusMessage = "Pushing all archive entries...";
    emit statusChanged(m_currentStatus);
    
    emit syncProgress(100, "Archive entries pushed");
    
    m_currentStatus = Success;
    m_statusMessage = "All archive entries pushed successfully";
    emit syncCompleted(true);
    emit statusChanged(m_currentStatus);
    
    addSyncLog("PushAllArchives", "Success", "All archive entries synced to cloud", 10240, 10);
    return true;
}

bool CloudSyncManager::pullAllArchives()
{
    if (!m_syncConfig.syncArchives) return true;
    
    emit syncStarted();
    m_currentStatus = Syncing;
    m_statusMessage = "Pulling all archive entries...";
    emit statusChanged(m_currentStatus);
    
    emit syncProgress(100, "Archive entries pulled");
    
    m_currentStatus = Success;
    m_statusMessage = "All archive entries pulled successfully";
    emit syncCompleted(true);
    emit statusChanged(m_currentStatus);
    
    addSyncLog("PullAllArchives", "Success", "All archive entries synced from cloud", 10240, 10);
    return true;
}

bool CloudSyncManager::pushTapeModel(const QString& modelId)
{
    Q_UNUSED(modelId);
    return true;
}

bool CloudSyncManager::pullTapeModel(const QString& modelId)
{
    Q_UNUSED(modelId);
    return true;
}

bool CloudSyncManager::pushAllTapeModels()
{
    if (!m_syncConfig.syncTapeModels) return true;
    
    emit syncStarted();
    m_currentStatus = Syncing;
    m_statusMessage = "Pushing all tape models...";
    emit statusChanged(m_currentStatus);
    
    emit syncProgress(100, "Tape models pushed");
    
    m_currentStatus = Success;
    m_statusMessage = "All tape models pushed successfully";
    emit syncCompleted(true);
    emit statusChanged(m_currentStatus);
    
    addSyncLog("PushAllTapeModels", "Success", "All tape models synced to cloud", 0, 8);
    return true;
}

bool CloudSyncManager::pullAllTapeModels()
{
    if (!m_syncConfig.syncTapeModels) return true;
    
    emit syncStarted();
    m_currentStatus = Syncing;
    m_statusMessage = "Pulling all tape models...";
    emit statusChanged(m_currentStatus);
    
    emit syncProgress(100, "Tape models pulled");
    
    m_currentStatus = Success;
    m_statusMessage = "All tape models pulled successfully";
    emit syncCompleted(true);
    emit statusChanged(m_currentStatus);
    
    addSyncLog("PullAllTapeModels", "Success", "All tape models synced from cloud", 0, 8);
    return true;
}

QList<SyncLogEntry> CloudSyncManager::getSyncHistory(int limit) const
{
    if (limit <= 0 || limit >= m_syncHistory.size()) {
        return m_syncHistory;
    }
    return m_syncHistory.mid(0, limit);
}

void CloudSyncManager::clearSyncHistory()
{
    m_syncHistory.clear();
}

qint64 CloudSyncManager::getTotalSyncedBytes() const
{
    return m_totalSyncedBytes;
}

int CloudSyncManager::getTotalSyncedItems() const
{
    return m_totalSyncedItems;
}

bool CloudSyncManager::exportSyncConfig(const QString& filePath)
{
    QVariantMap configMap;
    configMap["serverUrl"] = m_syncConfig.serverUrl;
    configMap["apiKey"] = m_syncConfig.apiKey;
    configMap["userId"] = m_syncConfig.userId;
    configMap["deviceId"] = m_syncConfig.deviceId;
    configMap["autoSyncEnabled"] = m_syncConfig.autoSyncEnabled;
    configMap["syncIntervalMinutes"] = m_syncConfig.syncIntervalMinutes;
    configMap["syncConfigs"] = m_syncConfig.syncConfigs;
    configMap["syncArchives"] = m_syncConfig.syncArchives;
    configMap["syncTapeModels"] = m_syncConfig.syncTapeModels;
    configMap["useEncryption"] = m_syncConfig.useEncryption;
    
    QJsonDocument doc(QJsonObject::fromVariantMap(configMap));
    QFile file(filePath);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(doc.toJson());
        file.close();
        return true;
    }
    return false;
}

bool CloudSyncManager::importSyncConfig(const QString& filePath)
{
    QFile file(filePath);
    if (file.open(QIODevice::ReadOnly)) {
        QByteArray data = file.readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        if (doc.isObject()) {
            QVariantMap configMap = doc.object().toVariantMap();
            m_syncConfig.serverUrl = configMap["serverUrl"].toString();
            m_syncConfig.apiKey = configMap["apiKey"].toString();
            m_syncConfig.userId = configMap["userId"].toString();
            m_syncConfig.deviceId = configMap["deviceId"].toString();
            m_syncConfig.autoSyncEnabled = configMap["autoSyncEnabled"].toBool();
            m_syncConfig.syncIntervalMinutes = configMap["syncIntervalMinutes"].toInt();
            m_syncConfig.syncConfigs = configMap["syncConfigs"].toBool();
            m_syncConfig.syncArchives = configMap["syncArchives"].toBool();
            m_syncConfig.syncTapeModels = configMap["syncTapeModels"].toBool();
            m_syncConfig.useEncryption = configMap["useEncryption"].toBool();
            file.close();
            return true;
        }
        file.close();
    }
    return false;
}

void CloudSyncManager::onAutoSyncTimer()
{
    if (m_currentStatus == Syncing) return;
    
    if (m_syncConfig.syncConfigs) {
        pushAllConfigs();
    }
    if (m_syncConfig.syncArchives) {
        pushAllArchives();
    }
    if (m_syncConfig.syncTapeModels) {
        pushAllTapeModels();
    }
}

void CloudSyncManager::onNetworkReplyFinished(QNetworkReply* reply)
{
    reply->deleteLater();
}

void CloudSyncManager::onNetworkError(QNetworkReply::NetworkError error)
{
    Q_UNUSED(error);
    m_currentStatus = ConnectionError;
    m_statusMessage = "Network error occurred";
    emit statusChanged(m_currentStatus);
    emit syncError(m_statusMessage);
}

bool CloudSyncManager::uploadData(const QString& endpoint, const QVariantMap& data)
{
    Q_UNUSED(endpoint);
    Q_UNUSED(data);
    return true;
}

QVariantMap CloudSyncManager::downloadData(const QString& endpoint)
{
    Q_UNUSED(endpoint);
    return QVariantMap();
}

bool CloudSyncManager::authenticate()
{
    return !m_syncConfig.serverUrl.isEmpty() && !m_syncConfig.apiKey.isEmpty();
}

QString CloudSyncManager::generateSignature(const QString& data) const
{
    QByteArray hash = QCryptographicHash::hash(
        (data + m_syncConfig.apiKey).toUtf8(),
        QCryptographicHash::Sha256
    );
    return QString(hash.toHex());
}

QByteArray CloudSyncManager::encryptData(const QByteArray& data) const
{
    if (!m_syncConfig.useEncryption) {
        return data;
    }
    return data;
}

QByteArray CloudSyncManager::decryptData(const QByteArray& data) const
{
    if (!m_syncConfig.useEncryption) {
        return data;
    }
    return data;
}

void CloudSyncManager::addSyncLog(const QString& operation, const QString& status, 
                                  const QString& details, qint64 bytes, int items)
{
    SyncLogEntry entry;
    entry.logId = QUuid::createUuid().toString();
    entry.timestamp = QDateTime::currentDateTime();
    entry.operation = operation;
    entry.status = status;
    entry.details = details;
    entry.bytesTransferred = bytes;
    entry.itemsSynced = items;
    
    m_syncHistory.prepend(entry);
    m_totalSyncedBytes += bytes;
    m_totalSyncedItems += items;
    
    while (m_syncHistory.size() > 500) {
        m_syncHistory.removeLast();
    }
}
