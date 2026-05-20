#include "MediaArchiveManager.h"
#include <QSqlError>
#include <QVariant>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QDebug>
#include <QUuid>
#include <QStandardPaths>

MediaArchiveManager::MediaArchiveManager(QObject *parent)
    : QObject(parent)
    , m_isReady(false)
{
}

MediaArchiveManager::~MediaArchiveManager()
{
    if (m_database.isOpen()) {
        m_database.close();
    }
}

bool MediaArchiveManager::initializeDatabase(const QString& dbPath)
{
    QString path = dbPath;
    if (path.isEmpty()) {
        path = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/media_archive.db";
    }
    
    m_database = QSqlDatabase::addDatabase("QSQLITE");
    m_database.setDatabaseName(path);
    
    if (!m_database.open()) {
        emit databaseError(m_database.lastError().text());
        return false;
    }
    
    m_isReady = createTables();
    return m_isReady;
}

bool MediaArchiveManager::isDatabaseReady() const
{
    return m_isReady;
}

bool MediaArchiveManager::createTables()
{
    QSqlQuery query;
    
    QString createArchive = R"(
        CREATE TABLE IF NOT EXISTS archive_entries (
            entry_id TEXT PRIMARY KEY,
            tape_model_id TEXT,
            tape_name TEXT,
            content_description TEXT,
            recording_date TEXT,
            digitization_date TEXT,
            output_file_path TEXT,
            thumbnail_path TEXT,
            duration_seconds INTEGER,
            file_size INTEGER,
            checksum TEXT,
            notes TEXT,
            tags TEXT,
            audio_config TEXT,
            video_config TEXT,
            denoise_params TEXT
        )
    )";
    
    if (!query.exec(createArchive)) {
        emit databaseError(query.lastError().text());
        return false;
    }
    
    QString createBatch = R"(
        CREATE TABLE IF NOT EXISTS batch_jobs (
            job_id TEXT PRIMARY KEY,
            name TEXT,
            created_date TEXT,
            started_date TEXT,
            completed_date TEXT,
            status TEXT,
            total_items INTEGER,
            completed_items INTEGER,
            tape_model_ids TEXT,
            output_directory TEXT
        )
    )";
    
    if (!query.exec(createBatch)) {
        emit databaseError(query.lastError().text());
        return false;
    }
    
    return true;
}

QString MediaArchiveManager::addArchiveEntry(const MediaArchiveEntry& entry)
{
    if (!m_isReady) return QString();
    
    QSqlQuery query;
    query.prepare(R"(
        INSERT INTO archive_entries (
            entry_id, tape_model_id, tape_name, content_description,
            recording_date, digitization_date, output_file_path,
            thumbnail_path, duration_seconds, file_size, checksum,
            notes, tags, audio_config, video_config, denoise_params
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    )");
    
    QString id = entry.entryId.isEmpty() ? QUuid::createUuid().toString() : entry.entryId;
    query.addBindValue(id);
    bindArchiveEntry(query, entry);
    
    if (query.exec()) {
        emit entryAdded(id);
        return id;
    }
    
    emit databaseError(query.lastError().text());
    return QString();
}

bool MediaArchiveManager::updateArchiveEntry(const MediaArchiveEntry& entry)
{
    if (!m_isReady) return false;
    
    QSqlQuery query;
    query.prepare(R"(
        UPDATE archive_entries SET
            tape_model_id = ?, tape_name = ?, content_description = ?,
            recording_date = ?, digitization_date = ?, output_file_path = ?,
            thumbnail_path = ?, duration_seconds = ?, file_size = ?, checksum = ?,
            notes = ?, tags = ?, audio_config = ?, video_config = ?, denoise_params = ?
        WHERE entry_id = ?
    )";
    
    bindArchiveEntry(query, entry);
    query.addBindValue(entry.entryId);
    
    if (query.exec()) {
        emit entryUpdated(entry.entryId);
        return true;
    }
    
    emit databaseError(query.lastError().text());
    return false;
}

bool MediaArchiveManager::removeArchiveEntry(const QString& entryId)
{
    if (!m_isReady) return false;
    
    QSqlQuery query;
    query.prepare("DELETE FROM archive_entries WHERE entry_id = ?");
    query.addBindValue(entryId);
    
    if (query.exec()) {
        emit entryRemoved(entryId);
        return true;
    }
    
    emit databaseError(query.lastError().text());
    return false;
}

MediaArchiveEntry MediaArchiveManager::getArchiveEntry(const QString& entryId) const
{
    MediaArchiveEntry entry;
    
    if (!m_isReady) return entry;
    
    QSqlQuery query;
    query.prepare("SELECT * FROM archive_entries WHERE entry_id = ?");
    query.addBindValue(entryId);
    
    if (query.exec() && query.next()) {
        entry = entryFromQuery(query);
    }
    
    return entry;
}

QList<MediaArchiveEntry> MediaArchiveManager::getAllEntries() const
{
    QList<MediaArchiveEntry> entries;
    
    if (!m_isReady) return entries;
    
    QSqlQuery query("SELECT * FROM archive_entries ORDER BY digitization_date DESC");
    
    while (query.next()) {
        entries.append(entryFromQuery(query));
    }
    
    return entries;
}

QList<MediaArchiveEntry> MediaArchiveManager::searchEntries(const QString& keyword,
    const QString& tapeModelId, const QDate& fromDate, const QDate& toDate) const
{
    QList<MediaArchiveEntry> entries;
    
    if (!m_isReady) return entries;
    
    QStringList conditions;
    QVariantList bindValues;
    
    if (!keyword.isEmpty()) {
        conditions.append("(tape_name LIKE ? OR content_description LIKE ? OR notes LIKE ? OR tags LIKE ?)");
        QString likePattern = "%" + keyword + "%";
        bindValues << likePattern << likePattern << likePattern << likePattern;
    }
    
    if (!tapeModelId.isEmpty()) {
        conditions.append("tape_model_id = ?");
        bindValues << tapeModelId;
    }
    
    if (fromDate.isValid()) {
        conditions.append("DATE(digitization_date) >= DATE(?)");
        bindValues << fromDate.toString(Qt::ISODate);
    }
    
    if (toDate.isValid()) {
        conditions.append("DATE(digitization_date) <= DATE(?)");
        bindValues << toDate.toString(Qt::ISODate);
    }
    
    QString sql = "SELECT * FROM archive_entries";
    if (!conditions.isEmpty()) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY digitization_date DESC";
    
    QSqlQuery query;
    query.prepare(sql);
    
    for (const QVariant& val : bindValues) {
        query.addBindValue(val);
    }
    
    if (query.exec()) {
        while (query.next()) {
            entries.append(entryFromQuery(query));
        }
    }
    
    return entries;
}

QString MediaArchiveManager::createBatchJob(const BatchTranscriptionJob& job)
{
    if (!m_isReady) return QString();
    
    QSqlQuery query;
    query.prepare(R"(
        INSERT INTO batch_jobs (
            job_id, name, created_date, started_date, completed_date,
            status, total_items, completed_items, tape_model_ids, output_directory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    )";
    
    QString id = job.jobId.isEmpty() ? QUuid::createUuid().toString() : job.jobId;
    query.addBindValue(id);
    query.addBindValue(job.name);
    query.addBindValue(job.createdDate.toString(Qt::ISODate));
    query.addBindValue(job.startedDate.toString(Qt::ISODate));
    query.addBindValue(job.completedDate.toString(Qt::ISODate));
    query.addBindValue(job.status);
    query.addBindValue(job.totalItems);
    query.addBindValue(job.completedItems);
    query.addBindValue(job.tapeModelIds.join(","));
    query.addBindValue(job.outputDirectory);
    
    if (query.exec()) {
        emit batchJobCreated(id);
        return id;
    }
    
    emit databaseError(query.lastError().text());
    return QString();
}

bool MediaArchiveManager::updateBatchJob(const BatchTranscriptionJob& job)
{
    if (!m_isReady) return false;
    
    QSqlQuery query;
    query.prepare(R"(
        UPDATE batch_jobs SET
            name = ?, created_date = ?, started_date = ?, completed_date = ?,
            status = ?, total_items = ?, completed_items = ?, tape_model_ids = ?, output_directory = ?
        WHERE job_id = ?
    )";
    
    query.addBindValue(job.name);
    query.addBindValue(job.createdDate.toString(Qt::ISODate));
    query.addBindValue(job.startedDate.toString(Qt::ISODate));
    query.addBindValue(job.completedDate.toString(Qt::ISODate));
    query.addBindValue(job.status);
    query.addBindValue(job.totalItems);
    query.addBindValue(job.completedItems);
    query.addBindValue(job.tapeModelIds.join(","));
    query.addBindValue(job.outputDirectory);
    query.addBindValue(job.jobId);
    
    if (query.exec()) {
        emit batchJobUpdated(job.jobId);
        return true;
    }
    
    emit databaseError(query.lastError().text());
    return false;
}

BatchTranscriptionJob MediaArchiveManager::getBatchJob(const QString& jobId) const
{
    BatchTranscriptionJob job;
    
    if (!m_isReady) return job;
    
    QSqlQuery query;
    query.prepare("SELECT * FROM batch_jobs WHERE job_id = ?");
    query.addBindValue(jobId);
    
    if (query.exec() && query.next()) {
        job.jobId = query.value("job_id").toString();
        job.name = query.value("name").toString();
        job.createdDate = QDateTime::fromString(query.value("created_date").toString(), Qt::ISODate);
        job.startedDate = QDateTime::fromString(query.value("started_date").toString(), Qt::ISODate);
        job.completedDate = QDateTime::fromString(query.value("completed_date").toString(), Qt::ISODate);
        job.status = query.value("status").toString();
        job.totalItems = query.value("total_items").toInt();
        job.completedItems = query.value("completed_items").toInt();
        job.tapeModelIds = query.value("tape_model_ids").toString().split(",", Qt::SkipEmptyParts);
        job.outputDirectory = query.value("output_directory").toString();
    }
    
    return job;
}

QList<BatchTranscriptionJob> MediaArchiveManager::getAllBatchJobs() const
{
    QList<BatchTranscriptionJob> jobs;
    
    if (!m_isReady) return jobs;
    
    QSqlQuery query("SELECT * FROM batch_jobs ORDER BY created_date DESC");
    
    while (query.next()) {
        BatchTranscriptionJob job;
        job.jobId = query.value("job_id").toString();
        job.name = query.value("name").toString();
        job.createdDate = QDateTime::fromString(query.value("created_date").toString(), Qt::ISODate);
        job.startedDate = QDateTime::fromString(query.value("started_date").toString(), Qt::ISODate);
        job.completedDate = QDateTime::fromString(query.value("completed_date").toString(), Qt::ISODate);
        job.status = query.value("status").toString();
        job.totalItems = query.value("total_items").toInt();
        job.completedItems = query.value("completed_items").toInt();
        job.tapeModelIds = query.value("tape_model_ids").toString().split(",", Qt::SkipEmptyParts);
        job.outputDirectory = query.value("output_directory").toString();
        jobs.append(job);
    }
    
    return jobs;
}

bool MediaArchiveManager::deleteBatchJob(const QString& jobId)
{
    if (!m_isReady) return false;
    
    QSqlQuery query;
    query.prepare("DELETE FROM batch_jobs WHERE job_id = ?");
    query.addBindValue(jobId);
    return query.exec();
}

bool MediaArchiveManager::exportEntryMetadata(const QString& entryId, const QString& filePath)
{
    MediaArchiveEntry entry = getArchiveEntry(entryId);
    if (entry.entryId.isEmpty()) {
        return false;
    }
    
    QVariantMap map;
    map["entryId"] = entry.entryId;
    map["tapeModelId"] = entry.tapeModelId;
    map["tapeName"] = entry.tapeName;
    map["contentDescription"] = entry.contentDescription;
    map["recordingDate"] = entry.recordingDate.toString(Qt::ISODate);
    map["digitizationDate"] = entry.digitizationDate.toString(Qt::ISODate);
    map["outputFilePath"] = entry.outputFilePath;
    map["durationSeconds"] = entry.durationSeconds;
    map["fileSize"] = qlonglong(entry.fileSize);
    map["checksum"] = entry.checksum;
    map["notes"] = entry.notes;
    map["tags"] = entry.tags;
    
    QJsonDocument doc = QJsonDocument::fromVariant(map);
    
    QFile file(filePath);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(doc.toJson());
        file.close();
        return true;
    }
    
    return false;
}

bool MediaArchiveManager::importEntryMetadata(const QString& filePath)
{
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly)) {
        return false;
    }
    
    QByteArray data = file.readAll();
    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (!doc.isObject()) {
        return false;
    }
    
    QVariantMap map = doc.object().toVariantMap();
    
    MediaArchiveEntry entry;
    entry.entryId = map["entryId"].toString();
    entry.tapeModelId = map["tapeModelId"].toString();
    entry.tapeName = map["tapeName"].toString();
    entry.contentDescription = map["contentDescription"].toString();
    entry.recordingDate = QDateTime::fromString(map["recordingDate"].toString(), Qt::ISODate);
    entry.digitizationDate = QDateTime::fromString(map["digitizationDate"].toString(), Qt::ISODate);
    entry.outputFilePath = map["outputFilePath"].toString();
    entry.durationSeconds = map["durationSeconds"].toInt();
    entry.fileSize = map["fileSize"].toLongLong();
    entry.checksum = map["checksum"].toString();
    entry.notes = map["notes"].toString();
    entry.tags = map["tags"].toStringList();
    
    return !addArchiveEntry(entry).isEmpty();
}

qint64 MediaArchiveManager::getTotalArchiveSize() const
{
    if (!m_isReady) return 0;
    
    QSqlQuery query("SELECT SUM(file_size) FROM archive_entries");
    if (query.next()) {
        return query.value(0).toLongLong();
    }
    
    return 0;
}

int MediaArchiveManager::getTotalEntryCount() const
{
    if (!m_isReady) return 0;
    
    QSqlQuery query("SELECT COUNT(*) FROM archive_entries");
    if (query.next()) {
        return query.value(0).toInt();
    }
    
    return 0;
}

void MediaArchiveManager::bindArchiveEntry(QSqlQuery& query, const MediaArchiveEntry& entry)
{
    query.addBindValue(entry.tapeModelId);
    query.addBindValue(entry.tapeName);
    query.addBindValue(entry.contentDescription);
    query.addBindValue(entry.recordingDate.toString(Qt::ISODate));
    query.addBindValue(entry.digitizationDate.toString(Qt::ISODate));
    query.addBindValue(entry.outputFilePath);
    query.addBindValue(entry.thumbnailPath);
    query.addBindValue(entry.durationSeconds);
    query.addBindValue(qlonglong(entry.fileSize));
    query.addBindValue(entry.checksum);
    query.addBindValue(entry.notes);
    query.addBindValue(entry.tags.join(","));
    
    QVariantMap audioConfig;
    audioConfig["sampleRate"] = entry.usedAudioConfig.sampleRate;
    audioConfig["channelCount"] = entry.usedAudioConfig.channelCount;
    query.addBindValue(QJsonDocument::fromVariant(audioConfig).toJson());
    
    QVariantMap videoConfig;
    videoConfig["width"] = entry.usedVideoConfig.width;
    videoConfig["height"] = entry.usedVideoConfig.height;
    query.addBindValue(QJsonDocument::fromVariant(videoConfig).toJson());
    
    QVariantMap denoiseParams;
    denoiseParams["luminanceStrength"] = entry.usedDenoiseParams.luminanceStrength;
    query.addBindValue(QJsonDocument::fromVariant(denoiseParams).toJson());
}

MediaArchiveEntry MediaArchiveManager::entryFromQuery(QSqlQuery& query) const
{
    MediaArchiveEntry entry;
    entry.entryId = query.value("entry_id").toString();
    entry.tapeModelId = query.value("tape_model_id").toString();
    entry.tapeName = query.value("tape_name").toString();
    entry.contentDescription = query.value("content_description").toString();
    entry.recordingDate = QDateTime::fromString(query.value("recording_date").toString(), Qt::ISODate);
    entry.digitizationDate = QDateTime::fromString(query.value("digitization_date").toString(), Qt::ISODate);
    entry.outputFilePath = query.value("output_file_path").toString();
    entry.thumbnailPath = query.value("thumbnail_path").toString();
    entry.durationSeconds = query.value("duration_seconds").toInt();
    entry.fileSize = query.value("file_size").toLongLong();
    entry.checksum = query.value("checksum").toString();
    entry.notes = query.value("notes").toString();
    entry.tags = query.value("tags").toString().split(",", Qt::SkipEmptyParts);
    
    QJsonDocument audioDoc = QJsonDocument::fromJson(query.value("audio_config").toByteArray());
    if (audioDoc.isObject()) {
        QVariantMap audioMap = audioDoc.object().toVariantMap();
        entry.usedAudioConfig.sampleRate = audioMap["sampleRate"].toInt();
        entry.usedAudioConfig.channelCount = audioMap["channelCount"].toInt();
    }
    
    QJsonDocument videoDoc = QJsonDocument::fromJson(query.value("video_config").toByteArray());
    if (videoDoc.isObject()) {
        QVariantMap videoMap = videoDoc.object().toVariantMap();
        entry.usedVideoConfig.width = videoMap["width"].toInt();
        entry.usedVideoConfig.height = videoMap["height"].toInt();
    }
    
    QJsonDocument denoiseDoc = QJsonDocument::fromJson(query.value("denoise_params").toByteArray());
    if (denoiseDoc.isObject()) {
        QVariantMap denoiseMap = denoiseDoc.object().toVariantMap();
        entry.usedDenoiseParams.luminanceStrength = denoiseMap["luminanceStrength"].toFloat();
    }
    
    return entry;
}
