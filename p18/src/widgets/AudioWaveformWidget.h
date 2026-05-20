#ifndef AUDIOWAVEFORMWIDGET_H
#define AUDIOWAVEFORMWIDGET_H

#include <QWidget>
#include <QVector>
#include <QPainter>
#include <QTimer>

class AudioWaveformWidget : public QWidget
{
    Q_OBJECT
public:
    explicit AudioWaveformWidget(QWidget *parent = nullptr);
    
    void setWaveformData(const QVector<float>& leftChannel, const QVector<float>& rightChannel = QVector<float>());
    void setChannelCount(int count);
    void setStereo(bool stereo);
    
    void setBackgroundColor(const QColor& color);
    void setWaveformColor(const QColor& color);
    void setGridColor(const QColor& color);
    void setLevelColors(const QColor& low, const QColor& mid, const QColor& high);

protected:
    void paintEvent(QPaintEvent* event) override;
    void resizeEvent(QResizeEvent* event) override;

private:
    void drawBackground(QPainter& painter);
    void drawGrid(QPainter& painter);
    void drawWaveform(QPainter& painter, const QVector<float>& data, int yOffset, int height);
    void drawLevelMeter(QPainter& painter);

    QVector<float> m_leftChannel;
    QVector<float> m_rightChannel;
    int m_channelCount;
    bool m_isStereo;
    
    QColor m_backgroundColor;
    QColor m_waveformColor;
    QColor m_gridColor;
    QColor m_levelLowColor;
    QColor m_levelMidColor;
    QColor m_levelHighColor;
    
    float m_leftLevel;
    float m_rightLevel;

public slots:
    void updateLevels(float leftRMS, float leftPeak, float rightRMS = 0, float rightPeak = 0);
};

#endif
