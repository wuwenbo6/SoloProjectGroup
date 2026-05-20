#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QTabWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QLabel>
#include <QComboBox>
#include <QSlider>
#include <QSpinBox>
#include <QDoubleSpinBox>
#include <QTableWidget>
#include <QProgressBar>
#include <QGroupBox>
#include <QCheckBox>
#include <QFileDialog>
#include <QMessageBox>
#include <QInputDialog>
#include <QListWidget>
#include <QLineEdit>
#include <QTextEdit>
#include <QFormLayout>

#include "hardware/HardwareDriver.h"
#include "hardware/RingBuffer.h"
#include "hardware/DeviceScheduler.h"
#include "audio/AudioWaveformParser.h"
#include "video/VideoNoiseReducer.h"
#include "video/VideoSceneSegmenter.h"
#include "video/ColorCorrector.h"
#include "config/TranscriptionConfig.h"
#include "config/CloudSyncManager.h"
#include "archive/MediaArchiveManager.h"
#include "widgets/AudioWaveformWidget.h"
#include "widgets/NoisePreviewWidget.h"
#include "batch/BatchTranscriptionManager.h"
#include "transcode/TranscodeManager.h"

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void onConnectDevice();
    void onDisconnectDevice();
    void onDeviceConnected();
    void onDeviceDisconnected();
    void onDeviceError(const QString& error);
    void onTapeStatusUpdated(const TapeStatus& status);
    
    void onPlayTape();
    void onStopTape();
    void onRewindTape();
    void onFastForwardTape();
    void onStartTranscription();
    void onStopTranscription();
    
    void onAudioConfigChanged();
    void onVideoConfigChanged();
    void onDenoiseConfigChanged();
    void onLoadTapePreset(const QString& presetId);
    void onSavePreset();
    void onExportConfig();
    void onImportConfig();
    
    void onStartBatch();
    void onPauseBatch();
    void onResumeBatch();
    void onCancelBatch();
    void onBatchProgress(const QString& batchId, int percent);
    void onBatchCompleted(const QString& batchId);
    void onAddBatchTask();
    
    void onSearchArchive();
    void onRefreshArchive();
    void onDeleteArchiveEntry();
    void onExportEntry();
    
    void onAudioDataReceived(const QByteArray& data);
    void onAudioLevelUpdate(int channel, float rms, float peak);
    
    void onSceneDetected(const SceneSegment& segment);
    void onSceneChangeDetected(qint64 timestampMs, float score);
    void onSegmentationModeChanged(int index);
    void onSensitivityChanged(int value);
    void onManualSegmentAdd();
    void onSegmentExport();
    void onResetSegmentation();
    
    void onAddTranscodeTask();
    void onStartTranscodeBatch();
    void onPauseTranscodeBatch();
    void onResumeTranscodeBatch();
    void onCancelTranscodeBatch();
    void onTranscodeTaskProgress(const QString& taskId, int percent);
    void onTranscodeBatchProgress(int overallPercent);
    void onTranscodeBatchCompleted();
    
    void onAutoColorCalibrate();
    void onColorCorrectionChanged();
    void onFilmTypeChanged(int index);
    void onFlickerReductionToggled(bool enabled);
    void onResetColorProfile();
    
    void onBufferStatsUpdated();
    void onHighLatencyDetected(float latencyMs);
    void onBufferOverrun();
    void onBufferUnderrun();
    
    void onSyncStatusChanged(CloudSyncManager::SyncStatus status);
    void onTestConnection();
    void onStartAutoSync();
    void onStopAutoSync();
    void onPushAllConfigs();
    void onPullAllConfigs();
    void onPushAllArchives();
    void onPullAllArchives();
    void onExportSyncConfig();
    void onImportSyncConfig();
    
    void onRegisterDevice();
    void onUnregisterDevice();
    void onStartScheduler();
    void onStopScheduler();
    void onPauseScheduler();
    void onResumeScheduler();
    void onCreateJob();
    void onCancelJob();
    void onAssignJobToDevice();
    void onDeviceRegistered(const QString& deviceId);
    void onDeviceConnected(const QString& deviceId);
    void onDeviceDisconnected(const QString& deviceId);
    void onJobStarted(int jobId, const QString& deviceId);
    void onJobCompleted(int jobId);
    void onSystemLoadChanged(float load);
    
    void onSaveMediaInfo();
    void onLoadMediaInfo();
    void onAddSceneMarker();
    void onRemoveSceneMarker();

private:
    void setupUi();
    void setupHardwareTab();
    void setupAudioTab();
    void setupVideoTab();
    void setupConfigTab();
    void setupBatchTab();
    void setupArchiveTab();
    void setupSegmentationTab();
    void setupTranscodeTab();
    void setupColorCorrectionTab();
    void setupCloudSyncTab();
    void setupDeviceSchedulerTab();
    void setupMediaInfoTab();
    void createConnections();
    void initializeManagers();
    
    HardwareDriver* m_hardwareDriver;
    RingBuffer* m_ringBuffer;
    DeviceScheduler* m_deviceScheduler;
    AudioWaveformParser* m_audioParser;
    VideoNoiseReducer* m_videoNoiseReducer;
    VideoSceneSegmenter* m_sceneSegmenter;
    ColorCorrector* m_colorCorrector;
    TranscriptionConfig* m_configManager;
    CloudSyncManager* m_cloudSyncManager;
    MediaArchiveManager* m_archiveManager;
    BatchTranscriptionManager* m_batchManager;
    TranscodeManager* m_transcodeManager;
    
    QTabWidget* m_tabWidget;
    
    QComboBox* m_portCombo;
    QLabel* m_deviceStatusLabel;
    QLabel* m_tapePositionLabel;
    QProgressBar* m_signalBar;
    
    AudioWaveformWidget* m_waveformWidget;
    
    NoisePreviewWidget* m_noisePreviewWidget;
    
    QLineEdit* m_searchEdit;
    QTableWidget* m_archiveTable;
    
    QString m_currentBatchId;
    QTableWidget* m_batchTable;
    QProgressBar* m_batchProgressBar;
    QLabel* m_batchStatusLabel;
    
    QDoubleSpinBox* m_denoiseStrengthSpin;
    QDoubleSpinBox* m_chromaDenoiseSpin;
    QCheckBox* m_enableDenoiseCheck;
    
    QTableWidget* m_segmentTable;
    QComboBox* m_segmentationModeCombo;
    QSlider* m_sensitivitySlider;
    QLabel* m_sensitivityLabel;
    QLabel* m_segmentCountLabel;
    
    QTableWidget* m_transcodeTable;
    QComboBox* m_transcodeProfileCombo;
    QProgressBar* m_transcodeProgressBar;
    QLabel* m_transcodeStatusLabel;
    
    QSlider* m_brightnessSlider;
    QSlider* m_contrastSlider;
    QSlider* m_saturationSlider;
    QComboBox* m_filmTypeCombo;
    QCheckBox* m_flickerReductionCheck;
    QLabel* m_colorTempLabel;
    QSlider* m_colorTempSlider;
    
    QLabel* m_bufferUsageLabel;
    QLabel* m_latencyLabel;
    QProgressBar* m_bufferProgressBar;
    QTimer* m_bufferStatsTimer;
    
    QLineEdit* m_serverUrlEdit;
    QLineEdit* m_apiKeyEdit;
    QLineEdit* m_userIdEdit;
    QLineEdit* m_deviceIdEdit;
    QCheckBox* m_autoSyncCheck;
    QSpinBox* m_syncIntervalSpin;
    QLabel* m_syncStatusLabel;
    QProgressBar* m_syncProgressBar;
    QTableWidget* m_syncHistoryTable;
    
    QTableWidget* m_devicesTable;
    QTableWidget* m_scheduledJobsTable;
    QLabel* m_schedulerStatusLabel;
    QLabel* m_systemLoadLabel;
    QComboBox* m_scheduleModeCombo;
    
    QLineEdit* m_tapeIdEdit;
    QLineEdit* m_tapeNameEdit;
    QLineEdit* m_manufacturerEdit;
    QComboBox* m_tapeTypeCombo;
    QSpinBox* m_lengthMinutesSpin;
    QDateEdit* m_productionDateEdit;
    QDateEdit* m_recordingDateEdit;
    QTextEdit* m_conditionEdit;
    QSpinBox* m_generationSpin;
    QLineEdit* m_shelfLocationEdit;
    QLineEdit* m_boxNumberEdit;
    QLineEdit* m_originalOwnerEdit;
    QLineEdit* m_recordingDeviceEdit;
    QListWidget* m_sceneMarkersList;
    QListWidget* m_chapterTitlesList;
};

#endif
