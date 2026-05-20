#include "AudioWaveformWidget.h"
#include <QPaintEvent>
#include <QResizeEvent>

AudioWaveformWidget::AudioWaveformWidget(QWidget *parent)
    : QWidget(parent)
    , m_channelCount(2)
    , m_isStereo(true)
    , m_backgroundColor(30, 30, 35)
    , m_waveformColor(0, 200, 150)
    , m_gridColor(80, 80, 90)
    , m_levelLowColor(0, 200, 0)
    , m_levelMidColor(200, 200, 0)
    , m_levelHighColor(200, 0, 0)
    , m_leftLevel(0.0f)
    , m_rightLevel(0.0f)
{
    setMinimumHeight(150);
    setAutoFillBackground(true);
}

void AudioWaveformWidget::setWaveformData(const QVector<float>& leftChannel, const QVector<float>& rightChannel)
{
    m_leftChannel = leftChannel;
    m_rightChannel = rightChannel;
    update();
}

void AudioWaveformWidget::setChannelCount(int count)
{
    m_channelCount = count;
    m_isStereo = (count >= 2);
    update();
}

void AudioWaveformWidget::setStereo(bool stereo)
{
    m_isStereo = stereo;
    update();
}

void AudioWaveformWidget::setBackgroundColor(const QColor& color)
{
    m_backgroundColor = color;
    update();
}

void AudioWaveformWidget::setWaveformColor(const QColor& color)
{
    m_waveformColor = color;
    update();
}

void AudioWaveformWidget::setGridColor(const QColor& color)
{
    m_gridColor = color;
    update();
}

void AudioWaveformWidget::setLevelColors(const QColor& low, const QColor& mid, const QColor& high)
{
    m_levelLowColor = low;
    m_levelMidColor = mid;
    m_levelHighColor = high;
    update();
}

void AudioWaveformWidget::paintEvent(QPaintEvent* event)
{
    Q_UNUSED(event)
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    
    drawBackground(painter);
    drawGrid(painter);
    
    int channelHeight = height() / (m_isStereo ? 2 : 1);
    int meterWidth = 60;
    
    if (!m_leftChannel.isEmpty()) {
        QRect waveformRect(meterWidth, 0, width() - meterWidth, channelHeight - 1);
        painter.setClipRect(waveformRect);
        drawWaveform(painter, m_leftChannel, 0, channelHeight);
    }
    
    if (m_isStereo && !m_rightChannel.isEmpty()) {
        QRect waveformRect(meterWidth, channelHeight, width() - meterWidth, channelHeight - 1);
        painter.setClipRect(waveformRect);
        drawWaveform(painter, m_rightChannel, channelHeight, channelHeight);
    }
    
    painter.setClipping(false);
    drawLevelMeter(painter);
}

void AudioWaveformWidget::resizeEvent(QResizeEvent* event)
{
    Q_UNUSED(event)
    update();
}

void AudioWaveformWidget::drawBackground(QPainter& painter)
{
    painter.fillRect(rect(), m_backgroundColor);
}

void AudioWaveformWidget::drawGrid(QPainter& painter)
{
    painter.setPen(QPen(m_gridColor, 1, Qt::DotLine));
    
    int channelHeight = height() / (m_isStereo ? 2 : 1);
    
    for (int c = 0; c < (m_isStereo ? 2 : 1); c++) {
        int centerY = c * channelHeight + channelHeight / 2;
        painter.drawLine(60, centerY, width(), centerY);
        
        for (float f = 0.25f; f <= 0.75f; f += 0.25f) {
            int y = c * channelHeight + channelHeight * f;
            painter.drawLine(60, y, width(), y);
        }
    }
    
    for (int i = 1; i < 10; i++) {
        int x = 60 + (width() - 60) * i / 10;
        painter.drawLine(x, 0, x, height());
    }
}

void AudioWaveformWidget::drawWaveform(QPainter& painter, const QVector<float>& data, int yOffset, int height)
{
    if (data.isEmpty()) return;
    
    int waveformWidth = width() - 60;
    int centerY = yOffset + height / 2;
    
    painter.setPen(m_waveformColor);
    
    QVector<QPointF> points;
    points.reserve(waveformWidth * 2);
    
    int samplesPerPixel = qMax(1, data.size() / waveformWidth);
    
    for (int x = 0; x < waveformWidth; x++) {
        int sampleIdx = x * data.size() / waveformWidth;
        
        float minSample = 1.0f;
        float maxSample = -1.0f;
        
        for (int i = 0; i < samplesPerPixel && sampleIdx + i < data.size(); i++) {
            float sample = data[sampleIdx + i];
            minSample = qMin(minSample, sample);
            maxSample = qMax(maxSample, sample);
        }
        
        float yMin = centerY - minSample * (height / 2 - 10);
        float yMax = centerY - maxSample * (height / 2 - 10);
        
        points.append(QPointF(x + 60, yMin));
        points.append(QPointF(x + 60, yMax));
    }
    
    painter.drawLines(points);
}

void AudioWaveformWidget::drawLevelMeter(QPainter& painter)
{
    int channelHeight = height() / (m_isStereo ? 2 : 1);
    int meterWidth = 50;
    int barWidth = 40;
    
    for (int c = 0; c < (m_isStereo ? 2 : 1); c++) {
        float level = (c == 0) ? m_leftLevel : m_rightLevel;
        int barHeight = static_cast<int>(level * (channelHeight - 20));
        barHeight = qBound(0, barHeight, channelHeight - 20);
        
        int yStart = c * channelHeight + channelHeight - 10 - barHeight;
        int x = 5;
        
        for (int i = 0; i < barHeight; i++) {
            float pos = static_cast<float>(i) / (channelHeight - 20);
            QColor color;
            
            if (pos < 0.6f) {
                color = m_levelLowColor;
            } else if (pos < 0.85f) {
                color = m_levelMidColor;
            } else {
                color = m_levelHighColor;
            }
            
            painter.setPen(color);
            painter.drawRect(x, yStart + barHeight - i - 1, barWidth, 1);
        }
        
        painter.setPen(Qt::gray);
        painter.drawRect(x, c * channelHeight + 10, barWidth, channelHeight - 20);
    }
}

void AudioWaveformWidget::updateLevels(float leftRMS, float leftPeak, float rightRMS, float rightPeak)
{
    Q_UNUSED(leftPeak)
    Q_UNUSED(rightPeak)
    m_leftLevel = leftRMS;
    m_rightLevel = rightRMS;
    update();
}
