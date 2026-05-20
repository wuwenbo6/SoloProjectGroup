#ifndef HARDWAREDRIVER_H
#define HARDWAREDRIVER_H

#include <QObject>
#include <QSerialPort>
#include <QSerialPortInfo>
#include <QTimer>
#include <QByteArray>

struct DeviceInfo {
    QString deviceId;
    QString deviceName;
    QString firmwareVersion;
    QString portName;
    qint32 baudRate;
    bool isConnected;
};

struct TapeStatus {
    bool isPlaying;
    bool isRecording;
    int currentPosition;
    int totalLength;
    float tapeSpeed;
    int signalLevel;
};

class HardwareDriver : public QObject
{
    Q_OBJECT
public:
    explicit HardwareDriver(QObject *parent = nullptr);
    ~HardwareDriver();

    QList<QSerialPortInfo> getAvailablePorts();
    bool connectToDevice(const QString& portName, qint32 baudRate = 115200);
    void disconnectDevice();
    bool isConnected() const;
    DeviceInfo getDeviceInfo() const;
    TapeStatus getTapeStatus() const;

    void sendPlayCommand();
    void sendStopCommand();
    void sendRewindCommand();
    void sendFastForwardCommand();
    void sendPauseCommand();
    void sendCaptureFrame();
    void sendStartTranscription();
    void sendStopTranscription();

    void setAudioSampleRate(int sampleRate);
    void setVideoResolution(int width, int height);

signals:
    void deviceConnected();
    void deviceDisconnected();
    void deviceError(const QString& error);
    void tapeStatusUpdated(const TapeStatus& status);
    void audioDataReceived(const QByteArray& data);
    void videoFrameReceived(const QByteArray& frameData);
    void rawDataReceived(const QByteArray& data);

private slots:
    void onSerialDataReceived();
    void onSerialError(QSerialPort::SerialPortError error);
    void pollDeviceStatus();
    void sendHeartbeat();
    void onWatchdogTimeout();

private:
    bool tryConnectAtBaud(const QString& portName, qint32 baudRate);
    bool performHandshake();
    void parseResponse(const QByteArray& response);
    void sendCommand(const QByteArray& cmd);
    QByteArray buildCommand(quint8 cmdId, const QByteArray& payload = QByteArray());
    void handleTranscriptionError(const QString& error);

    QSerialPort* m_serialPort;
    DeviceInfo m_deviceInfo;
    TapeStatus m_tapeStatus;
    QTimer* m_statusPollTimer;
    QTimer* m_heartbeatTimer;
    QTimer* m_watchdogTimer;
    QByteArray m_receiveBuffer;
    bool m_pendingResponse;
    int m_consecutiveErrors;
    qint64 m_bytesReceived;
    bool m_isTranscribing;
};

#endif
