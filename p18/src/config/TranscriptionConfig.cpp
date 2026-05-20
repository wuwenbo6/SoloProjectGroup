#include "TranscriptionConfig.h"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDebug>
#include <QUuid>

TranscriptionConfig::TranscriptionConfig(QObject *parent)
    : QObject(parent)
{
    initDefaultTapeModels();
    resetToDefaults();
}

void TranscriptionConfig::setAudioConfig(const AudioConfig& config)
{
    m_audioConfig = config;
    emit audioConfigChanged(m_audioConfig);
    emit configChanged();
}

AudioConfig TranscriptionConfig::getAudioConfig() const
{
    return m_audioConfig;
}

void TranscriptionConfig::setVideoConfig(const VideoConfig& config)
{
    m_videoConfig = config;
    emit videoConfigChanged(m_videoConfig);
    emit configChanged();
}

VideoConfig TranscriptionConfig::getVideoConfig() const
{
    return m_videoConfig;
}

void TranscriptionConfig::setDenoiseParameters(const DenoiseParameters& params)
{
    m_denoiseParams = params;
    emit denoiseParamsChanged(m_denoiseParams);
    emit configChanged();
}

DenoiseParameters TranscriptionConfig::getDenoiseParameters() const
{
    return m_denoiseParams;
}

QStringList TranscriptionConfig::getAvailableTapeModels() const
{
    return m_tapeModels.keys();
}

TapeModel TranscriptionConfig::getTapeModel(const QString& modelId) const
{
    return m_tapeModels.value(modelId);
}

void TranscriptionConfig::addTapeModel(const TapeModel& model)
{
    QString id = model.modelId.isEmpty() ? QUuid::createUuid().toString() : model.modelId;
    TapeModel m = model;
    m.modelId = id;
    m_tapeModels[id] = m;
    emit tapeModelsChanged();
}

void TranscriptionConfig::updateTapeModel(const QString& modelId, const TapeModel& model)
{
    if (m_tapeModels.contains(modelId)) {
        m_tapeModels[modelId] = model;
        emit tapeModelsChanged();
    }
}

void TranscriptionConfig::removeTapeModel(const QString& modelId)
{
    if (m_tapeModels.remove(modelId) > 0) {
        emit tapeModelsChanged();
    }
}

bool TranscriptionConfig::loadPreset(const QString& presetId)
{
    if (m_tapeModels.contains(presetId)) {
        TapeModel model = m_tapeModels[presetId];
        m_audioConfig = model.audioPreset;
        m_videoConfig = model.videoPreset;
        m_denoiseParams = model.denoisePreset;
        emit configChanged();
        return true;
    }
    return false;
}

bool TranscriptionConfig::savePreset(const QString& name)
{
    TapeModel model;
    model.name = name;
    model.audioPreset = m_audioConfig;
    model.videoPreset = m_videoConfig;
    model.denoisePreset = m_denoiseParams;
    addTapeModel(model);
    return true;
}

void TranscriptionConfig::resetToDefaults()
{
    m_audioConfig = AudioConfig();
    m_videoConfig = VideoConfig();
    m_denoiseParams = DenoiseParameters();
    emit configChanged();
}

QVariantMap TranscriptionConfig::toVariantMap() const
{
    QVariantMap map;
    
    QVariantMap audio;
    audio["sampleRate"] = m_audioConfig.sampleRate;
    audio["channelCount"] = m_audioConfig.channelCount;
    audio["bitDepth"] = m_audioConfig.bitDepth;
    audio["noiseThreshold"] = m_audioConfig.noiseThreshold;
    audio["enableNormalization"] = m_audioConfig.enableNormalization;
    audio["targetLevel"] = m_audioConfig.targetLevel;
    map["audio"] = audio;
    
    QVariantMap video;
    video["width"] = m_videoConfig.width;
    video["height"] = m_videoConfig.height;
    video["frameRate"] = m_videoConfig.frameRate;
    video["bitrate"] = m_videoConfig.bitrate;
    video["enableDenoise"] = m_videoConfig.enableDenoise;
    video["enableColorCorrection"] = m_videoConfig.enableColorCorrection;
    video["brightness"] = m_videoConfig.brightness;
    video["contrast"] = m_videoConfig.contrast;
    video["saturation"] = m_videoConfig.saturation;
    video["gamma"] = m_videoConfig.gamma;
    map["video"] = video;
    
    QVariantMap denoise;
    denoise["luminanceStrength"] = m_denoiseParams.luminanceStrength;
    denoise["chrominanceStrength"] = m_denoiseParams.chrominanceStrength;
    denoise["temporalStrength"] = m_denoiseParams.temporalStrength;
    denoise["sharpenAmount"] = m_denoiseParams.sharpenAmount;
    denoise["enableDenoise"] = m_denoiseParams.enableDenoise;
    denoise["enableSharpen"] = m_denoiseParams.enableSharpen;
    map["denoise"] = denoise;
    
    QVariantList tapeModelsList;
    for (const QString& id : m_tapeModels.keys()) {
        const TapeModel& tm = m_tapeModels[id];
        QVariantMap tmMap;
        tmMap["modelId"] = tm.modelId;
        tmMap["name"] = tm.name;
        tmMap["manufacturer"] = tm.manufacturer;
        tmMap["tapeType"] = tm.tapeType;
        tmMap["releaseYear"] = tm.releaseYear;
        tmMap["notes"] = tm.notes;
        
        QVariantMap tmAudio;
        tmAudio["sampleRate"] = tm.audioPreset.sampleRate;
        tmAudio["channelCount"] = tm.audioPreset.channelCount;
        tmAudio["bitDepth"] = tm.audioPreset.bitDepth;
        tmAudio["noiseThreshold"] = tm.audioPreset.noiseThreshold;
        tmAudio["enableNormalization"] = tm.audioPreset.enableNormalization;
        tmAudio["targetLevel"] = tm.audioPreset.targetLevel;
        tmMap["audioPreset"] = tmAudio;
        
        QVariantMap tmVideo;
        tmVideo["width"] = tm.videoPreset.width;
        tmVideo["height"] = tm.videoPreset.height;
        tmVideo["frameRate"] = tm.videoPreset.frameRate;
        tmVideo["bitrate"] = tm.videoPreset.bitrate;
        tmVideo["enableDenoise"] = tm.videoPreset.enableDenoise;
        tmVideo["enableColorCorrection"] = tm.videoPreset.enableColorCorrection;
        tmVideo["brightness"] = tm.videoPreset.brightness;
        tmVideo["contrast"] = tm.videoPreset.contrast;
        tmVideo["saturation"] = tm.videoPreset.saturation;
        tmVideo["gamma"] = tm.videoPreset.gamma;
        tmMap["videoPreset"] = tmVideo;
        
        QVariantMap tmDenoise;
        tmDenoise["luminanceStrength"] = tm.denoisePreset.luminanceStrength;
        tmDenoise["chrominanceStrength"] = tm.denoisePreset.chrominanceStrength;
        tmDenoise["temporalStrength"] = tm.denoisePreset.temporalStrength;
        tmDenoise["sharpenAmount"] = tm.denoisePreset.sharpenAmount;
        tmDenoise["enableDenoise"] = tm.denoisePreset.enableDenoise;
        tmDenoise["enableSharpen"] = tm.denoisePreset.enableSharpen;
        tmMap["denoisePreset"] = tmDenoise;
        
        tapeModelsList.append(tmMap);
    }
    map["tapeModels"] = tapeModelsList;
    
    return map;
}

void TranscriptionConfig::fromVariantMap(const QVariantMap& map)
{
    if (map.contains("audio")) {
        QVariantMap audio = map["audio"].toMap();
        m_audioConfig.sampleRate = audio["sampleRate"].toInt();
        m_audioConfig.channelCount = audio["channelCount"].toInt();
        m_audioConfig.bitDepth = audio["bitDepth"].toInt();
        m_audioConfig.noiseThreshold = audio["noiseThreshold"].toFloat();
        m_audioConfig.enableNormalization = audio["enableNormalization"].toBool();
        m_audioConfig.targetLevel = audio["targetLevel"].toFloat();
    }
    
    if (map.contains("video")) {
        QVariantMap video = map["video"].toMap();
        m_videoConfig.width = video["width"].toInt();
        m_videoConfig.height = video["height"].toInt();
        m_videoConfig.frameRate = video["frameRate"].toFloat();
        m_videoConfig.bitrate = video["bitrate"].toInt();
        m_videoConfig.enableDenoise = video["enableDenoise"].toBool();
        m_videoConfig.enableColorCorrection = video["enableColorCorrection"].toBool();
        m_videoConfig.brightness = video["brightness"].toFloat();
        m_videoConfig.contrast = video["contrast"].toFloat();
        m_videoConfig.saturation = video["saturation"].toFloat();
        m_videoConfig.gamma = video["gamma"].toFloat();
    }
    
    if (map.contains("denoise")) {
        QVariantMap denoise = map["denoise"].toMap();
        if (denoise.contains("luminanceStrength")) {
            m_denoiseParams.luminanceStrength = denoise["luminanceStrength"].toFloat();
        }
        if (denoise.contains("chrominanceStrength")) {
            m_denoiseParams.chrominanceStrength = denoise["chrominanceStrength"].toFloat();
        }
        if (denoise.contains("temporalStrength")) {
            m_denoiseParams.temporalStrength = denoise["temporalStrength"].toFloat();
        }
        if (denoise.contains("sharpenAmount")) {
            m_denoiseParams.sharpenAmount = denoise["sharpenAmount"].toFloat();
        }
        if (denoise.contains("enableDenoise")) {
            m_denoiseParams.enableDenoise = denoise["enableDenoise"].toBool();
        }
        if (denoise.contains("enableSharpen")) {
            m_denoiseParams.enableSharpen = denoise["enableSharpen"].toBool();
        }
    }
    
    if (map.contains("tapeModels")) {
        QVariantList tapeModelsList = map["tapeModels"].toList();
        m_tapeModels.clear();
        for (const QVariant& item : tapeModelsList) {
            QVariantMap tmMap = item.toMap();
            TapeModel tm;
            tm.modelId = tmMap["modelId"].toString();
            tm.name = tmMap["name"].toString();
            tm.manufacturer = tmMap["manufacturer"].toString();
            tm.tapeType = tmMap["tapeType"].toString();
            tm.releaseYear = tmMap["releaseYear"].toInt();
            tm.notes = tmMap["notes"].toString();
            
            if (tmMap.contains("audioPreset")) {
                QVariantMap tmAudio = tmMap["audioPreset"].toMap();
                tm.audioPreset.sampleRate = tmAudio["sampleRate"].toInt();
                tm.audioPreset.channelCount = tmAudio["channelCount"].toInt();
                tm.audioPreset.bitDepth = tmAudio["bitDepth"].toInt();
                tm.audioPreset.noiseThreshold = tmAudio["noiseThreshold"].toFloat();
                tm.audioPreset.enableNormalization = tmAudio["enableNormalization"].toBool();
                tm.audioPreset.targetLevel = tmAudio["targetLevel"].toFloat();
            }
            
            if (tmMap.contains("videoPreset")) {
                QVariantMap tmVideo = tmMap["videoPreset"].toMap();
                tm.videoPreset.width = tmVideo["width"].toInt();
                tm.videoPreset.height = tmVideo["height"].toInt();
                tm.videoPreset.frameRate = tmVideo["frameRate"].toFloat();
                tm.videoPreset.bitrate = tmVideo["bitrate"].toInt();
                tm.videoPreset.enableDenoise = tmVideo["enableDenoise"].toBool();
                tm.videoPreset.enableColorCorrection = tmVideo["enableColorCorrection"].toBool();
                tm.videoPreset.brightness = tmVideo["brightness"].toFloat();
                tm.videoPreset.contrast = tmVideo["contrast"].toFloat();
                tm.videoPreset.saturation = tmVideo["saturation"].toFloat();
                tm.videoPreset.gamma = tmVideo["gamma"].toFloat();
            }
            
            if (tmMap.contains("denoisePreset")) {
                QVariantMap tmDenoise = tmMap["denoisePreset"].toMap();
                tm.denoisePreset.luminanceStrength = tmDenoise["luminanceStrength"].toFloat();
                tm.denoisePreset.chrominanceStrength = tmDenoise["chrominanceStrength"].toFloat();
                tm.denoisePreset.temporalStrength = tmDenoise["temporalStrength"].toFloat();
                tm.denoisePreset.sharpenAmount = tmDenoise["sharpenAmount"].toFloat();
                tm.denoisePreset.enableDenoise = tmDenoise["enableDenoise"].toBool();
                tm.denoisePreset.enableSharpen = tmDenoise["enableSharpen"].toBool();
            }
            
            if (!tm.modelId.isEmpty()) {
                m_tapeModels[tm.modelId] = tm;
            }
        }
    }
    
    emit configChanged();
}

bool TranscriptionConfig::exportToFile(const QString& filePath) const
{
    QFile file(filePath);
    if (!file.open(QIODevice::WriteOnly)) {
        return false;
    }
    
    QVariantMap map = toVariantMap();
    QJsonDocument doc = QJsonDocument::fromVariant(map);
    file.write(doc.toJson());
    file.close();
    return true;
}

bool TranscriptionConfig::importFromFile(const QString& filePath)
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
    
    fromVariantMap(doc.object().toVariantMap());
    file.close();
    return true;
}

void TranscriptionConfig::initDefaultTapeModels()
{
    TapeModel vhs;
    vhs.modelId = "vhs_standard";
    vhs.name = "VHS Standard";
    vhs.manufacturer = "Generic";
    vhs.tapeType = "VHS";
    vhs.releaseYear = 1976;
    vhs.audioPreset.sampleRate = 32000;
    vhs.videoPreset.width = 640;
    vhs.videoPreset.height = 480;
    vhs.denoisePreset.luminanceStrength = 0.6f;
    m_tapeModels[vhs.modelId] = vhs;
    
    TapeModel betamax;
    betamax.modelId = "betamax_standard";
    betamax.name = "Betamax Standard";
    betamax.manufacturer = "Sony";
    betamax.tapeType = "Betamax";
    betamax.releaseYear = 1975;
    betamax.audioPreset.sampleRate = 32000;
    betamax.videoPreset.width = 720;
    betamax.videoPreset.height = 480;
    betamax.denoisePreset.luminanceStrength = 0.5f;
    m_tapeModels[betamax.modelId] = betamax;
    
    TapeModel audioCassette;
    audioCassette.modelId = "audio_cassette";
    audioCassette.name = "Audio Cassette";
    audioCassette.manufacturer = "Generic";
    audioCassette.tapeType = "Cassette";
    audioCassette.releaseYear = 1962;
    audioCassette.audioPreset.sampleRate = 44100;
    audioCassette.denoisePreset.luminanceStrength = 0.3f;
    m_tapeModels[audioCassette.modelId] = audioCassette;
}
