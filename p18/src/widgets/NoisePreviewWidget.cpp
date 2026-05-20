#include "NoisePreviewWidget.h"
#include <QMouseEvent>
#include <QPaintEvent>
#include <QLinearGradient>

NoisePreviewWidget::NoisePreviewWidget(QWidget *parent)
    : QWidget(parent)
    , m_viewMode(SideBySide)
    , m_splitPosition(0.5f)
    , m_noiseLow(0, 255, 0)
    , m_noiseMid(255, 255, 0)
    , m_noiseHigh(255, 0, 0)
    , m_isDraggingSplit(false)
{
    setMinimumSize(800, 400);
    setMouseTracking(true);
}

void NoisePreviewWidget::setPreviewData(const NoisePreviewData& data)
{
    m_data = data;
    update();
}

void NoisePreviewWidget::setViewMode(ViewMode mode)
{
    m_viewMode = mode;
    update();
}

void NoisePreviewWidget::setSplitPosition(float position)
{
    m_splitPosition = qBound(0.0f, position, 1.0f);
    update();
}

void NoisePreviewWidget::setNoiseColorScale(const QColor& low, const QColor& mid, const QColor& high)
{
    m_noiseLow = low;
    m_noiseMid = mid;
    m_noiseHigh = high;
    update();
}

void NoisePreviewWidget::paintEvent(QPaintEvent* event)
{
    Q_UNUSED(event)
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    
    painter.fillRect(rect(), QColor(20, 20, 25));
    
    switch (m_viewMode) {
        case SideBySide:
            drawSideBySide(painter);
            break;
        case SplitView:
            drawSplitView(painter);
            break;
        case OriginalOnly:
            drawSingleView(painter, m_data.originalFrame);
            break;
        case ProcessedOnly:
            drawSingleView(painter, m_data.processedFrame);
            break;
        case NoiseMapOnly:
            drawSingleView(painter, m_data.noiseMap);
            break;
    }
    
    int infoHeight = 80;
    drawHistogram(painter, QRect(10, height() - infoHeight, width() - 120, infoHeight - 10));
    drawNoiseIndicator(painter, QRect(width() - 100, height() - infoHeight, 90, infoHeight - 10));
}

void NoisePreviewWidget::mouseMoveEvent(QMouseEvent* event)
{
    if (m_isDraggingSplit && m_viewMode == SplitView) {
        m_splitPosition = static_cast<float>(event->x()) / width();
        m_splitPosition = qBound(0.0f, m_splitPosition, 1.0f);
        update();
    }
    
    if (event->x() > width() * 0.45f && event->x() < width() * 0.55f) {
        setCursor(Qt::SplitHCursor);
    } else {
        setCursor(Qt::ArrowCursor);
    }
}

void NoisePreviewWidget::mousePressEvent(QMouseEvent* event)
{
    if (m_viewMode == SplitView && 
        abs(event->x() - static_cast<int>(width() * m_splitPosition)) < 10) {
        m_isDraggingSplit = true;
    }
}

void NoisePreviewWidget::drawSideBySide(QPainter& painter)
{
    int previewHeight = height() - 100;
    int previewWidth = (width() - 30) / 2;
    
    QRect originalRect(10, 10, previewWidth, previewHeight);
    QRect processedRect(previewWidth + 20, 10, previewWidth, previewHeight);
    
    if (!m_data.originalFrame.isNull()) {
        QImage scaled = m_data.originalFrame.scaled(
            originalRect.size(), Qt::KeepAspectRatio, Qt::SmoothTransformation);
        int x = originalRect.center().x() - scaled.width() / 2;
        int y = originalRect.center().y() - scaled.height() / 2;
        painter.drawImage(x, y, scaled);
    }
    
    if (!m_data.processedFrame.isNull()) {
        QImage scaled = m_data.processedFrame.scaled(
            processedRect.size(), Qt::KeepAspectRatio, Qt::SmoothTransformation);
        int x = processedRect.center().x() - scaled.width() / 2;
        int y = processedRect.center().y() - scaled.height() / 2;
        painter.drawImage(x, y, scaled);
    }
    
    painter.setPen(Qt::white);
    painter.drawText(originalRect.adjusted(5, 5, -5, -5), Qt::AlignTop | Qt::AlignLeft, "Original");
    painter.drawText(processedRect.adjusted(5, 5, -5, -5), Qt::AlignTop | Qt::AlignLeft, "Denoised");
    
    painter.setPen(QPen(QColor(100, 100, 110), 1));
    painter.drawRect(originalRect);
    painter.drawRect(processedRect);
}

void NoisePreviewWidget::drawSplitView(QPainter& painter)
{
    int previewHeight = height() - 100;
    QRect previewRect(10, 10, width() - 20, previewHeight);
    
    int splitX = previewRect.x() + static_cast<int>(previewRect.width() * m_splitPosition);
    
    if (!m_data.originalFrame.isNull()) {
        QImage scaled = m_data.originalFrame.scaled(
            previewRect.size(), Qt::KeepAspectRatio, Qt::SmoothTransformation);
        int x = previewRect.center().x() - scaled.width() / 2;
        int y = previewRect.center().y() - scaled.height() / 2;
        
        QRect originalVisibleRect(x, y, splitX - x, scaled.height());
        painter.setClipRect(previewRect.adjusted(0, 0, -previewRect.width() * (1 - m_splitPosition), 0));
        painter.drawImage(x, y, scaled);
    }
    
    if (!m_data.processedFrame.isNull()) {
        QImage scaled = m_data.processedFrame.scaled(
            previewRect.size(), Qt::KeepAspectRatio, Qt::SmoothTransformation);
        int x = previewRect.center().x() - scaled.width() / 2;
        int y = previewRect.center().y() - scaled.height() / 2;
        
        painter.setClipping(false);
        painter.setClipRect(previewRect.adjusted(previewRect.width() * m_splitPosition, 0, 0, 0));
        painter.drawImage(x, y, scaled);
    }
    
    painter.setClipping(false);
    
    painter.setPen(QPen(Qt::white, 2));
    painter.drawLine(splitX, previewRect.top(), splitX, previewRect.bottom());
    
    painter.setBrush(QColor(255, 255, 255, 200));
    painter.setPen(Qt::NoPen);
    painter.drawEllipse(splitX - 10, previewRect.center().y() - 10, 20, 20);
    
    painter.setPen(QColor(50, 50, 50));
    painter.drawLine(splitX - 5, previewRect.center().y(), splitX + 5, previewRect.center().y());
}

void NoisePreviewWidget::drawSingleView(QPainter& painter, const QImage& image)
{
    if (image.isNull()) return;
    
    int previewHeight = height() - 100;
    QRect previewRect(10, 10, width() - 20, previewHeight);
    
    QImage scaled = image.scaled(
        previewRect.size(), Qt::KeepAspectRatio, Qt::SmoothTransformation);
    int x = previewRect.center().x() - scaled.width() / 2;
    int y = previewRect.center().y() - scaled.height() / 2;
    
    painter.drawImage(x, y, scaled);
    
    painter.setPen(QPen(QColor(100, 100, 110), 1));
    painter.drawRect(previewRect);
}

void NoisePreviewWidget::drawHistogram(QPainter& painter, const QRect& rect)
{
    if (m_data.noiseHistogram.isEmpty()) {
        painter.setPen(QColor(150, 150, 150));
        painter.drawText(rect, Qt::AlignCenter, "No histogram data");
        return;
    }
    
    painter.fillRect(rect, QColor(30, 30, 35));
    painter.setPen(QColor(80, 80, 90));
    painter.drawRect(rect);
    
    float maxValue = 0;
    for (float val : m_data.noiseHistogram) {
        maxValue = qMax(maxValue, val);
    }
    
    if (maxValue <= 0) maxValue = 1.0f;
    
    int barWidth = rect.width() / m_data.noiseHistogram.size();
    
    for (int i = 0; i < m_data.noiseHistogram.size(); i++) {
        float ratio = m_data.noiseHistogram[i] / maxValue;
        int barHeight = static_cast<int>(ratio * (rect.height() - 10));
        
        float pos = static_cast<float>(i) / m_data.noiseHistogram.size();
        QColor barColor;
        
        if (pos < 0.33f) {
            barColor = QColor::fromHsl(
                m_noiseLow.hue() + (m_noiseMid.hue() - m_noiseLow.hue()) * pos * 3,
                200, 100 + pos * 50);
        } else if (pos < 0.66f) {
            barColor = QColor::fromHsl(
                m_noiseMid.hue() + (m_noiseHigh.hue() - m_noiseMid.hue()) * (pos - 0.33f) * 3,
                200, 120);
        } else {
            barColor = m_noiseHigh;
        }
        
        painter.fillRect(
            rect.x() + i * barWidth,
            rect.y() + rect.height() - barHeight - 5,
            barWidth - 1,
            barHeight,
            barColor);
    }
    
    painter.setPen(QColor(200, 200, 200));
    painter.drawText(rect.adjusted(5, 2, -5, -2), Qt::AlignTop | Qt::AlignLeft, "Noise Distribution");
}

void NoisePreviewWidget::drawNoiseIndicator(QPainter& painter, const QRect& rect)
{
    painter.fillRect(rect, QColor(30, 30, 35));
    painter.setPen(QColor(80, 80, 90));
    painter.drawRect(rect);
    
    float noiseLevel = m_data.overallNoiseLevel;
    
    QRect barRect = rect.adjusted(10, 20, -10, -20);
    barRect.setHeight(20);
    
    QLinearGradient gradient(barRect.topLeft(), barRect.topRight());
    gradient.setColorAt(0.0, m_noiseLow);
    gradient.setColorAt(0.5, m_noiseMid);
    gradient.setColorAt(1.0, m_noiseHigh);
    
    painter.fillRect(barRect, gradient);
    
    int indicatorX = barRect.x() + static_cast<int>(noiseLevel * barRect.width());
    indicatorX = qBound(barRect.x(), indicatorX, barRect.right());
    
    painter.setPen(QPen(Qt::white, 2));
    painter.drawLine(indicatorX, barRect.top() - 3, indicatorX, barRect.bottom() + 3);
    
    painter.setPen(QColor(200, 200, 200));
    painter.drawText(rect.adjusted(5, 2, -5, -2), Qt::AlignTop | Qt::AlignHCenter, 
        QString("Noise: %1%").arg(static_cast<int>(noiseLevel * 100)));
}
