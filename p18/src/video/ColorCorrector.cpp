#include "ColorCorrector.h"
#include <QtMath>
#include <QPainter>
#include <QDebug>

ColorCorrector::ColorCorrector(QObject *parent)
    : QObject(parent)
    , m_quality(NormalQuality)
    , m_filmType(UnknownFilm)
    , m_flickerWindow(30)
    , m_lutDirty(true)
{
    m_redLUT.resize(256);
    m_greenLUT.resize(256);
    m_blueLUT.resize(256);
    
    for (int i = 0; i < 256; i++) {
        m_redLUT[i] = i;
        m_greenLUT[i] = i;
        m_blueLUT[i] = i;
    }
}

void ColorCorrector::setColorProfile(const ColorProfile& profile)
{
    m_currentProfile = profile;
    m_lutDirty = true;
}

ColorProfile ColorCorrector::getColorProfile() const
{
    return m_currentProfile;
}

void ColorCorrector::setCorrectionQuality(CorrectionQuality quality)
{
    m_quality = quality;
}

ColorCorrector::CorrectionQuality ColorCorrector::getCorrectionQuality() const
{
    return m_quality;
}

void ColorCorrector::setFilmType(FilmType type)
{
    m_filmType = type;
    
    switch (type) {
        case KodakGold:
            m_currentProfile.redBias = 1.05f;
            m_currentProfile.greenBias = 0.95f;
            m_currentProfile.blueBias = 0.9f;
            m_currentProfile.saturationCorrection = 1.1f;
            break;
        case FujiFilm:
            m_currentProfile.redBias = 0.95f;
            m_currentProfile.greenBias = 1.05f;
            m_currentProfile.blueBias = 1.1f;
            break;
        case OldVHS:
            m_currentProfile.redBias = 1.15f;
            m_currentProfile.greenBias = 1.0f;
            m_currentProfile.blueBias = 0.85f;
            m_currentProfile.contrastCorrection = 1.2f;
            m_currentProfile.saturationCorrection = 0.9f;
            break;
        case BetaMax:
            m_currentProfile.redBias = 1.1f;
            m_currentProfile.greenBias = 1.0f;
            m_currentProfile.blueBias = 0.9f;
            m_currentProfile.contrastCorrection = 1.15f;
            break;
        case Old8mm:
            m_currentProfile.redBias = 1.2f;
            m_currentProfile.greenBias = 1.05f;
            m_currentProfile.blueBias = 0.8f;
            m_currentProfile.gammaCorrection = 1.1f;
            break;
        default:
            break;
    }
    
    m_lutDirty = true;
}

ColorCorrector::FilmType ColorCorrector::getFilmType() const
{
    return m_filmType;
}

ColorHistogram ColorCorrector::analyzeFrame(const QImage& frame)
{
    ColorHistogram histogram;
    histogram.red.resize(256, 0);
    histogram.green.resize(256, 0);
    histogram.blue.resize(256, 0);
    histogram.luminance.resize(256, 0);
    
    QImage analysisFrame = frame.convertToFormat(QImage::Format_RGB32);
    int step = (m_quality == FastQuality) ? 4 : (m_quality == NormalQuality) ? 2 : 1;
    
    qint64 sumRed = 0, sumGreen = 0, sumBlue = 0, sumLum = 0;
    int count = 0;
    
    for (int y = 0; y < analysisFrame.height(); y += step) {
        const QRgb* line = reinterpret_cast<const QRgb*>(analysisFrame.scanLine(y));
        for (int x = 0; x < analysisFrame.width(); x += step) {
            QRgb pixel = line[x];
            int r = qRed(pixel);
            int g = qGreen(pixel);
            int b = qBlue(pixel);
            
            histogram.red[r]++;
            histogram.green[g]++;
            histogram.blue[b]++;
            
            int lum = qRound(0.299f * r + 0.587f * g + 0.114f * b);
            histogram.luminance[lum]++;
            
            sumRed += r;
            sumGreen += g;
            sumBlue += b;
            sumLum += lum;
            count++;
        }
    }
    
    histogram.totalPixels = count;
    if (count > 0) {
        histogram.avgRed = static_cast<float>(sumRed) / count;
        histogram.avgGreen = static_cast<float>(sumGreen) / count;
        histogram.avgBlue = static_cast<float>(sumBlue) / count;
        histogram.avgLuminance = static_cast<float>(sumLum) / count;
    }
    
    float clipThreshold = 0.005f;
    qint64 threshold = static_cast<qint64>(count * clipThreshold);
    
    qint64 accum = 0;
    for (int i = 0; i < 256; i++) {
        accum += histogram.luminance[i];
        if (accum >= threshold) {
            histogram.blackPoint = i;
            break;
        }
    }
    
    accum = 0;
    for (int i = 255; i >= 0; i--) {
        accum += histogram.luminance[i];
        if (accum >= threshold) {
            histogram.whitePoint = i;
            break;
        }
    }
    
    m_histories.append(histogram);
    if (m_histories.size() > 100) {
        m_histories.removeFirst();
    }
    
    return histogram;
}

ColorHistogram ColorCorrector::analyzeFrames(const QList<QImage>& frames)
{
    if (frames.isEmpty()) {
        return ColorHistogram();
    }
    
    QVector<ColorHistogram> frameHistograms;
    for (const QImage& frame : frames) {
        frameHistograms.append(analyzeFrame(frame));
    }
    
    ColorHistogram combined;
    combined.red.resize(256, 0);
    combined.green.resize(256, 0);
    combined.blue.resize(256, 0);
    combined.luminance.resize(256, 0);
    
    float sumAvgRed = 0, sumAvgGreen = 0, sumAvgBlue = 0, sumAvgLum = 0;
    qint64 totalPixels = 0;
    
    for (const ColorHistogram& h : frameHistograms) {
        for (int i = 0; i < 256; i++) {
            combined.red[i] += h.red[i];
            combined.green[i] += h.green[i];
            combined.blue[i] += h.blue[i];
            combined.luminance[i] += h.luminance[i];
        }
        sumAvgRed += h.avgRed;
        sumAvgGreen += h.avgGreen;
        sumAvgBlue += h.avgBlue;
        sumAvgLum += h.avgLuminance;
        totalPixels += h.totalPixels;
    }
    
    combined.avgRed = sumAvgRed / frameHistograms.size();
    combined.avgGreen = sumAvgGreen / frameHistograms.size();
    combined.avgBlue = sumAvgBlue / frameHistograms.size();
    combined.avgLuminance = sumAvgLum / frameHistograms.size();
    combined.totalPixels = totalPixels;
    
    return combined;
}

ColorProfile ColorCorrector::autoCalibrate(const QList<QImage>& frames)
{
    if (frames.isEmpty()) {
        return m_currentProfile;
    }
    
    ColorHistogram combined = analyzeFrames(frames);
    
    ColorProfile profile;
    
    if (m_filmType == OldVHS || m_filmType == Old8mm || m_filmType == BetaMax) {
        profile.redBias = 1.0f + (128.0f - combined.avgRed) / 255.0f * 0.3f;
        profile.greenBias = 1.0f + (128.0f - combined.avgGreen) / 255.0f * 0.2f;
        profile.blueBias = 1.0f + (128.0f - combined.avgBlue) / 255.0f * 0.4f;
    } else {
        calculateColorBias(combined, profile.redBias, profile.greenBias, profile.blueBias);
    }
    
    calculateAutoWhiteBalance(combined, profile.whiteBalanceTemperature, profile.whiteBalanceTint);
    calculateAutoContrast(combined, profile.brightnessCorrection, profile.contrastCorrection);
    
    float avgColor = (combined.avgRed + combined.avgGreen + combined.avgBlue) / 3.0f;
    float colorSpread = qAbs(combined.avgRed - avgColor) + qAbs(combined.avgGreen - avgColor) + qAbs(combined.avgBlue - avgColor);
    if (colorSpread > 20.0f) {
        profile.saturationCorrection = 1.1f;
    } else {
        profile.saturationCorrection = 1.0f;
    }
    
    profile.gammaCorrection = 1.05f;
    profile.autoWhiteBalance = true;
    profile.autoContrast = true;
    
    m_currentProfile = profile;
    m_lutDirty = true;
    
    emit calibrationComplete(profile);
    return profile;
}

ColorProfile ColorCorrector::autoCalibrateSingle(const QImage& referenceFrame)
{
    QList<QImage> frames;
    frames.append(referenceFrame);
    return autoCalibrate(frames);
}

void ColorCorrector::calculateAutoWhiteBalance(const ColorHistogram& histogram, float& temperature, float& tint)
{
    float maxColor = qMax(histogram.avgRed, qMax(histogram.avgGreen, histogram.avgBlue));
    float minColor = qMin(histogram.avgRed, qMin(histogram.avgGreen, histogram.avgBlue));
    
    float rgRatio = histogram.avgRed / histogram.avgGreen;
    float bgRatio = histogram.avgBlue / histogram.avgGreen;
    
    if (rgRatio > 1.1f) {
        temperature = 5500.0f + (rgRatio - 1.0f) * 3000.0f;
    } else if (rgRatio < 0.9f) {
        temperature = 6500.0f + (rgRatio - 1.0f) * -3000.0f;
    } else {
        temperature = 6500.0f;
    }
    
    tint = (bgRatio - 1.0f) * 50.0f;
}

void ColorCorrector::calculateAutoContrast(const ColorHistogram& histogram, float& brightness, float& contrast)
{
    float luminanceRange = histogram.whitePoint - histogram.blackPoint;
    float idealRange = 220.0f;
    
    contrast = idealRange / luminanceRange;
    contrast = qBound(0.8f, contrast, 1.5f);
    
    float midPoint = (histogram.blackPoint + histogram.whitePoint) / 2.0f;
    brightness = (128.0f - midPoint) / 128.0f * 0.5f;
}

void ColorCorrector::calculateColorBias(const ColorHistogram& histogram, float& rBias, float& gBias, float& bBias)
{
    float avgGray = (histogram.avgRed + histogram.avgGreen + histogram.avgBlue) / 3.0f;
    
    rBias = avgGray / qMax(1.0f, histogram.avgRed);
    gBias = avgGray / qMax(1.0f, histogram.avgGreen);
    bBias = avgGray / qMax(1.0f, histogram.avgBlue);
    
    rBias = qBound(0.8f, rBias, 1.2f);
    gBias = qBound(0.8f, gBias, 1.2f);
    bBias = qBound(0.8f, bBias, 1.2f);
}

QImage ColorCorrector::correctImage(const QImage& input)
{
    return correctImageWithProfile(input, m_currentProfile);
}

QImage ColorCorrector::correctImageWithProfile(const QImage& input, const ColorProfile& profile)
{
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    
    float wbR, wbG, wbB;
    temperatureToRGB(profile.whiteBalanceTemperature, wbR, wbG, wbB);
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float r = qRed(pixel) / 255.0f;
            float g = qGreen(pixel) / 255.0f;
            float b = qBlue(pixel) / 255.0f;
            
            r *= profile.redBias * wbR;
            g *= profile.greenBias * wbG;
            b *= profile.blueBias * wbB;
            
            float gray = 0.299f * r + 0.587f * g + 0.114f * b;
            r = gray + (r - gray) * profile.saturationCorrection;
            g = gray + (g - gray) * profile.saturationCorrection;
            b = gray + (b - gray) * profile.saturationCorrection;
            
            r += profile.brightnessCorrection;
            g += profile.brightnessCorrection;
            b += profile.brightnessCorrection;
            
            r = ((r - 0.5f) * profile.contrastCorrection) + 0.5f;
            g = ((g - 0.5f) * profile.contrastCorrection) + 0.5f;
            b = ((b - 0.5f) * profile.contrastCorrection) + 0.5f;
            
            if (profile.gammaCorrection != 1.0f && profile.gammaCorrection > 0.1f) {
                r = qPow(qMax(0.0f, r), 1.0f / profile.gammaCorrection);
                g = qPow(qMax(0.0f, g), 1.0f / profile.gammaCorrection);
                b = qPow(qMax(0.0f, b), 1.0f / profile.gammaCorrection);
            }
            
            line[x] = qRgb(
                qBound(0, qRound(r * 255.0f), 255),
                qBound(0, qRound(g * 255.0f), 255),
                qBound(0, qRound(b * 255.0f), 255)
            );
        }
    }
    
    return result;
}

QImage ColorCorrector::applyBrightnessContrast(const QImage& input, float brightness, float contrast)
{
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float r = qRed(pixel) / 255.0f;
            float g = qGreen(pixel) / 255.0f;
            float b = qBlue(pixel) / 255.0f;
            
            r += brightness;
            g += brightness;
            b += brightness;
            
            r = ((r - 0.5f) * contrast) + 0.5f;
            g = ((g - 0.5f) * contrast) + 0.5f;
            b = ((b - 0.5f) * contrast) + 0.5f;
            
            line[x] = qRgb(
                qBound(0, qRound(r * 255.0f), 255),
                qBound(0, qRound(g * 255.0f), 255),
                qBound(0, qRound(b * 255.0f), 255)
            );
        }
    }
    
    return result;
}

QImage ColorCorrector::applyColorBalance(const QImage& input, float rBias, float gBias, float bBias)
{
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float r = qRed(pixel) * rBias;
            float g = qGreen(pixel) * gBias;
            float b = qBlue(pixel) * bBias;
            
            line[x] = qRgb(
                qBound(0, qRound(r), 255),
                qBound(0, qRound(g), 255),
                qBound(0, qRound(b), 255)
            );
        }
    }
    
    return result;
}

QImage ColorCorrector::applyWhiteBalance(const QImage& input, float temperature, float tint)
{
    float r, g, b;
    temperatureToRGB(temperature, r, g, b);
    
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float rf = qRed(pixel) * r;
            float gf = qGreen(pixel) * g;
            float bf = qBlue(pixel) * b;
            
            float tintAmount = tint / 100.0f;
            float gr = gf + (rf - gf) * tintAmount * 0.5f;
            float br = bf + (rf - bf) * tintAmount * 0.3f;
            
            line[x] = qRgb(
                qBound(0, qRound(rf), 255),
                qBound(0, qRound(gr), 255),
                qBound(0, qRound(br), 255)
            );
        }
    }
    
    return result;
}

QImage ColorCorrector::applyGammaCorrection(const QImage& input, float gamma)
{
    if (qAbs(gamma - 1.0f) < 0.01f) {
        return input;
    }
    
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    float invGamma = 1.0f / gamma;
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float r = qRed(pixel) / 255.0f;
            float g = qGreen(pixel) / 255.0f;
            float b = qBlue(pixel) / 255.0f;
            
            r = qPow(r, invGamma);
            g = qPow(g, invGamma);
            b = qPow(b, invGamma);
            
            line[x] = qRgb(
                qBound(0, qRound(r * 255.0f), 255),
                qBound(0, qRound(g * 255.0f), 255),
                qBound(0, qRound(b * 255.0f), 255)
            );
        }
    }
    
    return result;
}

QImage ColorCorrector::applySaturation(const QImage& input, float saturation)
{
    if (qAbs(saturation - 1.0f) < 0.01f) {
        return input;
    }
    
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float r = qRed(pixel) / 255.0f;
            float g = qGreen(pixel) / 255.0f;
            float b = qBlue(pixel) / 255.0f;
            
            float gray = 0.299f * r + 0.587f * g + 0.114f * b;
            
            r = gray + (r - gray) * saturation;
            g = gray + (g - gray) * saturation;
            b = gray + (b - gray) * saturation;
            
            line[x] = qRgb(
                qBound(0, qRound(r * 255.0f), 255),
                qBound(0, qRound(g * 255.0f), 255),
                qBound(0, qRound(b * 255.0f), 255)
            );
        }
    }
    
    return result;
}

QImage ColorCorrector::applyAutoContrast(const QImage& input, float clipPercent)
{
    QImage result = input.convertToFormat(QImage::Format_RGB32);
    
    QVector<int> histogram(256, 0);
    for (int y = 0; y < result.height(); y++) {
        const QRgb* line = reinterpret_cast<const QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            int lum = qGray(line[x]);
            histogram[lum]++;
        }
    }
    
    qint64 totalPixels = result.width() * result.height();
    qint64 clipAmount = static_cast<qint64>(totalPixels * clipPercent / 100.0f);
    
    int blackPoint = 0;
    qint64 accum = 0;
    for (int i = 0; i < 256; i++) {
        accum += histogram[i];
        if (accum >= clipAmount) {
            blackPoint = i;
            break;
        }
    }
    
    int whitePoint = 255;
    accum = 0;
    for (int i = 255; i >= 0; i--) {
        accum += histogram[i];
        if (accum >= clipAmount) {
            whitePoint = i;
            break;
        }
    }
    
    float scale = 255.0f / qMax(1, whitePoint - blackPoint);
    
    for (int y = 0; y < result.height(); y++) {
        QRgb* line = reinterpret_cast<QRgb*>(result.scanLine(y));
        for (int x = 0; x < result.width(); x++) {
            QRgb pixel = line[x];
            float r = (qRed(pixel) - blackPoint) * scale;
            float g = (qGreen(pixel) - blackPoint) * scale;
            float b = (qBlue(pixel) - blackPoint) * scale;
            
            line[x] = qRgb(
                qBound(0, qRound(r), 255),
                qBound(0, qRound(g), 255),
                qBound(0, qRound(b), 255)
            );
        }
    }
    
    return result;
}

void ColorCorrector::temperatureToRGB(float temperature, float& r, float& g, float& b)
{
    float temp = temperature / 100.0f;
    
    if (temp <= 66.0f) {
        r = 1.0f;
        g = 0.39008157876901960784f * qLn(temp) - 0.63184144378862745098f;
    } else {
        r = 1.29293618606274509804f * qPow(temp - 60.0f, -0.1332047592f);
        g = 1.12989086089529411765f * qPow(temp - 60.0f, -0.0755148492f);
    }
    
    if (temp >= 66.0f) {
        b = 1.0f;
    } else if (temp <= 19.0f) {
        b = 0.0f;
    } else {
        b = 0.54320678911019607843f * qLn(temp - 10.0f) - 1.19625408916784313725f;
    }
    
    r = qBound(0.0f, r, 1.0f);
    g = qBound(0.0f, g, 1.0f);
    b = qBound(0.0f, b, 1.0f);
}

float ColorCorrector::kelvinToRGBTemperature(float kelvin)
{
    return kelvin;
}

void ColorCorrector::updateLUTs()
{
    for (int i = 0; i < 256; i++) {
        float value = i / 255.0f;
        
        float r = value * m_currentProfile.redBias;
        float g = value * m_currentProfile.greenBias;
        float b = value * m_currentProfile.blueBias;
        
        r = qBound(0.0f, r, 1.0f);
        g = qBound(0.0f, g, 1.0f);
        b = qBound(0.0f, b, 1.0f);
        
        m_redLUT[i] = qRound(r * 255.0f);
        m_greenLUT[i] = qRound(g * 255.0f);
        m_blueLUT[i] = qRound(b * 255.0f);
    }
    
    m_lutDirty = false;
}

quint8 ColorCorrector::applyColorCorrection(quint8 value, const QVector<quint8>& lut)
{
    return lut.value(value, value);
}

QVector<ColorHistogram> ColorCorrector::getHistory() const
{
    return m_histories;
}

void ColorCorrector::clearHistory()
{
    m_histories.clear();
}

void ColorCorrector::setFlickerDetectionWindow(int frames)
{
    m_flickerWindow = frames;
}

int ColorCorrector::getFlickerDetectionWindow() const
{
    return m_flickerWindow;
}

float ColorCorrector::detectFlickerIntensity(const QList<QImage>& frames)
{
    if (frames.size() < 2) {
        return 0.0f;
    }
    
    QVector<float> brightnessValues;
    
    for (const QImage& frame : frames) {
        ColorHistogram h = analyzeFrame(frame);
        brightnessValues.append(h.avgLuminance);
    }
    
    float sum = 0.0f;
    for (float b : brightnessValues) {
        sum += b;
    }
    float mean = sum / brightnessValues.size();
    
    float variance = 0.0f;
    for (float b : brightnessValues) {
        variance += (b - mean) * (b - mean);
    }
    variance /= brightnessValues.size();
    
    float stdDev = qSqrt(variance);
    
    float flickerIntensity = stdDev / qMax(1.0f, mean);
    
    if (flickerIntensity > 0.05f) {
        emit flickerDetected(flickerIntensity);
    }
    
    return flickerIntensity;
}
