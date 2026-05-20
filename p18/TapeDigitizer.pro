QT       += core gui widgets serialport sql multimedia printsupport network

greaterThan(QT_MAJOR_VERSION, 4): QT += widgets

CONFIG += c++17

TARGET = TapeDigitizer
TEMPLATE = app

DEFINES += QT_DEPRECATED_WARNINGS

SOURCES += \
    src/main.cpp \
    src/mainwindow.cpp \
    src/hardware/HardwareDriver.cpp \
    src/hardware/RingBuffer.cpp \
    src/hardware/DeviceScheduler.cpp \
    src/hardware/HardwareCompatibilityLayer.cpp \
    src/audio/AudioWaveformParser.cpp \
    src/video/VideoNoiseReducer.cpp \
    src/video/VideoSceneSegmenter.cpp \
    src/video/ColorCorrector.cpp \
    src/config/TranscriptionConfig.cpp \
    src/config/CloudSyncManager.cpp \
    src/archive/MediaArchiveManager.cpp \
    src/widgets/AudioWaveformWidget.cpp \
    src/widgets/NoisePreviewWidget.cpp \
    src/batch/BatchTranscriptionManager.cpp \
    src/transcode/TranscodeManager.cpp \
    src/utils/LazyLoader.cpp \
    src/utils/MemoryStreamProcessor.cpp

HEADERS += \
    src/mainwindow.h \
    src/hardware/HardwareDriver.h \
    src/hardware/RingBuffer.h \
    src/hardware/DeviceScheduler.h \
    src/hardware/HardwareCompatibilityLayer.h \
    src/audio/AudioWaveformParser.h \
    src/video/VideoNoiseReducer.h \
    src/video/VideoSceneSegmenter.h \
    src/video/ColorCorrector.h \
    src/config/TranscriptionConfig.h \
    src/config/CloudSyncManager.h \
    src/archive/MediaArchiveManager.h \
    src/widgets/AudioWaveformWidget.h \
    src/widgets/NoisePreviewWidget.h \
    src/batch/BatchTranscriptionManager.h \
    src/transcode/TranscodeManager.h \
    src/utils/LazyLoader.h \
    src/utils/MemoryStreamProcessor.h

FORMS += \
    ui/mainwindow.ui

RESOURCES += \
    resources/resources.qrc

INCLUDEPATH += src

win32 {
    LIBS += -lsetupapi -lhid
}

unix {
    LIBS += -lusb-1.0
}
