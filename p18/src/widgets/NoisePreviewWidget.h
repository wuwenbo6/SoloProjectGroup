#ifndef NOISEPREVIEWWIDGET_H
#define NOISEPREVIEWWIDGET_H

#include <QWidget>
#include <QImage>
#include <QVector>
#include <QPainter>

struct NoisePreviewData {
    QImage originalFrame;
    QImage processedFrame;
    QImage noiseMap;
    QVector<float> noiseHistogram;
    float overallNoiseLevel;
};

class NoisePreviewWidget : public QWidget
{
    Q_OBJECT
public:
    enum ViewMode {
        SideBySide,
        OriginalOnly,
        ProcessedOnly,
        NoiseMapOnly,
        SplitView
    };
    
    explicit NoisePreviewWidget(QWidget *parent = nullptr);
    
    void setPreviewData(const NoisePreviewData& data);
    void setViewMode(ViewMode mode);
    void setSplitPosition(float position);
    
    void setNoiseColorScale(const QColor& low, const QColor& mid, const QColor& high);

protected:
    void paintEvent(QPaintEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void mousePressEvent(QMouseEvent* event) override;

private:
    void drawSideBySide(QPainter& painter);
    void drawSplitView(QPainter& painter);
    void drawSingleView(QPainter& painter, const QImage& image);
    void drawHistogram(QPainter& painter, const QRect& rect);
    void drawNoiseIndicator(QPainter& painter, const QRect& rect);
    
    NoisePreviewData m_data;
    ViewMode m_viewMode;
    float m_splitPosition;
    
    QColor m_noiseLow;
    QColor m_noiseMid;
    QColor m_noiseHigh;
    
    bool m_isDraggingSplit;
};

#endif
