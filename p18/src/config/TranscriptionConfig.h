#ifndef TRANSCRIPTIONCONFIG_H
#define TRANSCRIPTIONCONFIG_H

#include <QObject>
#include <QVariantMap>
#include "../video/VideoNoiseReducer.h"

struct AudioConfig {
    int sampleRate;
    int channelCount;
    int bitDepth;
    float noiseThreshold;
    bool enableNormalization;
    float targetLevel;
    
    AudioConfig()
        : sampleRate(48000)
        , channelCount(2)
        , bitDepth(16)
        , noiseThreshold(0.05f)
        , enableNormalization(true)
        , targetLevel(-1.0f)
    {}
};

struct VideoConfig {
    int width;
    int height;
    float frameRate;
    int bitrate;
    bool enableDenoise;
    bool enableColorCorrection;
    float brightness;
    float contrast;
    float saturation;
    float gamma;
    
    VideoConfig()
        : width(720)
        , height(480)
        , frameRate(29.97f)
        , bitrate(5000)
        , enableDenoise(true)
        , enableColorCorrection(true)
        , brightness(0.0f)
        , contrast(1.0f)
        , saturation(1.0f)
        , gamma(1.0f)
    {}
};

struct TapeModel {
    QString modelId;
    QString name;
    QString manufacturer;
    QString tapeType;
    int releaseYear;
    AudioConfig audioPreset;
    VideoConfig videoPreset;
    DenoiseParameters denoisePreset;
    QString notes;
    
    TapeModel()
        : releaseYear(1985)
    {}
};

class TranscriptionConfig : public QObject
{
    Q_OBJECT
public:
    explicit TranscriptionConfig(QObject *parent = nullptr);
    
    void setAudioConfig(const AudioConfig& config);
    AudioConfig getAudioConfig() const;
    
    void setVideoConfig(const VideoConfig& config);
    VideoConfig getVideoConfig() const;
    
    void setDenoiseParameters(const DenoiseParameters& params);
    DenoiseParameters getDenoiseParameters() const;
    
    QStringList getAvailableTapeModels() const;
    TapeModel getTapeModel(const QString& modelId) const;
    void addTapeModel(const TapeModel& model);
    void updateTapeModel(const QString& modelId, const TapeModel& model);
    void removeTapeModel(const QString& modelId);
    
    bool loadPreset(const QString& presetId);
    bool savePreset(const QString& name);
    void resetToDefaults();
    
    QVariantMap toVariantMap() const;
    void fromVariantMap(const QVariantMap& map);
    
    bool exportToFile(const QString& filePath) const;
    bool importFromFile(const QString& filePath);

signals:
    void configChanged();
    void audioConfigChanged(const AudioConfig& config);
    void videoConfigChanged(const VideoConfig& config);
    void denoiseParamsChanged(const DenoiseParameters& params);
    void tapeModelsChanged();

private:
    AudioConfig m_audioConfig;
    VideoConfig m_videoConfig;
    DenoiseParameters m_denoiseParams;
    QMap<QString, TapeModel> m_tapeModels;
    
    void initDefaultTapeModels();
};

#endif
