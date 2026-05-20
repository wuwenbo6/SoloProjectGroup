#ifndef MEDIAARCHIVEMANAGER_H
#define MEDIAARCHIVEMANAGER_H

#include <QObject>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QDateTime>
#include "../config/TranscriptionConfig.h"

struct TapeMediaInfo {
    QString tapeId;
    QString tapeModelId;
    QString tapeName;
    QString manufacturer;
    QString tapeType;
    QString tapeFormat;
    int lengthMinutes;
    QDate productionDate;
    QDate recordingDate;
    QString condition;
    int generation;
    QString shelfLocation;
    QString boxNumber;
    QString originalOwner;
    QString recordingDevice;
    
    TapeMediaInfo()
        : lengthMinutes(0)
        , generation(1)
    {}
};

struct MediaArchiveEntry {
    QString entryId;
    QString tapeModelId;
    QString tapeName;
    QString contentDescription;
    QDateTime recordingDate;
    QDateTime digitizationDate;
    QString outputFilePath;
    QString thumbnailPath;
    int durationSeconds;
    qint64 fileSize;
    QString checksum;
    QString notes;
    QStringList tags;
    
    TapeMediaInfo mediaInfo;
    
    QStringList sceneMarkers;
    QStringList chapterTitles;
    QStringList peopleInVideo;
    QStringList locations;
    
    QString transcriptionEngineer;
    QString transcriptionDeviceId;
    QString batchJobId;
    
    int colorCorrectionProfile;
    int noiseReductionLevel;
    
    AudioConfig usedAudioConfig;
    VideoConfig usedVideoConfig;
    DenoiseParameters usedDenoiseParams;
    
    MediaArchiveEntry()
        : durationSeconds(0)
        , fileSize(0)
        , colorCorrectionProfile(0)
        , noiseReductionLevel(50)
    {}
};

struct BatchTranscriptionJob {
    QString jobId;
    QString name;
    QDateTime createdDate;
    QDateTime startedDate;
    QDateTime completedDate;
    QString status;
    int totalItems;
    int completedItems;
    QStringList tapeModelIds;
    QString outputDirectory;
    
    BatchTranscriptionJob()
        : totalItems(0)
        , completedItems(0)
    {}
};

class MediaArchiveManager : public QObject
{
    Q_OBJECT
public:
    explicit MediaArchiveManager(QObject *parent = nullptr);
    ~MediaArchiveManager();
    
    bool initializeDatabase(const QString& dbPath = QString());
    bool isDatabaseReady() const;
    
    QString addArchiveEntry(const MediaArchiveEntry& entry);
    bool updateArchiveEntry(const MediaArchiveEntry& entry);
    bool removeArchiveEntry(const QString& entryId);
    MediaArchiveEntry getArchiveEntry(const QString& entryId) const;
    QList<MediaArchiveEntry> getAllEntries() const;
    QList<MediaArchiveEntry> searchEntries(const QString& keyword, 
        const QString& tapeModelId = QString(), 
        const QDate& fromDate = QDate(),
        const QDate& toDate = QDate()) const;
    
    QString createBatchJob(const BatchTranscriptionJob& job);
    bool updateBatchJob(const BatchTranscriptionJob& job);
    BatchTranscriptionJob getBatchJob(const QString& jobId) const;
    QList<BatchTranscriptionJob> getAllBatchJobs() const;
    bool deleteBatchJob(const QString& jobId);
    
    bool exportEntryMetadata(const QString& entryId, const QString& filePath);
    bool importEntryMetadata(const QString& filePath);
    
    qint64 getTotalArchiveSize() const;
    int getTotalEntryCount() const;

signals:
    void entryAdded(const QString& entryId);
    void entryUpdated(const QString& entryId);
    void entryRemoved(const QString& entryId);
    void batchJobCreated(const QString& jobId);
    void batchJobUpdated(const QString& jobId);
    void databaseError(const QString& error);

private:
    bool createTables();
    void bindArchiveEntry(QSqlQuery& query, const MediaArchiveEntry& entry);
    MediaArchiveEntry entryFromQuery(QSqlQuery& query) const;
    
    QSqlDatabase m_database;
    bool m_isReady;
};

#endif
