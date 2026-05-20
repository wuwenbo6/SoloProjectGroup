#ifndef COLORCORRECTOR_H
#define COLORCORRECTOR_H

#include <QObject>
#include <QImage>
#include <QVector>

struct ColorProfile {
    float redBias;
    float greenBias;
    float blueBias;
    float brightnessCorrection;
    float contrastCorrection;
    float saturationCorrection;
    float gammaCorrection;
    float tintCorrection;
    float whiteBalanceTemperature;
    float whiteBalanceTint;
    bool autoContrast;
    bool autoWhiteBalance;
    bool removeFlicker;
    
    ColorProfile()
        : redBias(1.0f)
        , greenBias(1.0f)
        , blueBias(1.0f)
        , brightnessCorrection(0.0f)
        , contrastCorrection(1.0f)
        , saturationCorrection(1.0f)
        , gammaCorrection(1.0f)
        , tintCorrection(0.0f)
        , whiteBalanceTemperature(6500.0f)
        , whiteBalanceTint(0.0f)
        , autoContrast(false)
        , autoWhiteBalance(false)
        , removeFlicker(false)
    {}
};

struct ColorHistogram {
    QVector<int> red;
    QVector<int> green;
    QVector<int> blue;
    QVector<int> luminance;
    float avgRed;
    float avgGreen;
    float avgBlue;
    float avgLuminance;
    int blackPoint;
    int whitePoint;
    int totalPixels;
    
    ColorHistogram() : avgRed(0), avgGreen(0), avgBlue(0), avgLuminance(0), blackPoint(0), whitePoint(255), totalPixels(0) {}
};

class ColorCorrector : public QObject
{
    Q_OBJECT
public:
    enum CorrectionQuality {
        FastQuality,
        NormalQuality,
        HighQuality
    };
    
    enum FilmType {
        UnknownFilm,
        KodakGold,
        FujiFilm,
        Agfa,
        OldVHS,
        BetaMax,
        Old8mm
    };
    
    explicit ColorCorrector(QObject *parent = nullptr);
    
    void setColorProfile(const ColorProfile& profile);
    ColorProfile getColorProfile() const;
    
    void setCorrectionQuality(CorrectionQuality quality);
    CorrectionQuality getCorrectionQuality() const;
    
    void setFilmType(FilmType type);
    FilmType getFilmType() const;
    
    ColorHistogram analyzeFrame(const QImage& frame);
    ColorHistogram analyzeFrames(const QList<QImage>& frames);
    
    ColorProfile autoCalibrate(const QList<QImage>& frames);
    ColorProfile autoCalibrateSingle(const QImage& referenceFrame);
    
    QImage correctImage(const QImage& input);
    QImage correctImageWithProfile(const QImage& input, const ColorProfile& profile);
    
    static QImage applyBrightnessContrast(const QImage& input, float brightness, float contrast);
    static QImage applyColorBalance(const QImage& input, float rBias, float gBias, float bBias);
    static QImage applyWhiteBalance(const QImage& input, float temperature, float tint);
    static QImage applyGammaCorrection(const QImage& input, float gamma);
    static QImage applySaturation(const QImage& input, float saturation);
    static QImage applyAutoContrast(const QImage& input, float clipPercent = 0.5f);
    
    QVector<ColorHistogram> getHistory() const;
    void clearHistory();
    
    void setFlickerDetectionWindow(int frames);
    int getFlickerDetectionWindow() const;
    
    float detectFlickerIntensity(const QList<QImage>& frames);

signals:
    void calibrationComplete(const ColorProfile& profile);
    void correctionProgress(int percent);
    void flickerDetected(float intensity);

private:
    void updateLUTs();
    quint8 applyColorCorrection(quint8 value, const QVector<quint8>& lut);
    
    void calculateAutoWhiteBalance(const ColorHistogram& histogram, float& temperature, float& tint);
    void calculateAutoContrast(const ColorHistogram& histogram, float& brightness, float& contrast);
    void calculateColorBias(const ColorHistogram& histogram, float& rBias, float& gBias, float& bBias);
    
    static float kelvinToRGBTemperature(float kelvin);
    static void temperatureToRGB(float temperature, float& r, float& g, float& b);
    
    ColorProfile m_currentProfile;
    CorrectionQuality m_quality;
    FilmType m_filmType;
    QVector<ColorHistogram> m_histories;
    int m_flickerWindow;
    
    QVector<quint8> m_redLUT;
    QVector<quint8> m_greenLUT;
    QVector<quint8> m_blueLUT;
    bool m_lutDirty;
};

#endif
