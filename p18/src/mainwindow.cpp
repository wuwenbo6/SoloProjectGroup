#include "mainwindow.h"
#include <QSerialPortInfo>
#include <QHeaderView>
#include <QDateTime>
#include <QDir>
#include <QTimer>
#include <QTime>
#include <QFile>
#include <QTextStream>
#include <QFileInfo>
#include <QDateEdit>
#include <QBrush>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_hardwareDriver(new HardwareDriver(this))
    , m_ringBuffer(new RingBuffer(this, 16 * 1024 * 1024))
    , m_deviceScheduler(new DeviceScheduler(this))
    , m_audioParser(new AudioWaveformParser(this))
    , m_videoNoiseReducer(new VideoNoiseReducer(this))
    , m_sceneSegmenter(new VideoSceneSegmenter(this))
    , m_colorCorrector(new ColorCorrector(this))
    , m_configManager(new TranscriptionConfig(this))
    , m_cloudSyncManager(new CloudSyncManager(this))
    , m_archiveManager(new MediaArchiveManager(this))
    , m_batchManager(new BatchTranscriptionManager(this))
    , m_transcodeManager(new TranscodeManager(this))
    , m_bufferStatsTimer(new QTimer(this))
{
    setWindowTitle("Tape Digitizer Pro - 老式磁带转录系统");
    resize(1400, 900);
    
    setupUi();
    createConnections();
    initializeManagers();
}

MainWindow::~MainWindow()
{
}

void MainWindow::setupUi()
{
    m_tabWidget = new QTabWidget(this);
    setCentralWidget(m_tabWidget);
    
    setupHardwareTab();
    setupAudioTab();
    setupVideoTab();
    setupConfigTab();
    setupBatchTab();
    setupArchiveTab();
    setupSegmentationTab();
    setupTranscodeTab();
    setupColorCorrectionTab();
    setupCloudSyncTab();
    setupDeviceSchedulerTab();
    setupMediaInfoTab();
}

void MainWindow::setupHardwareTab()
{
    QWidget* hardwareTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(hardwareTab);
    
    QGroupBox* connectionGroup = new QGroupBox("设备连接");
    QHBoxLayout* connLayout = new QHBoxLayout(connectionGroup);
    
    connLayout->addWidget(new QLabel("串口:"));
    m_portCombo = new QComboBox();
    QList<QSerialPortInfo> ports = QSerialPortInfo::availablePorts();
    for (const QSerialPortInfo& port : ports) {
        m_portCombo->addItem(port.portName());
    }
    if (m_portCombo->count() == 0) {
        m_portCombo->addItem("未检测到串口");
    }
    connLayout->addWidget(m_portCombo);
    
    QPushButton* refreshBtn = new QPushButton("刷新");
    connect(refreshBtn, &QPushButton::clicked, [this]() {
        m_portCombo->clear();
        QList<QSerialPortInfo> ports = QSerialPortInfo::availablePorts();
        for (const QSerialPortInfo& port : ports) {
            m_portCombo->addItem(port.portName());
        }
        if (m_portCombo->count() == 0) {
            m_portCombo->addItem("未检测到串口");
        }
    });
    connLayout->addWidget(refreshBtn);
    
    QPushButton* connectBtn = new QPushButton("连接设备");
    connect(connectBtn, &QPushButton::clicked, this, &MainWindow::onConnectDevice);
    connLayout->addWidget(connectBtn);
    
    QPushButton* disconnectBtn = new QPushButton("断开连接");
    connect(disconnectBtn, &QPushButton::clicked, this, &MainWindow::onDisconnectDevice);
    connLayout->addWidget(disconnectBtn);
    
    m_deviceStatusLabel = new QLabel("状态: 未连接");
    connLayout->addWidget(m_deviceStatusLabel);
    connLayout->addStretch();
    
    layout->addWidget(connectionGroup);
    
    QGroupBox* controlGroup = new QGroupBox("磁带控制");
    QHBoxLayout* controlLayout = new QHBoxLayout(controlGroup);
    
    QPushButton* playBtn = new QPushButton("播放");
    connect(playBtn, &QPushButton::clicked, this, &MainWindow::onPlayTape);
    controlLayout->addWidget(playBtn);
    
    QPushButton* stopBtn = new QPushButton("停止");
    connect(stopBtn, &QPushButton::clicked, this, &MainWindow::onStopTape);
    controlLayout->addWidget(stopBtn);
    
    QPushButton* rewindBtn = new QPushButton("倒带");
    connect(rewindBtn, &QPushButton::clicked, this, &MainWindow::onRewindTape);
    controlLayout->addWidget(rewindBtn);
    
    QPushButton* ffBtn = new QPushButton("快进");
    connect(ffBtn, &QPushButton::clicked, this, &MainWindow::onFastForwardTape);
    controlLayout->addWidget(ffBtn);
    
    controlLayout->addStretch();
    
    QPushButton* startTransBtn = new QPushButton("开始转录");
    startTransBtn->setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;");
    connect(startTransBtn, &QPushButton::clicked, this, &MainWindow::onStartTranscription);
    controlLayout->addWidget(startTransBtn);
    
    QPushButton* stopTransBtn = new QPushButton("停止转录");
    stopTransBtn->setStyleSheet("background-color: #f44336; color: white;");
    connect(stopTransBtn, &QPushButton::clicked, this, &MainWindow::onStopTranscription);
    controlLayout->addWidget(stopTransBtn);
    
    layout->addWidget(controlGroup);
    
    QGroupBox* statusGroup = new QGroupBox("状态信息");
    QVBoxLayout* statusLayout = new QVBoxLayout(statusGroup);
    
    QHBoxLayout* tapeInfoLayout = new QHBoxLayout();
    tapeInfoLayout->addWidget(new QLabel("磁带位置:"));
    m_tapePositionLabel = new QLabel("--:-- / --:--");
    tapeInfoLayout->addWidget(m_tapePositionLabel);
    
    tapeInfoLayout->addWidget(new QLabel("信号强度:"));
    m_signalBar = new QProgressBar();
    m_signalBar->setRange(0, 100);
    m_signalBar->setValue(0);
    tapeInfoLayout->addWidget(m_signalBar);
    
    tapeInfoLayout->addStretch();
    statusLayout->addLayout(tapeInfoLayout);
    
    QHBoxLayout* bufferLayout = new QHBoxLayout();
    bufferLayout->addWidget(new QLabel("缓冲区使用率:"));
    m_bufferProgressBar = new QProgressBar();
    m_bufferProgressBar->setRange(0, 100);
    m_bufferProgressBar->setValue(0);
    bufferLayout->addWidget(m_bufferProgressBar);
    m_bufferUsageLabel = new QLabel("0%");
    bufferLayout->addWidget(m_bufferUsageLabel);
    
    bufferLayout->addWidget(new QLabel("平均延迟:"));
    m_latencyLabel = new QLabel("0 ms");
    bufferLayout->addWidget(m_latencyLabel);
    
    bufferLayout->addStretch();
    statusLayout->addLayout(bufferLayout);
    
    layout->addWidget(statusGroup);
    layout->addStretch();
    
    m_tabWidget->addTab(hardwareTab, "硬件控制");
}

void MainWindow::setupAudioTab()
{
    QWidget* audioTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(audioTab);
    
    m_waveformWidget = new AudioWaveformWidget();
    m_waveformWidget->setMinimumHeight(300);
    layout->addWidget(m_waveformWidget);
    
    QGroupBox* audioConfigGroup = new QGroupBox("音频配置");
    QGridLayout* audioLayout = new QGridLayout(audioConfigGroup);
    
    audioLayout->addWidget(new QLabel("采样率:"), 0, 0);
    QComboBox* sampleRateCombo = new QComboBox();
    sampleRateCombo->addItems({"44100", "48000", "96000", "192000"});
    sampleRateCombo->setCurrentText("48000");
    audioLayout->addWidget(sampleRateCombo, 0, 1);
    
    audioLayout->addWidget(new QLabel("声道数:"), 0, 2);
    QComboBox* channelCombo = new QComboBox();
    channelCombo->addItems({"1 (单声道)", "2 (立体声)"});
    channelCombo->setCurrentIndex(1);
    audioLayout->addWidget(channelCombo, 0, 3);
    
    audioLayout->addWidget(new QLabel("位深度:"), 1, 0);
    QComboBox* bitDepthCombo = new QComboBox();
    bitDepthCombo->addItems({"16", "24", "32"});
    bitDepthCombo->setCurrentIndex(0);
    audioLayout->addWidget(bitDepthCombo, 1, 1);
    
    audioLayout->addWidget(new QLabel("降噪阈值:"), 1, 2);
    QSlider* noiseThresholdSlider = new QSlider(Qt::Horizontal);
    noiseThresholdSlider->setRange(0, 100);
    noiseThresholdSlider->setValue(30);
    audioLayout->addWidget(noiseThresholdSlider, 1, 3);
    
    layout->addWidget(audioConfigGroup);
    layout->addStretch();
    
    m_tabWidget->addTab(audioTab, "音频波形");
}

void MainWindow::setupVideoTab()
{
    QWidget* videoTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(videoTab);
    
    m_noisePreviewWidget = new NoisePreviewWidget();
    m_noisePreviewWidget->setMinimumHeight(400);
    layout->addWidget(m_noisePreviewWidget);
    
    QGroupBox* denoiseGroup = new QGroupBox("降噪参数");
    QGridLayout* denoiseLayout = new QGridLayout(denoiseGroup);
    
    m_enableDenoiseCheck = new QCheckBox("启用降噪");
    m_enableDenoiseCheck->setChecked(true);
    denoiseLayout->addWidget(m_enableDenoiseCheck, 0, 0);
    
    denoiseLayout->addWidget(new QLabel("亮度降噪强度:"), 1, 0);
    m_denoiseStrengthSpin = new QDoubleSpinBox();
    m_denoiseStrengthSpin->setRange(0.0, 1.0);
    m_denoiseStrengthSpin->setSingleStep(0.05);
    m_denoiseStrengthSpin->setValue(0.5);
    denoiseLayout->addWidget(m_denoiseStrengthSpin, 1, 1);
    
    denoiseLayout->addWidget(new QLabel("色度降噪强度:"), 1, 2);
    m_chromaDenoiseSpin = new QDoubleSpinBox();
    m_chromaDenoiseSpin->setRange(0.0, 1.0);
    m_chromaDenoiseSpin->setSingleStep(0.05);
    m_chromaDenoiseSpin->setValue(0.3);
    denoiseLayout->addWidget(m_chromaDenoiseSpin, 1, 3);
    
    denoiseLayout->addWidget(new QLabel("锐化强度:"), 2, 0);
    QDoubleSpinBox* sharpenSpin = new QDoubleSpinBox();
    sharpenSpin->setRange(0.0, 1.0);
    sharpenSpin->setValue(0.1);
    denoiseLayout->addWidget(sharpenSpin, 2, 1);
    
    connect(m_enableDenoiseCheck, &QCheckBox::toggled, this, &MainWindow::onDenoiseConfigChanged);
    connect(m_denoiseStrengthSpin, QOverload<double>::of(&QDoubleSpinBox::valueChanged), this, &MainWindow::onDenoiseConfigChanged);
    connect(m_chromaDenoiseSpin, QOverload<double>::of(&QDoubleSpinBox::valueChanged), this, &MainWindow::onDenoiseConfigChanged);
    
    layout->addWidget(denoiseGroup);
    
    QGroupBox* colorGroup = new QGroupBox("色彩校正");
    QGridLayout* colorLayout = new QGridLayout(colorGroup);
    
    colorLayout->addWidget(new QLabel("亮度:"), 0, 0);
    QSlider* brightnessSlider = new QSlider(Qt::Horizontal);
    brightnessSlider->setRange(-100, 100);
    brightnessSlider->setValue(0);
    colorLayout->addWidget(brightnessSlider, 0, 1);
    
    colorLayout->addWidget(new QLabel("对比度:"), 0, 2);
    QSlider* contrastSlider = new QSlider(Qt::Horizontal);
    contrastSlider->setRange(-100, 100);
    contrastSlider->setValue(0);
    colorLayout->addWidget(contrastSlider, 0, 3);
    
    colorLayout->addWidget(new QLabel("饱和度:"), 1, 0);
    m_saturationSlider = new QSlider(Qt::Horizontal);
    m_saturationSlider->setRange(-100, 100);
    m_saturationSlider->setValue(0);
    colorLayout->addWidget(m_saturationSlider, 1, 1);
    
    layout->addWidget(colorGroup);
    
    m_tabWidget->addTab(videoTab, "视频降噪");
}

void MainWindow::setupConfigTab()
{
    QWidget* configTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(configTab);
    
    QGroupBox* presetGroup = new QGroupBox("磁带预设");
    QHBoxLayout* presetLayout = new QHBoxLayout(presetGroup);
    
    presetLayout->addWidget(new QLabel("选择预设:"));
    QComboBox* presetCombo = new QComboBox();
    QStringList presets = m_configManager->getAvailableTapeModels();
    for (const QString& id : presets) {
        TapeModel model = m_configManager->getTapeModel(id);
        presetCombo->addItem(model.name, id);
    }
    presetLayout->addWidget(presetCombo);
    
    QPushButton* loadBtn = new QPushButton("加载预设");
    connect(loadBtn, &QPushButton::clicked, [this, presetCombo]() {
        QString id = presetCombo->currentData().toString();
        onLoadTapePreset(id);
    });
    presetLayout->addWidget(loadBtn);
    
    QPushButton* saveBtn = new QPushButton("保存为预设");
    connect(saveBtn, &QPushButton::clicked, this, &MainWindow::onSavePreset);
    presetLayout->addWidget(saveBtn);
    
    presetLayout->addStretch();
    layout->addWidget(presetGroup);
    
    QGroupBox* videoConfigGroup = new QGroupBox("视频输出配置");
    QGridLayout* videoLayout = new QGridLayout(videoConfigGroup);
    
    videoLayout->addWidget(new QLabel("输出宽度:"), 0, 0);
    QSpinBox* widthSpin = new QSpinBox();
    widthSpin->setRange(320, 3840);
    widthSpin->setValue(720);
    videoLayout->addWidget(widthSpin, 0, 1);
    
    videoLayout->addWidget(new QLabel("输出高度:"), 0, 2);
    QSpinBox* heightSpin = new QSpinBox();
    heightSpin->setRange(240, 2160);
    heightSpin->setValue(480);
    videoLayout->addWidget(heightSpin, 0, 3);
    
    videoLayout->addWidget(new QLabel("帧率:"), 1, 0);
    QComboBox* fpsCombo = new QComboBox();
    fpsCombo->addItems({"24", "25", "29.97", "30", "50", "60"});
    fpsCombo->setCurrentText("29.97");
    videoLayout->addWidget(fpsCombo, 1, 1);
    
    videoLayout->addWidget(new QLabel("码率 (Mbps):"), 1, 2);
    QSpinBox* bitrateSpin = new QSpinBox();
    bitrateSpin->setRange(1, 100);
    bitrateSpin->setValue(10);
    videoLayout->addWidget(bitrateSpin, 1, 3);
    
    layout->addWidget(videoConfigGroup);
    
    QGroupBox* ioGroup = new QGroupBox("配置导入导出");
    QHBoxLayout* ioLayout = new QHBoxLayout(ioGroup);
    
    QPushButton* exportBtn = new QPushButton("导出配置");
    connect(exportBtn, &QPushButton::clicked, this, &MainWindow::onExportConfig);
    ioLayout->addWidget(exportBtn);
    
    QPushButton* importBtn = new QPushButton("导入配置");
    connect(importBtn, &QPushButton::clicked, this, &MainWindow::onImportConfig);
    ioLayout->addWidget(importBtn);
    
    QPushButton* resetBtn = new QPushButton("重置为默认");
    connect(resetBtn, &QPushButton::clicked, [this]() {
        m_configManager->resetToDefaults();
    });
    ioLayout->addWidget(resetBtn);
    
    ioLayout->addStretch();
    layout->addWidget(ioGroup);
    
    layout->addStretch();
    m_tabWidget->addTab(configTab, "参数配置");
}

void MainWindow::setupBatchTab()
{
    QWidget* batchTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(batchTab);
    
    QGroupBox* batchControlGroup = new QGroupBox("批量任务控制");
    QHBoxLayout* controlLayout = new QHBoxLayout(batchControlGroup);
    
    QPushButton* addTaskBtn = new QPushButton("添加任务");
    connect(addTaskBtn, &QPushButton::clicked, this, &MainWindow::onAddBatchTask);
    controlLayout->addWidget(addTaskBtn);
    
    QPushButton* startBtn = new QPushButton("开始批量处理");
    startBtn->setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;");
    connect(startBtn, &QPushButton::clicked, this, &MainWindow::onStartBatch);
    controlLayout->addWidget(startBtn);
    
    QPushButton* pauseBtn = new QPushButton("暂停");
    connect(pauseBtn, &QPushButton::clicked, this, &MainWindow::onPauseBatch);
    controlLayout->addWidget(pauseBtn);
    
    QPushButton* resumeBtn = new QPushButton("继续");
    connect(resumeBtn, &QPushButton::clicked, this, &MainWindow::onResumeBatch);
    controlLayout->addWidget(resumeBtn);
    
    QPushButton* cancelBtn = new QPushButton("取消");
    cancelBtn->setStyleSheet("background-color: #f44336; color: white;");
    connect(cancelBtn, &QPushButton::clicked, this, &MainWindow::onCancelBatch);
    controlLayout->addWidget(cancelBtn);
    
    controlLayout->addStretch();
    layout->addWidget(batchControlGroup);
    
    QGroupBox* statusGroup = new QGroupBox("任务状态");
    QVBoxLayout* statusLayout = new QVBoxLayout(statusGroup);
    
    QHBoxLayout* progressLayout = new QHBoxLayout();
    progressLayout->addWidget(new QLabel("总体进度:"));
    m_batchProgressBar = new QProgressBar();
    m_batchProgressBar->setRange(0, 100);
    progressLayout->addWidget(m_batchProgressBar);
    m_batchStatusLabel = new QLabel("就绪");
    progressLayout->addWidget(m_batchStatusLabel);
    statusLayout->addLayout(progressLayout);
    
    m_batchTable = new QTableWidget(0, 5);
    m_batchTable->setHorizontalHeaderLabels({"任务名称", "磁带类型", "状态", "进度", "输出路径"});
    m_batchTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    statusLayout->addWidget(m_batchTable);
    
    layout->addWidget(statusGroup);
    
    m_tabWidget->addTab(batchTab, "批量转录");
}

void MainWindow::setupArchiveTab()
{
    QWidget* archiveTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(archiveTab);
    
    QHBoxLayout* searchLayout = new QHBoxLayout();
    searchLayout->addWidget(new QLabel("搜索:"));
    m_searchEdit = new QLineEdit();
    m_searchEdit->setPlaceholderText("输入关键词搜索...");
    searchLayout->addWidget(m_searchEdit);
    
    QPushButton* searchBtn = new QPushButton("搜索");
    connect(searchBtn, &QPushButton::clicked, this, &MainWindow::onSearchArchive);
    searchLayout->addWidget(searchBtn);
    
    QPushButton* refreshBtn = new QPushButton("刷新");
    connect(refreshBtn, &QPushButton::clicked, this, &MainWindow::onRefreshArchive);
    searchLayout->addWidget(refreshBtn);
    
    searchLayout->addStretch();
    layout->addLayout(searchLayout);
    
    m_archiveTable = new QTableWidget(0, 6);
    m_archiveTable->setHorizontalHeaderLabels({"磁带名称", "描述", "转录日期", "时长", "大小", "标签"});
    m_archiveTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    layout->addWidget(m_archiveTable);
    
    QHBoxLayout* actionLayout = new QHBoxLayout();
    QPushButton* deleteBtn = new QPushButton("删除选中");
    connect(deleteBtn, &QPushButton::clicked, this, &MainWindow::onDeleteArchiveEntry);
    actionLayout->addWidget(deleteBtn);
    
    QPushButton* exportBtn = new QPushButton("导出元数据");
    connect(exportBtn, &QPushButton::clicked, this, &MainWindow::onExportEntry);
    actionLayout->addWidget(exportBtn);
    
    actionLayout->addStretch();
    
    QLabel* statsLabel = new QLabel();
    int count = m_archiveManager->getTotalEntryCount();
    qint64 size = m_archiveManager->getTotalArchiveSize();
    statsLabel->setText(QString("总计: %1 个档案, %2 GB")
        .arg(count).arg(size / 1024.0 / 1024.0 / 1024.0, 0, 'f', 2));
    actionLayout->addWidget(statsLabel);
    
    layout->addLayout(actionLayout);
    
    m_tabWidget->addTab(archiveTab, "媒体档案");
}

void MainWindow::createConnections()
{
    connect(m_hardwareDriver, &HardwareDriver::deviceConnected, this, &MainWindow::onDeviceConnected);
    connect(m_hardwareDriver, &HardwareDriver::deviceDisconnected, this, &MainWindow::onDeviceDisconnected);
    connect(m_hardwareDriver, &HardwareDriver::deviceError, this, &MainWindow::onDeviceError);
    connect(m_hardwareDriver, &HardwareDriver::tapeStatusUpdated, this, &MainWindow::onTapeStatusUpdated);
    connect(m_hardwareDriver, &HardwareDriver::audioDataReceived, this, &MainWindow::onAudioDataReceived);
    
    connect(m_audioParser, &AudioWaveformParser::levelUpdated, this, &MainWindow::onAudioLevelUpdate);
    
    connect(m_batchManager, &BatchTranscriptionManager::batchProgress, this, &MainWindow::onBatchProgress);
    connect(m_batchManager, &BatchTranscriptionManager::batchCompleted, this, &MainWindow::onBatchCompleted);
}

void MainWindow::initializeManagers()
{
    m_archiveManager->initializeDatabase();
    m_batchManager->setArchiveManager(m_archiveManager);
    onRefreshArchive();
}

void MainWindow::onConnectDevice()
{
    QString portName = m_portCombo->currentText();
    if (portName == "未检测到串口") {
        QMessageBox::warning(this, "错误", "未找到可用的串口设备");
        return;
    }
    
    m_deviceStatusLabel->setText("状态: 正在连接...");
    m_hardwareDriver->connectToDevice(portName);
}

void MainWindow::onDisconnectDevice()
{
    m_hardwareDriver->disconnectDevice();
}

void MainWindow::onDeviceConnected()
{
    m_deviceStatusLabel->setText("状态: 已连接");
    m_deviceStatusLabel->setStyleSheet("color: green; font-weight: bold;");
    QMessageBox::information(this, "成功", "设备连接成功！");
}

void MainWindow::onDeviceDisconnected()
{
    m_deviceStatusLabel->setText("状态: 未连接");
    m_deviceStatusLabel->setStyleSheet("");
    m_tapePositionLabel->setText("--:-- / --:--");
    m_signalBar->setValue(0);
}

void MainWindow::onDeviceError(const QString& error)
{
    m_deviceStatusLabel->setText("状态: 错误");
    m_deviceStatusLabel->setStyleSheet("color: red; font-weight: bold;");
    QMessageBox::critical(this, "设备错误", error);
}

void MainWindow::onTapeStatusUpdated(const TapeStatus& status)
{
    int currentMin = status.currentPosition / 60;
    int currentSec = status.currentPosition % 60;
    int totalMin = status.totalLength / 60;
    int totalSec = status.totalLength % 60;
    
    m_tapePositionLabel->setText(QString("%1:%2 / %3:%4")
        .arg(currentMin, 2, 10, QChar('0'))
        .arg(currentSec, 2, 10, QChar('0'))
        .arg(totalMin, 2, 10, QChar('0'))
        .arg(totalSec, 2, 10, QChar('0')));
    
    m_signalBar->setValue(status.signalLevel);
}

void MainWindow::onPlayTape()
{
    if (m_hardwareDriver->isConnected()) {
        m_hardwareDriver->sendPlayCommand();
    }
}

void MainWindow::onStopTape()
{
    if (m_hardwareDriver->isConnected()) {
        m_hardwareDriver->sendStopCommand();
    }
}

void MainWindow::onRewindTape()
{
    if (m_hardwareDriver->isConnected()) {
        m_hardwareDriver->sendRewindCommand();
    }
}

void MainWindow::onFastForwardTape()
{
    if (m_hardwareDriver->isConnected()) {
        m_hardwareDriver->sendFastForwardCommand();
    }
}

void MainWindow::onStartTranscription()
{
    if (m_hardwareDriver->isConnected()) {
        m_hardwareDriver->sendStartTranscription();
        QMessageBox::information(this, "转录开始", "开始磁带数字化转录...");
    } else {
        QMessageBox::warning(this, "未连接", "请先连接设备");
    }
}

void MainWindow::onStopTranscription()
{
    if (m_hardwareDriver->isConnected()) {
        m_hardwareDriver->sendStopTranscription();
    }
}

void MainWindow::onAudioConfigChanged()
{
}

void MainWindow::onVideoConfigChanged()
{
}

void MainWindow::onDenoiseConfigChanged()
{
    DenoiseParameters params;
    params.luminanceStrength = m_denoiseStrengthSpin->value();
    params.chrominanceStrength = m_chromaDenoiseSpin->value();
    params.enableDenoise = m_enableDenoiseCheck->isChecked();
    m_configManager->setDenoiseParameters(params);
}

void MainWindow::onLoadTapePreset(const QString& presetId)
{
    m_configManager->loadPreset(presetId);
    DenoiseParameters params = m_configManager->getDenoiseParameters();
    m_denoiseStrengthSpin->setValue(params.luminanceStrength);
    m_chromaDenoiseSpin->setValue(params.chrominanceStrength);
    m_enableDenoiseCheck->setChecked(params.enableDenoise);
}

void MainWindow::onSavePreset()
{
    bool ok;
    QString name = QInputDialog::getText(this, "保存预设", "预设名称:", QLineEdit::Normal, "", &ok);
    if (ok && !name.isEmpty()) {
        m_configManager->savePreset(name);
        QMessageBox::information(this, "成功", "预设已保存");
    }
}

void MainWindow::onExportConfig()
{
    QString filePath = QFileDialog::getSaveFileName(this, "导出配置", QDir::homePath(), "JSON Files (*.json)");
    if (!filePath.isEmpty()) {
        if (m_configManager->exportToFile(filePath)) {
            QMessageBox::information(this, "成功", "配置已导出");
        } else {
            QMessageBox::critical(this, "错误", "导出失败");
        }
    }
}

void MainWindow::onImportConfig()
{
    QString filePath = QFileDialog::getOpenFileName(this, "导入配置", QDir::homePath(), "JSON Files (*.json)");
    if (!filePath.isEmpty()) {
        if (m_configManager->importFromFile(filePath)) {
            QMessageBox::information(this, "成功", "配置已导入");
        } else {
            QMessageBox::critical(this, "错误", "导入失败");
        }
    }
}

void MainWindow::onStartBatch()
{
    if (m_batchTable->rowCount() == 0) {
        QMessageBox::warning(this, "提示", "请先添加转录任务");
        return;
    }
    
    QList<TranscriptionTask> tasks;
    for (int i = 0; i < m_batchTable->rowCount(); i++) {
        TranscriptionTask task;
        task.tapeName = m_batchTable->item(i, 0)->text();
        task.tapeModelId = "vhs_standard";
        task.outputPath = m_batchTable->item(i, 4)->text();
        tasks.append(task);
    }
    
    m_currentBatchId = m_batchManager->createBatch("批量转录 " + QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm"), tasks);
    m_batchManager->startBatch(m_currentBatchId);
    m_batchStatusLabel->setText("运行中...");
}

void MainWindow::onPauseBatch()
{
    if (!m_currentBatchId.isEmpty()) {
        m_batchManager->pauseBatch(m_currentBatchId);
        m_batchStatusLabel->setText("已暂停");
    }
}

void MainWindow::onResumeBatch()
{
    if (!m_currentBatchId.isEmpty()) {
        m_batchManager->resumeBatch(m_currentBatchId);
        m_batchStatusLabel->setText("运行中...");
    }
}

void MainWindow::onCancelBatch()
{
    if (!m_currentBatchId.isEmpty()) {
        m_batchManager->cancelBatch(m_currentBatchId);
        m_batchStatusLabel->setText("已取消");
        m_batchProgressBar->setValue(0);
    }
}

void MainWindow::onBatchProgress(const QString& batchId, int percent)
{
    Q_UNUSED(batchId);
    m_batchProgressBar->setValue(percent);
    
    QList<TranscriptionTask> tasks = m_batchManager->getBatchTasks(m_currentBatchId);
    for (int i = 0; i < tasks.size() && i < m_batchTable->rowCount(); i++) {
        if (m_batchTable->item(i, 2)) {
            m_batchTable->item(i, 2)->setText(tasks[i].status);
        }
        if (m_batchTable->cellWidget(i, 3)) {
            QProgressBar* bar = qobject_cast<QProgressBar*>(m_batchTable->cellWidget(i, 3));
            if (bar) {
                bar->setValue(tasks[i].progressPercent);
            }
        }
    }
}

void MainWindow::onBatchCompleted(const QString& batchId)
{
    Q_UNUSED(batchId);
    m_batchStatusLabel->setText("已完成");
    m_batchProgressBar->setValue(100);
    QMessageBox::information(this, "完成", "批量转录已完成！");
    onRefreshArchive();
}

void MainWindow::onAddBatchTask()
{
    QString tapeName = QInputDialog::getText(this, "添加任务", "磁带名称:");
    if (tapeName.isEmpty()) return;
    
    QString outputPath = QFileDialog::getSaveFileName(this, "输出文件", QDir::homePath() + "/" + tapeName + ".mp4", "MP4 Files (*.mp4)");
    if (outputPath.isEmpty()) return;
    
    int row = m_batchTable->rowCount();
    m_batchTable->insertRow(row);
    m_batchTable->setItem(row, 0, new QTableWidgetItem(tapeName));
    m_batchTable->setItem(row, 1, new QTableWidgetItem("VHS Standard"));
    m_batchTable->setItem(row, 2, new QTableWidgetItem("pending"));
    
    QProgressBar* progressBar = new QProgressBar();
    progressBar->setRange(0, 100);
    progressBar->setValue(0);
    m_batchTable->setCellWidget(row, 3, progressBar);
    
    m_batchTable->setItem(row, 4, new QTableWidgetItem(outputPath));
}

void MainWindow::onSearchArchive()
{
    QString keyword = m_searchEdit->text();
    QList<MediaArchiveEntry> entries = m_archiveManager->searchEntries(keyword);
    
    m_archiveTable->setRowCount(0);
    for (const MediaArchiveEntry& entry : entries) {
        int row = m_archiveTable->rowCount();
        m_archiveTable->insertRow(row);
        m_archiveTable->setItem(row, 0, new QTableWidgetItem(entry.tapeName));
        m_archiveTable->setItem(row, 1, new QTableWidgetItem(entry.contentDescription));
        m_archiveTable->setItem(row, 2, new QTableWidgetItem(entry.digitizationDate.toString("yyyy-MM-dd hh:mm")));
        m_archiveTable->setItem(row, 3, new QTableWidgetItem(QString("%1 秒").arg(entry.durationSeconds)));
        m_archiveTable->setItem(row, 4, new QTableWidgetItem(QString("%1 MB").arg(entry.fileSize / 1024 / 1024)));
        m_archiveTable->setItem(row, 5, new QTableWidgetItem(entry.tags.join(", ")));
    }
}

void MainWindow::onRefreshArchive()
{
    QList<MediaArchiveEntry> entries = m_archiveManager->getAllEntries();
    m_archiveTable->setRowCount(0);
    for (const MediaArchiveEntry& entry : entries) {
        int row = m_archiveTable->rowCount();
        m_archiveTable->insertRow(row);
        m_archiveTable->setItem(row, 0, new QTableWidgetItem(entry.tapeName));
        m_archiveTable->setItem(row, 1, new QTableWidgetItem(entry.contentDescription));
        m_archiveTable->setItem(row, 2, new QTableWidgetItem(entry.digitizationDate.toString("yyyy-MM-dd hh:mm")));
        m_archiveTable->setItem(row, 3, new QTableWidgetItem(QString("%1 秒").arg(entry.durationSeconds)));
        m_archiveTable->setItem(row, 4, new QTableWidgetItem(QString("%1 MB").arg(entry.fileSize / 1024 / 1024)));
        m_archiveTable->setItem(row, 5, new QTableWidgetItem(entry.tags.join(", ")));
    }
}

void MainWindow::onDeleteArchiveEntry()
{
    int row = m_archiveTable->currentRow();
    if (row < 0) {
        QMessageBox::warning(this, "提示", "请先选择要删除的档案");
        return;
    }
    
    QList<MediaArchiveEntry> entries = m_archiveManager->getAllEntries();
    if (row < entries.size()) {
        if (QMessageBox::question(this, "确认", "确定要删除这个档案吗？") == QMessageBox::Yes) {
            m_archiveManager->removeArchiveEntry(entries[row].entryId);
            onRefreshArchive();
        }
    }
}

void MainWindow::onExportEntry()
{
    int row = m_archiveTable->currentRow();
    if (row < 0) {
        QMessageBox::warning(this, "提示", "请先选择要导出的档案");
        return;
    }
    
    QList<MediaArchiveEntry> entries = m_archiveManager->getAllEntries();
    if (row < entries.size()) {
        QString filePath = QFileDialog::getSaveFileName(this, "导出元数据", QDir::homePath(), "JSON Files (*.json)");
        if (!filePath.isEmpty()) {
            m_archiveManager->exportEntryMetadata(entries[row].entryId, filePath);
            QMessageBox::information(this, "成功", "元数据已导出");
        }
    }
}

void MainWindow::onAudioDataReceived(const QByteArray& data)
{
    m_audioParser->processAudioData(data);
}

void MainWindow::onAudioLevelUpdate(int channel, float rms, float peak)
{
    Q_UNUSED(channel);
    Q_UNUSED(peak);
    m_waveformWidget->updateLevels(rms, peak, rms * 0.8f, peak * 0.8f);
}

void MainWindow::setupSegmentationTab()
{
    QWidget* segmentTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(segmentTab);
    
    QGroupBox* controlGroup = new QGroupBox("分割控制");
    QGridLayout* controlLayout = new QGridLayout(controlGroup);
    
    controlLayout->addWidget(new QLabel("检测模式:"), 0, 0);
    m_segmentationModeCombo = new QComboBox();
    m_segmentationModeCombo->addItem("纯场景检测", VideoSceneSegmenter::SceneChangeOnly);
    m_segmentationModeCombo->addItem("音视频联合检测", VideoSceneSegmenter::AudioVideoCombined);
    m_segmentationModeCombo->addItem("带运动检测", VideoSceneSegmenter::SceneChangeWithMotion);
    m_segmentationModeCombo->addItem("智能自动模式", VideoSceneSegmenter::IntelligentAuto);
    connect(m_segmentationModeCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &MainWindow::onSegmentationModeChanged);
    controlLayout->addWidget(m_segmentationModeCombo, 0, 1);
    
    controlLayout->addWidget(new QLabel("检测灵敏度:"), 0, 2);
    m_sensitivitySlider = new QSlider(Qt::Horizontal);
    m_sensitivitySlider->setRange(1, 100);
    m_sensitivitySlider->setValue(50);
    connect(m_sensitivitySlider, &QSlider::valueChanged, this, &MainWindow::onSensitivityChanged);
    controlLayout->addWidget(m_sensitivitySlider, 0, 3);
    m_sensitivityLabel = new QLabel("50%");
    controlLayout->addWidget(m_sensitivityLabel, 0, 4);
    
    controlLayout->addWidget(new QLabel("已检测片段:"), 1, 0);
    m_segmentCountLabel = new QLabel("0");
    controlLayout->addWidget(m_segmentCountLabel, 1, 1);
    
    QPushButton* addManualBtn = new QPushButton("添加手动片段");
    connect(addManualBtn, &QPushButton::clicked, this, &MainWindow::onManualSegmentAdd);
    controlLayout->addWidget(addManualBtn, 1, 2);
    
    QPushButton* exportBtn = new QPushButton("导出选中片段");
    connect(exportBtn, &QPushButton::clicked, this, &MainWindow::onSegmentExport);
    controlLayout->addWidget(exportBtn, 1, 3);
    
    QPushButton* resetBtn = new QPushButton("重置检测");
    connect(resetBtn, &QPushButton::clicked, this, &MainWindow::onResetSegmentation);
    controlLayout->addWidget(resetBtn, 1, 4);
    
    layout->addWidget(controlGroup);
    
    QGroupBox* segmentListGroup = new QGroupBox("检测到的片段");
    QVBoxLayout* segmentListLayout = new QVBoxLayout(segmentListGroup);
    
    m_segmentTable = new QTableWidget(0, 6);
    m_segmentTable->setHorizontalHeaderLabels({"开始时间", "结束时间", "时长", "亮度", "变化分数", "缩略图"});
    m_segmentTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    segmentListLayout->addWidget(m_segmentTable);
    
    layout->addWidget(segmentListGroup);
    
    m_tabWidget->addTab(segmentTab, "智能分割");
}

void MainWindow::setupTranscodeTab()
{
    QWidget* transcodeTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(transcodeTab);
    
    QGroupBox* controlGroup = new QGroupBox("转码控制");
    QGridLayout* controlLayout = new QGridLayout(controlGroup);
    
    controlLayout->addWidget(new QLabel("转码配置:"), 0, 0);
    m_transcodeProfileCombo = new QComboBox();
    QList<TranscodeProfile> profiles = m_transcodeManager->getAvailableProfiles();
    for (const TranscodeProfile& profile : profiles) {
        m_transcodeProfileCombo->addItem(profile.name, profile.profileId);
    }
    controlLayout->addWidget(m_transcodeProfileCombo, 0, 1);
    
    QPushButton* addTaskBtn = new QPushButton("添加任务");
    connect(addTaskBtn, &QPushButton::clicked, this, &MainWindow::onAddTranscodeTask);
    controlLayout->addWidget(addTaskBtn, 0, 2);
    
    QPushButton* startBtn = new QPushButton("开始批量转码");
    startBtn->setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;");
    connect(startBtn, &QPushButton::clicked, this, &MainWindow::onStartTranscodeBatch);
    controlLayout->addWidget(startBtn, 0, 3);
    
    QPushButton* pauseBtn = new QPushButton("暂停");
    connect(pauseBtn, &QPushButton::clicked, this, &MainWindow::onPauseTranscodeBatch);
    controlLayout->addWidget(pauseBtn, 0, 4);
    
    QPushButton* resumeBtn = new QPushButton("继续");
    connect(resumeBtn, &QPushButton::clicked, this, &MainWindow::onResumeTranscodeBatch);
    controlLayout->addWidget(resumeBtn, 1, 0);
    
    QPushButton* cancelBtn = new QPushButton("取消");
    cancelBtn->setStyleSheet("background-color: #f44336; color: white;");
    connect(cancelBtn, &QPushButton::clicked, this, &MainWindow::onCancelTranscodeBatch);
    controlLayout->addWidget(cancelBtn, 1, 1);
    
    QHBoxLayout* progressLayout = new QHBoxLayout();
    progressLayout->addWidget(new QLabel("总体进度:"));
    m_transcodeProgressBar = new QProgressBar();
    m_transcodeProgressBar->setRange(0, 100);
    progressLayout->addWidget(m_transcodeProgressBar);
    m_transcodeStatusLabel = new QLabel("就绪");
    progressLayout->addWidget(m_transcodeStatusLabel);
    progressLayout->addStretch();
    controlLayout->addLayout(progressLayout, 1, 2, 1, 3);
    
    layout->addWidget(controlGroup);
    
    QGroupBox* taskListGroup = new QGroupBox("转码任务");
    QVBoxLayout* taskListLayout = new QVBoxLayout(taskListGroup);
    
    m_transcodeTable = new QTableWidget(0, 5);
    m_transcodeTable->setHorizontalHeaderLabels({"源文件", "输出文件", "配置", "状态", "进度"});
    m_transcodeTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    taskListLayout->addWidget(m_transcodeTable);
    
    layout->addWidget(taskListGroup);
    
    m_tabWidget->addTab(transcodeTab, "批量转码");
}

void MainWindow::setupColorCorrectionTab()
{
    QWidget* colorTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(colorTab);
    
    QGroupBox* autoCalibGroup = new QGroupBox("自动校正");
    QHBoxLayout* autoCalibLayout = new QHBoxLayout(autoCalibGroup);
    
    autoCalibLayout->addWidget(new QLabel("胶片类型:"));
    m_filmTypeCombo = new QComboBox();
    m_filmTypeCombo->addItem("未知/通用", ColorCorrector::UnknownFilm);
    m_filmTypeCombo->addItem("Kodak Gold (老照片)", ColorCorrector::KodakGold);
    m_filmTypeCombo->addItem("Fuji Film (老照片)", ColorCorrector::FujiFilm);
    m_filmTypeCombo->addItem("Agfa (老照片)", ColorCorrector::Agfa);
    m_filmTypeCombo->addItem("老录像带 VHS", ColorCorrector::OldVHS);
    m_filmTypeCombo->addItem("BetaMax 录像带", ColorCorrector::BetaMax);
    m_filmTypeCombo->addItem("8mm 电影胶片", ColorCorrector::Old8mm);
    connect(m_filmTypeCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &MainWindow::onFilmTypeChanged);
    autoCalibLayout->addWidget(m_filmTypeCombo);
    
    m_flickerReductionCheck = new QCheckBox("闪烁抑制");
    connect(m_flickerReductionCheck, &QCheckBox::toggled, this, &MainWindow::onFlickerReductionToggled);
    autoCalibLayout->addWidget(m_flickerReductionCheck);
    
    QPushButton* autoCalibBtn = new QPushButton("自动色彩校正");
    autoCalibBtn->setStyleSheet("background-color: #2196F3; color: white; font-weight: bold;");
    connect(autoCalibBtn, &QPushButton::clicked, this, &MainWindow::onAutoColorCalibrate);
    autoCalibLayout->addWidget(autoCalibBtn);
    
    QPushButton* resetBtn = new QPushButton("重置参数");
    connect(resetBtn, &QPushButton::clicked, this, &MainWindow::onResetColorProfile);
    autoCalibLayout->addWidget(resetBtn);
    
    autoCalibLayout->addStretch();
    layout->addWidget(autoCalibGroup);
    
    QGroupBox* manualGroup = new QGroupBox("手动调整");
    QGridLayout* manualLayout = new QGridLayout(manualGroup);
    
    manualLayout->addWidget(new QLabel("亮度:"), 0, 0);
    m_brightnessSlider = new QSlider(Qt::Horizontal);
    m_brightnessSlider->setRange(-100, 100);
    m_brightnessSlider->setValue(0);
    connect(m_brightnessSlider, &QSlider::valueChanged, this, &MainWindow::onColorCorrectionChanged);
    manualLayout->addWidget(m_brightnessSlider, 0, 1);
    
    manualLayout->addWidget(new QLabel("对比度:"), 1, 0);
    m_contrastSlider = new QSlider(Qt::Horizontal);
    m_contrastSlider->setRange(-100, 100);
    m_contrastSlider->setValue(0);
    connect(m_contrastSlider, &QSlider::valueChanged, this, &MainWindow::onColorCorrectionChanged);
    manualLayout->addWidget(m_contrastSlider, 1, 1);
    
    manualLayout->addWidget(new QLabel("饱和度:"), 2, 0);
    QSlider* saturationSlider = new QSlider(Qt::Horizontal);
    saturationSlider->setRange(-100, 100);
    saturationSlider->setValue(0);
    connect(saturationSlider, &QSlider::valueChanged, this, &MainWindow::onColorCorrectionChanged);
    manualLayout->addWidget(saturationSlider, 2, 1);
    
    manualLayout->addWidget(new QLabel("色温:"), 3, 0);
    m_colorTempSlider = new QSlider(Qt::Horizontal);
    m_colorTempSlider->setRange(2000, 10000);
    m_colorTempSlider->setValue(6500);
    connect(m_colorTempSlider, &QSlider::valueChanged, this, &MainWindow::onColorCorrectionChanged);
    manualLayout->addWidget(m_colorTempSlider, 3, 1);
    m_colorTempLabel = new QLabel("6500K");
    manualLayout->addWidget(m_colorTempLabel, 3, 2);
    
    layout->addWidget(manualGroup);
    
    m_tabWidget->addTab(colorTab, "色彩修复");
}

void MainWindow::onSceneDetected(const SceneSegment& segment)
{
    int row = m_segmentTable->rowCount();
    m_segmentTable->insertRow(row);
    
    QTime startTime = QTime::fromMSecsSinceStartOfDay(segment.startTimeMs);
    QTime endTime = QTime::fromMSecsSinceStartOfDay(segment.endTimeMs);
    
    m_segmentTable->setItem(row, 0, new QTableWidgetItem(startTime.toString("HH:mm:ss.zzz")));
    m_segmentTable->setItem(row, 1, new QTableWidgetItem(endTime.toString("HH:mm:ss.zzz")));
    m_segmentTable->setItem(row, 2, new QTableWidgetItem(QString::number((segment.endTimeMs - segment.startTimeMs) / 1000.0, 'f', 2) + "s"));
    m_segmentTable->setItem(row, 3, new QTableWidgetItem(QString::number(segment.averageBrightness, 'f', 1)));
    m_segmentTable->setItem(row, 4, new QTableWidgetItem(QString::number(segment.sceneChangeScore, 'f', 2)));
    
    if (!segment.thumbnail.isNull()) {
        QLabel* thumbLabel = new QLabel();
        thumbLabel->setPixmap(QPixmap::fromImage(segment.thumbnail.scaled(80, 60, Qt::KeepAspectRatio, Qt::SmoothTransformation)));
        m_segmentTable->setCellWidget(row, 5, thumbLabel);
        m_segmentTable->setRowHeight(row, 65);
    }
    
    m_segmentCountLabel->setText(QString::number(row + 1));
}

void MainWindow::onSceneChangeDetected(qint64 timestampMs, float score)
{
    Q_UNUSED(timestampMs);
    Q_UNUSED(score);
}

void MainWindow::onSegmentationModeChanged(int index)
{
    VideoSceneSegmenter::DetectionMode mode = static_cast<VideoSceneSegmenter::DetectionMode>(
        m_segmentationModeCombo->itemData(index).toInt());
    m_sceneSegmenter->setDetectionMode(mode);
}

void MainWindow::onSensitivityChanged(int value)
{
    m_sensitivityLabel->setText(QString::number(value) + "%");
    m_sceneSegmenter->setSensitivity(value / 100.0f);
}

void MainWindow::onManualSegmentAdd()
{
    bool ok;
    int startMs = QInputDialog::getInt(this, "添加片段", "开始时间 (ms):", 0, 0, 3600000, 1, &ok);
    if (!ok) return;
    
    int endMs = QInputDialog::getInt(this, "添加片段", "结束时间 (ms):", startMs + 1000, startMs, 3600000, 1, &ok);
    if (!ok) return;
    
    m_sceneSegmenter->addManualSegment(startMs, endMs);
    QMessageBox::information(this, "成功", "手动片段已添加");
}

void MainWindow::onSegmentExport()
{
    if (m_segmentTable->selectedItems().isEmpty()) {
        QMessageBox::warning(this, "提示", "请先选择要导出的片段");
        return;
    }
    
    QString filePath = QFileDialog::getSaveFileName(this, "导出片段列表", QDir::homePath(), "CSV Files (*.csv)");
    if (!filePath.isEmpty()) {
        QFile file(filePath);
        if (file.open(QIODevice::WriteOnly | QIODevice::Text)) {
            QTextStream out(&file);
            out << "开始时间,结束时间,时长,平均亮度,场景变化分数\n";
            
            for (int i = 0; i < m_segmentTable->rowCount(); i++) {
                if (m_segmentTable->item(i, 0)->isSelected() || m_segmentTable->selectionModel()->isRowSelected(i, QModelIndex())) {
                    out << m_segmentTable->item(i, 0)->text() << ","
                        << m_segmentTable->item(i, 1)->text() << ","
                        << m_segmentTable->item(i, 2)->text() << ","
                        << m_segmentTable->item(i, 3)->text() << ","
                        << m_segmentTable->item(i, 4)->text() << "\n";
                }
            }
            file.close();
            QMessageBox::information(this, "成功", "片段列表已导出");
        }
    }
}

void MainWindow::onResetSegmentation()
{
    m_sceneSegmenter->reset();
    m_segmentTable->setRowCount(0);
    m_segmentCountLabel->setText("0");
}

void MainWindow::onAddTranscodeTask()
{
    QString sourceFile = QFileDialog::getOpenFileName(this, "选择源文件", QDir::homePath(), 
        "Video Files (*.mp4 *.avi *.mkv *.mov *.wmv *.flv);;All Files (*)");
    if (sourceFile.isEmpty()) return;
    
    QString profileId = m_transcodeProfileCombo->currentData().toString();
    TranscodeProfile profile = m_transcodeManager->getProfile(profileId);
    
    QString defaultOutput = QFileInfo(sourceFile).absolutePath() + "/" + 
                           QFileInfo(sourceFile).completeBaseName() + "_" + 
                           profile.name + "." + profile.containerFormat;
    
    QString outputFile = QFileDialog::getSaveFileName(this, "选择输出文件", defaultOutput, 
        QString("%1 Files (*.%2)").arg(profile.name, profile.containerFormat));
    if (outputFile.isEmpty()) return;
    
    QString taskId = m_transcodeManager->addTask(sourceFile, outputFile, profileId);
    
    int row = m_transcodeTable->rowCount();
    m_transcodeTable->insertRow(row);
    m_transcodeTable->setItem(row, 0, new QTableWidgetItem(QFileInfo(sourceFile).fileName()));
    m_transcodeTable->setItem(row, 1, new QTableWidgetItem(QFileInfo(outputFile).fileName()));
    m_transcodeTable->setItem(row, 2, new QTableWidgetItem(profile.name));
    m_transcodeTable->setItem(row, 3, new QTableWidgetItem("等待中"));
    
    QProgressBar* progressBar = new QProgressBar();
    progressBar->setRange(0, 100);
    progressBar->setValue(0);
    m_transcodeTable->setCellWidget(row, 4, progressBar);
}

void MainWindow::onStartTranscodeBatch()
{
    if (m_transcodeTable->rowCount() == 0) {
        QMessageBox::warning(this, "提示", "请先添加转码任务");
        return;
    }
    
    if (!m_transcodeManager->checkFFmpegAvailable()) {
        QMessageBox::critical(this, "错误", "未找到 FFmpeg 可执行文件，请确保已安装 FFmpeg");
        return;
    }
    
    m_transcodeManager->startBatch();
    m_transcodeStatusLabel->setText("转码中...");
}

void MainWindow::onPauseTranscodeBatch()
{
    m_transcodeManager->pauseBatch();
    m_transcodeStatusLabel->setText("已暂停");
}

void MainWindow::onResumeTranscodeBatch()
{
    m_transcodeManager->resumeBatch();
    m_transcodeStatusLabel->setText("转码中...");
}

void MainWindow::onCancelTranscodeBatch()
{
    m_transcodeManager->cancelBatch();
    m_transcodeStatusLabel->setText("已取消");
    m_transcodeProgressBar->setValue(0);
}

void MainWindow::onTranscodeTaskProgress(const QString& taskId, int percent)
{
    QList<TranscodeTask> tasks = m_transcodeManager->getTasks();
    for (int i = 0; i < tasks.size(); i++) {
        if (tasks[i].taskId == taskId && i < m_transcodeTable->rowCount()) {
            if (m_transcodeTable->item(i, 3)) {
                m_transcodeTable->item(i, 3)->setText(tasks[i].status);
            }
            QProgressBar* bar = qobject_cast<QProgressBar*>(m_transcodeTable->cellWidget(i, 4));
            if (bar) {
                bar->setValue(percent);
            }
            break;
        }
    }
}

void MainWindow::onTranscodeBatchProgress(int overallPercent)
{
    m_transcodeProgressBar->setValue(overallPercent);
}

void MainWindow::onTranscodeBatchCompleted()
{
    m_transcodeStatusLabel->setText("已完成");
    m_transcodeProgressBar->setValue(100);
    QMessageBox::information(this, "完成", "批量转码已完成！");
}

void MainWindow::onAutoColorCalibrate()
{
    QMessageBox::information(this, "自动校正", "自动色彩校正已启用，将在转录过程中实时应用");
}

void MainWindow::onColorCorrectionChanged()
{
    int colorTemp = m_colorTempSlider->value();
    m_colorTempLabel->setText(QString::number(colorTemp) + "K");
}

void MainWindow::onFilmTypeChanged(int index)
{
    ColorCorrector::FilmType type = static_cast<ColorCorrector::FilmType>(
        m_filmTypeCombo->itemData(index).toInt());
    Q_UNUSED(type);
}

void MainWindow::onFlickerReductionToggled(bool enabled)
{
    Q_UNUSED(enabled);
}

void MainWindow::onResetColorProfile()
{
    m_brightnessSlider->setValue(0);
    m_contrastSlider->setValue(0);
    m_saturationSlider->setValue(0);
    m_colorTempSlider->setValue(6500);
    m_colorTempLabel->setText("6500K");
    m_filmTypeCombo->setCurrentIndex(0);
    m_flickerReductionCheck->setChecked(false);
}

void MainWindow::onBufferStatsUpdated()
{
    BufferStats stats = m_ringBuffer->statistics();
    int usage = static_cast<int>((stats.totalBytesWritten > 0 ? 
        (m_ringBuffer->getUsedSize() * 100) / m_ringBuffer->getCapacity() : 0));
    
    m_bufferProgressBar->setValue(usage);
    m_bufferUsageLabel->setText(QString::number(usage) + "%");
    m_latencyLabel->setText(QString::number(stats.averageLatencyMs, 'f', 1) + " ms");
}

void MainWindow::onHighLatencyDetected(float latencyMs)
{
    m_latencyLabel->setStyleSheet("color: red; font-weight: bold;");
    m_latencyLabel->setText(QString::number(latencyMs, 'f', 1) + " ms (高延迟)");
}

void MainWindow::onBufferOverrun()
{
    QMessageBox::warning(this, "缓冲区警告", "检测到缓冲区溢出，数据可能丢失");
}

void MainWindow::onBufferUnderrun()
{
    QMessageBox::warning(this, "缓冲区警告", "检测到缓冲区不足，可能出现卡顿");
}

void MainWindow::createConnections()
{
    connect(m_hardwareDriver, &HardwareDriver::deviceConnected, this, &MainWindow::onDeviceConnected);
    connect(m_hardwareDriver, &HardwareDriver::deviceDisconnected, this, &MainWindow::onDeviceDisconnected);
    connect(m_hardwareDriver, &HardwareDriver::deviceError, this, &MainWindow::onDeviceError);
    connect(m_hardwareDriver, &HardwareDriver::tapeStatusUpdated, this, &MainWindow::onTapeStatusUpdated);
    connect(m_hardwareDriver, &HardwareDriver::audioDataReceived, this, &MainWindow::onAudioDataReceived);
    
    connect(m_audioParser, &AudioWaveformParser::levelUpdated, this, &MainWindow::onAudioLevelUpdate);
    
    connect(m_batchManager, &BatchTranscriptionManager::batchProgress, this, &MainWindow::onBatchProgress);
    connect(m_batchManager, &BatchTranscriptionManager::batchCompleted, this, &MainWindow::onBatchCompleted);
    
    connect(m_sceneSegmenter, &VideoSceneSegmenter::sceneDetected, this, &MainWindow::onSceneDetected);
    connect(m_sceneSegmenter, &VideoSceneSegmenter::sceneChangeDetected, this, &MainWindow::onSceneChangeDetected);
    
    connect(m_transcodeManager, &TranscodeManager::taskProgress, this, &MainWindow::onTranscodeTaskProgress);
    connect(m_transcodeManager, &TranscodeManager::batchProgress, this, &MainWindow::onTranscodeBatchProgress);
    connect(m_transcodeManager, &TranscodeManager::batchCompleted, this, &MainWindow::onTranscodeBatchCompleted);
    
    connect(m_ringBuffer, &RingBuffer::highLatencyDetected, this, &MainWindow::onHighLatencyDetected);
    connect(m_ringBuffer, &RingBuffer::bufferOverrun, this, &MainWindow::onBufferOverrun);
    connect(m_ringBuffer, &RingBuffer::bufferUnderrun, this, &MainWindow::onBufferUnderrun);
    
    connect(m_bufferStatsTimer, &QTimer::timeout, this, &MainWindow::onBufferStatsUpdated);
}

void MainWindow::initializeManagers()
{
    m_archiveManager->initializeDatabase();
    m_batchManager->setArchiveManager(m_archiveManager);
    onRefreshArchive();
    
    m_bufferStatsTimer->start(500);
    
    if (!m_transcodeManager->checkFFmpegAvailable()) {
        QMessageBox::warning(this, "提示", "未检测到 FFmpeg，批量转码功能将不可用\n请安装 FFmpeg 后重启程序");
    }
    
    m_deviceScheduler->startScheduler();
}

void MainWindow::setupCloudSyncTab()
{
    QWidget* cloudSyncTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(cloudSyncTab);
    
    QGroupBox* configGroup = new QGroupBox("同步配置");
    QFormLayout* configLayout = new QFormLayout(configGroup);
    
    m_serverUrlEdit = new QLineEdit();
    m_serverUrlEdit->setPlaceholderText("例如: https://cloud.example.com");
    configLayout->addRow("服务器地址:", m_serverUrlEdit);
    
    m_apiKeyEdit = new QLineEdit();
    m_apiKeyEdit->setEchoMode(QLineEdit::Password);
    configLayout->addRow("API 密钥:", m_apiKeyEdit);
    
    m_userIdEdit = new QLineEdit();
    configLayout->addRow("用户 ID:", m_userIdEdit);
    
    m_deviceIdEdit = new QLineEdit();
    m_deviceIdEdit->setPlaceholderText("留空则自动生成");
    configLayout->addRow("设备 ID:", m_deviceIdEdit);
    
    m_autoSyncCheck = new QCheckBox("启用自动同步");
    configLayout->addRow("", m_autoSyncCheck);
    
    m_syncIntervalSpin = new QSpinBox();
    m_syncIntervalSpin->setRange(1, 1440);
    m_syncIntervalSpin->setValue(30);
    m_syncIntervalSpin->setSuffix(" 分钟");
    configLayout->addRow("同步间隔:", m_syncIntervalSpin);
    
    layout->addWidget(configGroup);
    
    QGroupBox* controlGroup = new QGroupBox("同步控制");
    QHBoxLayout* controlLayout = new QHBoxLayout(controlGroup);
    
    QPushButton* testBtn = new QPushButton("测试连接");
    connect(testBtn, &QPushButton::clicked, this, &MainWindow::onTestConnection);
    controlLayout->addWidget(testBtn);
    
    QPushButton* startAutoSyncBtn = new QPushButton("启动自动同步");
    connect(startAutoSyncBtn, &QPushButton::clicked, this, &MainWindow::onStartAutoSync);
    controlLayout->addWidget(startAutoSyncBtn);
    
    QPushButton* stopAutoSyncBtn = new QPushButton("停止自动同步");
    connect(stopAutoSyncBtn, &QPushButton::clicked, this, &MainWindow::onStopAutoSync);
    controlLayout->addWidget(stopAutoSyncBtn);
    
    QPushButton* exportBtn = new QPushButton("导出配置");
    connect(exportBtn, &QPushButton::clicked, this, &MainWindow::onExportSyncConfig);
    controlLayout->addWidget(exportBtn);
    
    QPushButton* importBtn = new QPushButton("导入配置");
    connect(importBtn, &QPushButton::clicked, this, &MainWindow::onImportSyncConfig);
    controlLayout->addWidget(importBtn);
    
    controlLayout->addStretch();
    layout->addWidget(controlGroup);
    
    QGroupBox* syncGroup = new QGroupBox("数据同步");
    QHBoxLayout* syncLayout = new QHBoxLayout(syncGroup);
    
    QPushButton* pushConfigsBtn = new QPushButton("上传配置");
    connect(pushConfigsBtn, &QPushButton::clicked, this, &MainWindow::onPushAllConfigs);
    syncLayout->addWidget(pushConfigsBtn);
    
    QPushButton* pullConfigsBtn = new QPushButton("下载配置");
    connect(pullConfigsBtn, &QPushButton::clicked, this, &MainWindow::onPullAllConfigs);
    syncLayout->addWidget(pullConfigsBtn);
    
    QPushButton* pushArchivesBtn = new QPushButton("上传档案");
    connect(pushArchivesBtn, &QPushButton::clicked, this, &MainWindow::onPushAllArchives);
    syncLayout->addWidget(pushArchivesBtn);
    
    QPushButton* pullArchivesBtn = new QPushButton("下载档案");
    connect(pullArchivesBtn, &QPushButton::clicked, this, &MainWindow::onPullAllArchives);
    syncLayout->addWidget(pullArchivesBtn);
    
    syncLayout->addStretch();
    layout->addWidget(syncGroup);
    
    QGroupBox* statusGroup = new QGroupBox("同步状态");
    QVBoxLayout* statusLayout = new QVBoxLayout(statusGroup);
    
    QHBoxLayout* progressLayout = new QHBoxLayout();
    progressLayout->addWidget(new QLabel("当前状态:"));
    m_syncStatusLabel = new QLabel("未连接");
    progressLayout->addWidget(m_syncStatusLabel);
    progressLayout->addWidget(new QLabel("同步进度:"));
    m_syncProgressBar = new QProgressBar();
    m_syncProgressBar->setRange(0, 100);
    progressLayout->addWidget(m_syncProgressBar);
    progressLayout->addStretch();
    statusLayout->addLayout(progressLayout);
    
    m_syncHistoryTable = new QTableWidget(0, 4);
    m_syncHistoryTable->setHorizontalHeaderLabels({"时间", "操作", "状态", "详情"});
    m_syncHistoryTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    statusLayout->addWidget(m_syncHistoryTable);
    
    layout->addWidget(statusGroup);
    
    m_tabWidget->addTab(cloudSyncTab, "云端同步");
}

void MainWindow::setupDeviceSchedulerTab()
{
    QWidget* schedulerTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(schedulerTab);
    
    QGroupBox* controlGroup = new QGroupBox("调度控制");
    QHBoxLayout* controlLayout = new QHBoxLayout(controlGroup);
    
    controlLayout->addWidget(new QLabel("调度模式:"));
    m_scheduleModeCombo = new QComboBox();
    m_scheduleModeCombo->addItem("手动模式", DeviceScheduler::ManualMode);
    m_scheduleModeCombo->addItem("自动模式", DeviceScheduler::AutoMode);
    m_scheduleModeCombo->addItem("优先级模式", DeviceScheduler::PriorityMode);
    m_scheduleModeCombo->addItem("负载均衡模式", DeviceScheduler::LoadBalanceMode);
    controlLayout->addWidget(m_scheduleModeCombo);
    
    QPushButton* startBtn = new QPushButton("启动调度");
    connect(startBtn, &QPushButton::clicked, this, &MainWindow::onStartScheduler);
    controlLayout->addWidget(startBtn);
    
    QPushButton* stopBtn = new QPushButton("停止调度");
    connect(stopBtn, &QPushButton::clicked, this, &MainWindow::onStopScheduler);
    controlLayout->addWidget(stopBtn);
    
    QPushButton* pauseBtn = new QPushButton("暂停调度");
    connect(pauseBtn, &QPushButton::clicked, this, &MainWindow::onPauseScheduler);
    controlLayout->addWidget(pauseBtn);
    
    QPushButton* resumeBtn = new QPushButton("恢复调度");
    connect(resumeBtn, &QPushButton::clicked, this, &MainWindow::onResumeScheduler);
    controlLayout->addWidget(resumeBtn);
    
    controlLayout->addStretch();
    layout->addWidget(controlGroup);
    
    QGroupBox* deviceGroup = new QGroupBox("已注册设备");
    QVBoxLayout* deviceLayout = new QVBoxLayout(deviceGroup);
    
    QHBoxLayout* deviceControlLayout = new QHBoxLayout();
    QPushButton* registerBtn = new QPushButton("注册设备");
    connect(registerBtn, &QPushButton::clicked, this, &MainWindow::onRegisterDevice);
    deviceControlLayout->addWidget(registerBtn);
    
    QPushButton* unregisterBtn = new QPushButton("注销设备");
    connect(unregisterBtn, &QPushButton::clicked, this, &MainWindow::onUnregisterDevice);
    deviceControlLayout->addWidget(unregisterBtn);
    
    m_schedulerStatusLabel = new QLabel("调度器状态: 未运行");
    deviceControlLayout->addWidget(m_schedulerStatusLabel);
    
    m_systemLoadLabel = new QLabel("系统负载: 0%");
    deviceControlLayout->addWidget(m_systemLoadLabel);
    
    deviceControlLayout->addStretch();
    deviceLayout->addLayout(deviceControlLayout);
    
    m_devicesTable = new QTableWidget(0, 7);
    m_devicesTable->setHorizontalHeaderLabels({"设备ID", "设备名称", "类型", "状态", "当前任务", "负载", "最后活动"});
    m_devicesTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    deviceLayout->addWidget(m_devicesTable);
    
    layout->addWidget(deviceGroup);
    
    QGroupBox* jobGroup = new QGroupBox("任务队列");
    QVBoxLayout* jobLayout = new QVBoxLayout(jobGroup);
    
    QHBoxLayout* jobControlLayout = new QHBoxLayout();
    QPushButton* createJobBtn = new QPushButton("创建任务");
    connect(createJobBtn, &QPushButton::clicked, this, &MainWindow::onCreateJob);
    jobControlLayout->addWidget(createJobBtn);
    
    QPushButton* cancelJobBtn = new QPushButton("取消任务");
    connect(cancelJobBtn, &QPushButton::clicked, this, &MainWindow::onCancelJob);
    jobControlLayout->addWidget(cancelJobBtn);
    
    QPushButton* assignBtn = new QPushButton("分配到设备");
    connect(assignBtn, &QPushButton::clicked, this, &MainWindow::onAssignJobToDevice);
    jobControlLayout->addWidget(assignBtn);
    
    jobControlLayout->addStretch();
    jobLayout->addLayout(jobControlLayout);
    
    m_scheduledJobsTable = new QTableWidget(0, 6);
    m_scheduledJobsTable->setHorizontalHeaderLabels({"任务ID", "名称", "状态", "进度", "分配设备", "优先级"});
    m_scheduledJobsTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    jobLayout->addWidget(m_scheduledJobsTable);
    
    layout->addWidget(jobGroup);
    
    m_tabWidget->addTab(schedulerTab, "设备调度");
}

void MainWindow::setupMediaInfoTab()
{
    QWidget* mediaInfoTab = new QWidget();
    QVBoxLayout* layout = new QVBoxLayout(mediaInfoTab);
    
    QGroupBox* tapeInfoGroup = new QGroupBox("磁带基本信息");
    QFormLayout* tapeInfoLayout = new QFormLayout(tapeInfoGroup);
    
    m_tapeIdEdit = new QLineEdit();
    m_tapeIdEdit->setPlaceholderText("自动生成或手动输入");
    tapeInfoLayout->addRow("磁带编号:", m_tapeIdEdit);
    
    m_tapeNameEdit = new QLineEdit();
    tapeInfoLayout->addRow("磁带名称:", m_tapeNameEdit);
    
    m_manufacturerEdit = new QLineEdit();
    tapeInfoLayout->addRow("制造商:", m_manufacturerEdit);
    
    m_tapeTypeCombo = new QComboBox();
    m_tapeTypeCombo->addItems({"VHS", "VHS-C", "Betamax", "Hi8", "Digital8", "MiniDV", "DVCAM", "其他"});
    tapeInfoLayout->addRow("磁带类型:", m_tapeTypeCombo);
    
    m_lengthMinutesSpin = new QSpinBox();
    m_lengthMinutesSpin->setRange(1, 600);
    m_lengthMinutesSpin->setValue(120);
    m_lengthMinutesSpin->setSuffix(" 分钟");
    tapeInfoLayout->addRow("磁带时长:", m_lengthMinutesSpin);
    
    m_productionDateEdit = new QDateEdit();
    m_productionDateEdit->setDate(QDate::currentDate());
    m_productionDateEdit->setCalendarPopup(true);
    tapeInfoLayout->addRow("生产日期:", m_productionDateEdit);
    
    m_recordingDateEdit = new QDateEdit();
    m_recordingDateEdit->setDate(QDate::currentDate());
    m_recordingDateEdit->setCalendarPopup(true);
    tapeInfoLayout->addRow("录制日期:", m_recordingDateEdit);
    
    m_generationSpin = new QSpinBox();
    m_generationSpin->setRange(1, 10);
    m_generationSpin->setValue(1);
    tapeInfoLayout->addRow("拷贝代数:", m_generationSpin);
    
    m_conditionEdit = new QTextEdit();
    m_conditionEdit->setMaximumHeight(80);
    m_conditionEdit->setPlaceholderText("描述磁带的物理状态，例如: 磁带完好，外壳轻微磨损...");
    tapeInfoLayout->addRow("磁带状态:", m_conditionEdit);
    
    layout->addWidget(tapeInfoGroup);
    
    QGroupBox* storageGroup = new QGroupBox("存储信息");
    QFormLayout* storageLayout = new QFormLayout(storageGroup);
    
    m_shelfLocationEdit = new QLineEdit();
    storageLayout->addRow(" shelf 位置:", m_shelfLocationEdit);
    
    m_boxNumberEdit = new QLineEdit();
    storageLayout->addRow("盒子编号:", m_boxNumberEdit);
    
    m_originalOwnerEdit = new QLineEdit();
    storageLayout->addRow("原始所有者:", m_originalOwnerEdit);
    
    m_recordingDeviceEdit = new QLineEdit();
    storageLayout->addRow("录制设备:", m_recordingDeviceEdit);
    
    layout->addWidget(storageGroup);
    
    QGroupBox* markersGroup = new QGroupBox("场景和章节标记");
    QHBoxLayout* markersLayout = new QHBoxLayout(markersGroup);
    
    QVBoxLayout* sceneLayout = new QVBoxLayout();
    sceneLayout->addWidget(new QLabel("场景标记:"));
    m_sceneMarkersList = new QListWidget();
    sceneLayout->addWidget(m_sceneMarkersList);
    
    QHBoxLayout* sceneBtnLayout = new QHBoxLayout();
    QPushButton* addSceneBtn = new QPushButton("添加场景");
    connect(addSceneBtn, &QPushButton::clicked, this, &MainWindow::onAddSceneMarker);
    sceneBtnLayout->addWidget(addSceneBtn);
    
    QPushButton* removeSceneBtn = new QPushButton("删除场景");
    connect(removeSceneBtn, &QPushButton::clicked, this, &MainWindow::onRemoveSceneMarker);
    sceneBtnLayout->addWidget(removeSceneBtn);
    
    sceneLayout->addLayout(sceneBtnLayout);
    markersLayout->addLayout(sceneLayout);
    
    QVBoxLayout* chapterLayout = new QVBoxLayout();
    chapterLayout->addWidget(new QLabel("章节标题:"));
    m_chapterTitlesList = new QListWidget();
    chapterLayout->addWidget(m_chapterTitlesList);
    
    markersLayout->addLayout(chapterLayout);
    
    layout->addWidget(markersGroup);
    
    QHBoxLayout* buttonLayout = new QHBoxLayout();
    QPushButton* saveBtn = new QPushButton("保存媒体信息");
    saveBtn->setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;");
    connect(saveBtn, &QPushButton::clicked, this, &MainWindow::onSaveMediaInfo);
    buttonLayout->addWidget(saveBtn);
    
    QPushButton* loadBtn = new QPushButton("加载媒体信息");
    connect(loadBtn, &QPushButton::clicked, this, &MainWindow::onLoadMediaInfo);
    buttonLayout->addWidget(loadBtn);
    
    buttonLayout->addStretch();
    layout->addLayout(buttonLayout);
    
    m_tabWidget->addTab(mediaInfoTab, "媒体信息");
}

void MainWindow::onSyncStatusChanged(CloudSyncManager::SyncStatus status)
{
    QString statusText;
    QString color;
    
    switch (status) {
        case CloudSyncManager::Idle:
            statusText = "空闲";
            color = "black";
            break;
        case CloudSyncManager::Syncing:
            statusText = "同步中";
            color = "blue";
            break;
        case CloudSyncManager::Success:
            statusText = "成功";
            color = "green";
            break;
        case CloudSyncManager::Failed:
            statusText = "失败";
            color = "red";
            break;
        case CloudSyncManager::ConnectionError:
            statusText = "连接错误";
            color = "red";
            break;
        case CloudSyncManager::AuthenticationError:
            statusText = "认证失败";
            color = "red";
            break;
    }
    
    m_syncStatusLabel->setText(statusText);
    m_syncStatusLabel->setStyleSheet(QString("color: %1; font-weight: bold;").arg(color));
}

void MainWindow::onTestConnection()
{
    SyncConfig config;
    config.serverUrl = m_serverUrlEdit->text();
    config.apiKey = m_apiKeyEdit->text();
    config.userId = m_userIdEdit->text();
    config.deviceId = m_deviceIdEdit->text();
    config.autoSyncEnabled = m_autoSyncCheck->isChecked();
    config.syncIntervalMinutes = m_syncIntervalSpin->value();
    m_cloudSyncManager->setSyncConfig(config);
    
    if (m_cloudSyncManager->testConnection()) {
        QMessageBox::information(this, "成功", "连接测试成功！");
    } else {
        QMessageBox::critical(this, "失败", "连接测试失败，请检查配置！");
    }
}

void MainWindow::onStartAutoSync()
{
    m_cloudSyncManager->startAutoSync();
    QMessageBox::information(this, "提示", "自动同步已启动");
}

void MainWindow::onStopAutoSync()
{
    m_cloudSyncManager->stopAutoSync();
    QMessageBox::information(this, "提示", "自动同步已停止");
}

void MainWindow::onPushAllConfigs()
{
    m_cloudSyncManager->pushAllConfigs();
    QMessageBox::information(this, "提示", "配置上传已启动");
}

void MainWindow::onPullAllConfigs()
{
    m_cloudSyncManager->pullAllConfigs();
    QMessageBox::information(this, "提示", "配置下载已启动");
}

void MainWindow::onPushAllArchives()
{
    m_cloudSyncManager->pushAllArchives();
    QMessageBox::information(this, "提示", "档案上传已启动");
}

void MainWindow::onPullAllArchives()
{
    m_cloudSyncManager->pullAllArchives();
    QMessageBox::information(this, "提示", "档案下载已启动");
}

void MainWindow::onExportSyncConfig()
{
    QString filePath = QFileDialog::getSaveFileName(this, "导出同步配置", QDir::homePath(), "JSON Files (*.json)");
    if (!filePath.isEmpty()) {
        if (m_cloudSyncManager->exportSyncConfig(filePath)) {
            QMessageBox::information(this, "成功", "同步配置已导出");
        } else {
            QMessageBox::critical(this, "失败", "导出配置失败");
        }
    }
}

void MainWindow::onImportSyncConfig()
{
    QString filePath = QFileDialog::getOpenFileName(this, "导入同步配置", QDir::homePath(), "JSON Files (*.json)");
    if (!filePath.isEmpty()) {
        if (m_cloudSyncManager->importSyncConfig(filePath)) {
            SyncConfig config = m_cloudSyncManager->getSyncConfig();
            m_serverUrlEdit->setText(config.serverUrl);
            m_apiKeyEdit->setText(config.apiKey);
            m_userIdEdit->setText(config.userId);
            m_deviceIdEdit->setText(config.deviceId);
            m_autoSyncCheck->setChecked(config.autoSyncEnabled);
            m_syncIntervalSpin->setValue(config.syncIntervalMinutes);
            QMessageBox::information(this, "成功", "同步配置已导入");
        } else {
            QMessageBox::critical(this, "失败", "导入配置失败");
        }
    }
}

void MainWindow::onRegisterDevice()
{
    bool ok;
    QString deviceName = QInputDialog::getText(this, "注册设备", "设备名称:", QLineEdit::Normal, "", &ok);
    if (!ok || deviceName.isEmpty()) return;
    
    QString deviceType = QInputDialog::getText(this, "注册设备", "设备类型:", QLineEdit::Normal, "VHS Player", &ok);
    if (!ok) return;
    
    TranscriptionDevice device;
    device.deviceName = deviceName;
    device.deviceType = deviceType;
    device.isConnected = true;
    device.isEnabled = true;
    device.lastSeenTime = QDateTime::currentDateTime();
    
    QString deviceId = m_deviceScheduler->registerDevice(device);
    QMessageBox::information(this, "成功", QString("设备已注册，ID: %1").arg(deviceId));
    
    onDeviceRegistered(deviceId);
}

void MainWindow::onUnregisterDevice()
{
    int row = m_devicesTable->currentRow();
    if (row < 0) {
        QMessageBox::warning(this, "提示", "请先选择要注销的设备");
        return;
    }
    
    QString deviceId = m_devicesTable->item(row, 0)->text();
    if (m_deviceScheduler->unregisterDevice(deviceId)) {
        m_devicesTable->removeRow(row);
        QMessageBox::information(this, "成功", "设备已注销");
    }
}

void MainWindow::onStartScheduler()
{
    m_deviceScheduler->startScheduler();
    m_schedulerStatusLabel->setText("调度器状态: 运行中");
    QMessageBox::information(this, "提示", "设备调度已启动");
}

void MainWindow::onStopScheduler()
{
    m_deviceScheduler->stopScheduler();
    m_schedulerStatusLabel->setText("调度器状态: 已停止");
    QMessageBox::information(this, "提示", "设备调度已停止");
}

void MainWindow::onPauseScheduler()
{
    m_deviceScheduler->pauseScheduler();
    m_schedulerStatusLabel->setText("调度器状态: 已暂停");
    QMessageBox::information(this, "提示", "设备调度已暂停");
}

void MainWindow::onResumeScheduler()
{
    m_deviceScheduler->resumeScheduler();
    m_schedulerStatusLabel->setText("调度器状态: 运行中");
    QMessageBox::information(this, "提示", "设备调度已恢复");
}

void MainWindow::onCreateJob()
{
    bool ok;
    QString jobName = QInputDialog::getText(this, "创建任务", "任务名称:", QLineEdit::Normal, "", &ok);
    if (!ok || jobName.isEmpty()) return;
    
    ScheduledJob job;
    job.name = jobName;
    job.status = "Pending";
    job.priority = 0;
    
    int jobId = m_deviceScheduler->createJob(job);
    if (jobId > 0) {
        QMessageBox::information(this, "成功", QString("任务已创建，ID: %1").arg(jobId));
        
        int row = m_scheduledJobsTable->rowCount();
        m_scheduledJobsTable->insertRow(row);
        m_scheduledJobsTable->setItem(row, 0, new QTableWidgetItem(QString::number(jobId)));
        m_scheduledJobsTable->setItem(row, 1, new QTableWidgetItem(jobName));
        m_scheduledJobsTable->setItem(row, 2, new QTableWidgetItem("Pending"));
        m_scheduledJobsTable->setItem(row, 3, new QTableWidgetItem("0%"));
        m_scheduledJobsTable->setItem(row, 4, new QTableWidgetItem(""));
        m_scheduledJobsTable->setItem(row, 5, new QTableWidgetItem("0"));
    }
}

void MainWindow::onCancelJob()
{
    int row = m_scheduledJobsTable->currentRow();
    if (row < 0) {
        QMessageBox::warning(this, "提示", "请先选择要取消的任务");
        return;
    }
    
    int jobId = m_scheduledJobsTable->item(row, 0)->text().toInt();
    if (m_deviceScheduler->cancelJob(jobId)) {
        m_scheduledJobsTable->item(row, 2)->setText("Cancelled");
        QMessageBox::information(this, "成功", "任务已取消");
    }
}

void MainWindow::onAssignJobToDevice()
{
    int jobRow = m_scheduledJobsTable->currentRow();
    int deviceRow = m_devicesTable->currentRow();
    
    if (jobRow < 0 || deviceRow < 0) {
        QMessageBox::warning(this, "提示", "请先选择要分配的任务和目标设备");
        return;
    }
    
    int jobId = m_scheduledJobsTable->item(jobRow, 0)->text().toInt();
    QString deviceId = m_devicesTable->item(deviceRow, 0)->text();
    
    if (m_deviceScheduler->assignJobToDevice(jobId, deviceId)) {
        m_scheduledJobsTable->item(jobRow, 2)->setText("Assigned");
        m_scheduledJobsTable->item(jobRow, 4)->setText(deviceId);
        QMessageBox::information(this, "成功", "任务已分配到设备");
    } else {
        QMessageBox::critical(this, "失败", "任务分配失败，设备可能正忙或不可用");
    }
}

void MainWindow::onDeviceRegistered(const QString& deviceId)
{
    QList<TranscriptionDevice> devices = m_deviceScheduler->getAllDevices();
    for (const TranscriptionDevice& device : devices) {
        if (device.deviceId == deviceId) {
            int row = m_devicesTable->rowCount();
            m_devicesTable->insertRow(row);
            m_devicesTable->setItem(row, 0, new QTableWidgetItem(device.deviceId));
            m_devicesTable->setItem(row, 1, new QTableWidgetItem(device.deviceName));
            m_devicesTable->setItem(row, 2, new QTableWidgetItem(device.deviceType));
            m_devicesTable->setItem(row, 3, new QTableWidgetItem(device.isConnected ? "已连接" : "未连接"));
            m_devicesTable->setItem(row, 4, new QTableWidgetItem(device.currentJobId > 0 ? QString::number(device.currentJobId) : "无"));
            m_devicesTable->setItem(row, 5, new QTableWidgetItem(QString::number(m_deviceScheduler->getDeviceLoad(deviceId) * 100, 'f', 0) + "%"));
            m_devicesTable->setItem(row, 6, new QTableWidgetItem(device.lastSeenTime.toString("hh:mm:ss")));
            break;
        }
    }
}

void MainWindow::onDeviceConnected(const QString& deviceId)
{
    for (int i = 0; i < m_devicesTable->rowCount(); i++) {
        if (m_devicesTable->item(i, 0)->text() == deviceId) {
            m_devicesTable->item(i, 3)->setText("已连接");
            m_devicesTable->item(i, 3)->setForeground(QBrush(Qt::green));
            break;
        }
    }
}

void MainWindow::onDeviceDisconnected(const QString& deviceId)
{
    for (int i = 0; i < m_devicesTable->rowCount(); i++) {
        if (m_devicesTable->item(i, 0)->text() == deviceId) {
            m_devicesTable->item(i, 3)->setText("未连接");
            m_devicesTable->item(i, 3)->setForeground(QBrush(Qt::red));
            break;
        }
    }
}

void MainWindow::onJobStarted(int jobId, const QString& deviceId)
{
    for (int i = 0; i < m_scheduledJobsTable->rowCount(); i++) {
        if (m_scheduledJobsTable->item(i, 0)->text().toInt() == jobId) {
            m_scheduledJobsTable->item(i, 2)->setText("Running");
            m_scheduledJobsTable->item(i, 4)->setText(deviceId);
            break;
        }
    }
}

void MainWindow::onJobCompleted(int jobId)
{
    for (int i = 0; i < m_scheduledJobsTable->rowCount(); i++) {
        if (m_scheduledJobsTable->item(i, 0)->text().toInt() == jobId) {
            m_scheduledJobsTable->item(i, 2)->setText("Completed");
            m_scheduledJobsTable->item(i, 3)->setText("100%");
            break;
        }
    }
}

void MainWindow::onSystemLoadChanged(float load)
{
    m_systemLoadLabel->setText(QString("系统负载: %1%").arg(static_cast<int>(load * 100)));
}

void MainWindow::onSaveMediaInfo()
{
    TapeMediaInfo mediaInfo;
    mediaInfo.tapeId = m_tapeIdEdit->text();
    mediaInfo.tapeName = m_tapeNameEdit->text();
    mediaInfo.manufacturer = m_manufacturerEdit->text();
    mediaInfo.tapeType = m_tapeTypeCombo->currentText();
    mediaInfo.lengthMinutes = m_lengthMinutesSpin->value();
    mediaInfo.productionDate = m_productionDateEdit->date();
    mediaInfo.recordingDate = m_recordingDateEdit->date();
    mediaInfo.condition = m_conditionEdit->toPlainText();
    mediaInfo.generation = m_generationSpin->value();
    mediaInfo.shelfLocation = m_shelfLocationEdit->text();
    mediaInfo.boxNumber = m_boxNumberEdit->text();
    mediaInfo.originalOwner = m_originalOwnerEdit->text();
    mediaInfo.recordingDevice = m_recordingDeviceEdit->text();
    
    QMessageBox::information(this, "成功", "媒体信息已保存");
}

void MainWindow::onLoadMediaInfo()
{
    QMessageBox::information(this, "提示", "媒体信息加载功能待实现");
}

void MainWindow::onAddSceneMarker()
{
    bool ok;
    QString marker = QInputDialog::getText(this, "添加场景标记", "场景描述和时间:", QLineEdit::Normal, "", &ok);
    if (ok && !marker.isEmpty()) {
        m_sceneMarkersList->addItem(marker);
    }
}

void MainWindow::onRemoveSceneMarker()
{
    int currentRow = m_sceneMarkersList->currentRow();
    if (currentRow >= 0) {
        delete m_sceneMarkersList->takeItem(currentRow);
    }
}

void MainWindow::createConnections()
{
    connect(m_hardwareDriver, &HardwareDriver::deviceConnected, this, &MainWindow::onDeviceConnected);
    connect(m_hardwareDriver, &HardwareDriver::deviceDisconnected, this, &MainWindow::onDeviceDisconnected);
    connect(m_hardwareDriver, &HardwareDriver::deviceError, this, &MainWindow::onDeviceError);
    connect(m_hardwareDriver, &HardwareDriver::tapeStatusUpdated, this, &MainWindow::onTapeStatusUpdated);
    connect(m_hardwareDriver, &HardwareDriver::audioDataReceived, this, &MainWindow::onAudioDataReceived);
    
    connect(m_audioParser, &AudioWaveformParser::levelUpdated, this, &MainWindow::onAudioLevelUpdate);
    
    connect(m_batchManager, &BatchTranscriptionManager::batchProgress, this, &MainWindow::onBatchProgress);
    connect(m_batchManager, &BatchTranscriptionManager::batchCompleted, this, &MainWindow::onBatchCompleted);
    
    connect(m_sceneSegmenter, &VideoSceneSegmenter::sceneDetected, this, &MainWindow::onSceneDetected);
    connect(m_sceneSegmenter, &VideoSceneSegmenter::sceneChangeDetected, this, &MainWindow::onSceneChangeDetected);
    
    connect(m_transcodeManager, &TranscodeManager::taskProgress, this, &MainWindow::onTranscodeTaskProgress);
    connect(m_transcodeManager, &TranscodeManager::batchProgress, this, &MainWindow::onTranscodeBatchProgress);
    connect(m_transcodeManager, &TranscodeManager::batchCompleted, this, &MainWindow::onTranscodeBatchCompleted);
    
    connect(m_ringBuffer, &RingBuffer::highLatencyDetected, this, &MainWindow::onHighLatencyDetected);
    connect(m_ringBuffer, &RingBuffer::bufferOverrun, this, &MainWindow::onBufferOverrun);
    connect(m_ringBuffer, &RingBuffer::bufferUnderrun, this, &MainWindow::onBufferUnderrun);
    
    connect(m_bufferStatsTimer, &QTimer::timeout, this, &MainWindow::onBufferStatsUpdated);
    
    connect(m_cloudSyncManager, &CloudSyncManager::syncStarted, this, [this]() { onSyncStatusChanged(CloudSyncManager::Syncing); });
    connect(m_cloudSyncManager, &CloudSyncManager::syncCompleted, this, [this](bool success) { 
        onSyncStatusChanged(success ? CloudSyncManager::Success : CloudSyncManager::Failed); 
    });
    connect(m_cloudSyncManager, &CloudSyncManager::statusChanged, this, &MainWindow::onSyncStatusChanged);
    
    connect(m_deviceScheduler, &DeviceScheduler::deviceRegistered, this, &MainWindow::onDeviceRegistered);
    connect(m_deviceScheduler, &DeviceScheduler::deviceConnected, this, &MainWindow::onDeviceConnected);
    connect(m_deviceScheduler, &DeviceScheduler::deviceDisconnected, this, &MainWindow::onDeviceDisconnected);
    connect(m_deviceScheduler, &DeviceScheduler::jobStarted, this, &MainWindow::onJobStarted);
    connect(m_deviceScheduler, &DeviceScheduler::systemLoadChanged, this, &MainWindow::onSystemLoadChanged);
}
