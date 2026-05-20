#include "HardwareDriver.h"
#include <QDebug>
#include <QEventLoop>
#include <QTimer>

enum CommandId {
    CMD_PING = 0x00,
    CMD_GET_DEVICE_INFO = 0x01,
    CMD_PLAY = 0x02,
    CMD_STOP = 0x03,
    CMD_REWIND = 0x04,
    CMD_FAST_FORWARD = 0x05,
    CMD_PAUSE = 0x06,
    CMD_GET_STATUS = 0x07,
    CMD_CAPTURE_FRAME = 0x08,
    CMD_START_TRANSCRIPTION = 0x09,
    CMD_STOP_TRANSCRIPTION = 0x0A,
    CMD_SET_SAMPLE_RATE = 0x0B,
    CMD_SET_VIDEO_RES = 0x0C,
    CMD_ACK = 0x7F,
    CMD_AUDIO_DATA = 0x80,
    CMD_VIDEO_FRAME = 0x81,
    CMD_STATUS_UPDATE = 0x82
};

const QList<qint32> STANDARD_BAUDRATES = {9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600};
const int HANDSHAKE_TIMEOUT_MS = 500;
const int MAX_RETRY_COUNT = 3;

HardwareDriver::HardwareDriver(QObject *parent)
    : QObject(parent)
    , m_serialPort(new QSerialPort(this))
    , m_statusPollTimer(new QTimer(this))
    , m_heartbeatTimer(new QTimer(this))
    , m_watchdogTimer(new QTimer(this))
    , m_pendingResponse(false)
    , m_consecutiveErrors(0)
    , m_bytesReceived(0)
{
    connect(m_serialPort, &QSerialPort::readyRead, this, &HardwareDriver::onSerialDataReceived);
    connect(m_serialPort, &QSerialPort::errorOccurred, this, &HardwareDriver::onSerialError);
    connect(m_statusPollTimer, &QTimer::timeout, this, &HardwareDriver::pollDeviceStatus);
    connect(m_heartbeatTimer, &QTimer::timeout, this, &HardwareDriver::sendHeartbeat);
    connect(m_watchdogTimer, &QTimer::timeout, this, &HardwareDriver::onWatchdogTimeout);
    
    m_statusPollTimer->setInterval(100);
    m_heartbeatTimer->setInterval(2000);
    m_watchdogTimer->setInterval(5000);

    m_deviceInfo.isConnected = false;
    m_tapeStatus = {false, false, 0, 0, 0.0f, 0};
    m_isTranscribing = false;
}

HardwareDriver::~HardwareDriver()
{
    disconnectDevice();
}

QList<QSerialPortInfo> HardwareDriver::getAvailablePorts()
{
    return QSerialPortInfo::availablePorts();
}

bool HardwareDriver::connectToDevice(const QString& portName, qint32 baudRate)
{
    if (m_serialPort->isOpen()) {
        disconnectDevice();
    }

    QList<qint32> baudRatesToTry;
    if (baudRate > 0) {
        baudRatesToTry.append(baudRate);
    }
    baudRatesToTry.append(STANDARD_BAUDRATES);

    for (qint32 testBaud : baudRatesToTry) {
        if (tryConnectAtBaud(portName, testBaud)) {
            m_deviceInfo.portName = portName;
            m_deviceInfo.isConnected = true;
            m_consecutiveErrors = 0;
            m_bytesReceived = 0;
            m_statusPollTimer->start();
            m_heartbeatTimer->start();
            m_watchdogTimer->start();
            emit deviceConnected();
            return true;
        }
    }

    emit deviceError("All baud rates failed - device not responding");
    return false;
}

bool HardwareDriver::tryConnectAtBaud(const QString& portName, qint32 baudRate)
{
    m_serialPort->setPortName(portName);
    m_serialPort->setBaudRate(baudRate);
    m_serialPort->setDataBits(QSerialPort::Data8);
    m_serialPort->setParity(QSerialPort::NoParity);
    m_serialPort->setStopBits(QSerialPort::OneStop);
    m_serialPort->setFlowControl(QSerialPort::NoFlowControl);

    if (!m_serialPort->open(QIODevice::ReadWrite)) {
        return false;
    }

    m_serialPort->clear();
    m_receiveBuffer.clear();

    for (int retry = 0; retry < MAX_RETRY_COUNT; retry++) {
        if (performHandshake()) {
            m_deviceInfo.baudRate = baudRate;
            return true;
        }
        QThread::msleep(50);
        m_serialPort->clear();
        m_receiveBuffer.clear();
    }

    m_serialPort->close();
    return false;
}

bool HardwareDriver::performHandshake()
{
    QByteArray pingCmd = buildCommand(CMD_PING);
    
    for (int i = 0; i < 3; i++) {
        sendCommand(pingCmd);
        
        QEventLoop loop;
        QTimer::singleShot(HANDSHAKE_TIMEOUT_MS, &loop, &QEventLoop::quit);
        
        bool receivedAck = false;
        QMetaObject::Connection conn = connect(this, &HardwareDriver::rawDataReceived, [&](const QByteArray& data) {
            if (data.size() >= 1 && (quint8)data[0] == CMD_ACK) {
                receivedAck = true;
                loop.quit();
            }
        });
        
        loop.exec();
        disconnect(conn);
        
        if (receivedAck) {
            QThread::msleep(10);
            sendCommand(buildCommand(CMD_GET_DEVICE_INFO));
            return true;
        }
    }
    
    return false;
}

void HardwareDriver::disconnectDevice()
{
    m_statusPollTimer->stop();
    m_heartbeatTimer->stop();
    m_watchdogTimer->stop();
    
    if (m_isTranscribing) {
        sendStopTranscription();
    }
    
    if (m_serialPort->isOpen()) {
        m_serialPort->close();
    }
    
    m_deviceInfo.isConnected = false;
    m_consecutiveErrors = 0;
    m_isTranscribing = false;
    emit deviceDisconnected();
}

bool HardwareDriver::isConnected() const
{
    return m_deviceInfo.isConnected;
}

DeviceInfo HardwareDriver::getDeviceInfo() const
{
    return m_deviceInfo;
}

TapeStatus HardwareDriver::getTapeStatus() const
{
    return m_tapeStatus;
}

void HardwareDriver::sendPlayCommand()
{
    sendCommand(buildCommand(CMD_PLAY));
}

void HardwareDriver::sendStopCommand()
{
    sendCommand(buildCommand(CMD_STOP));
}

void HardwareDriver::sendRewindCommand()
{
    sendCommand(buildCommand(CMD_REWIND));
}

void HardwareDriver::sendFastForwardCommand()
{
    sendCommand(buildCommand(CMD_FAST_FORWARD));
}

void HardwareDriver::sendPauseCommand()
{
    sendCommand(buildCommand(CMD_PAUSE));
}

void HardwareDriver::sendCaptureFrame()
{
    sendCommand(buildCommand(CMD_CAPTURE_FRAME));
}

void HardwareDriver::sendStartTranscription()
{
    m_isTranscribing = true;
    m_bytesReceived = 0;
    m_consecutiveErrors = 0;
    sendCommand(buildCommand(CMD_START_TRANSCRIPTION));
}

void HardwareDriver::sendStopTranscription()
{
    m_isTranscribing = false;
    sendCommand(buildCommand(CMD_STOP_TRANSCRIPTION));
}

void HardwareDriver::setAudioSampleRate(int sampleRate)
{
    QByteArray payload;
    payload.append((sampleRate >> 24) & 0xFF);
    payload.append((sampleRate >> 16) & 0xFF);
    payload.append((sampleRate >> 8) & 0xFF);
    payload.append(sampleRate & 0xFF);
    sendCommand(buildCommand(CMD_SET_SAMPLE_RATE, payload));
}

void HardwareDriver::setVideoResolution(int width, int height)
{
    QByteArray payload;
    payload.append((width >> 8) & 0xFF);
    payload.append(width & 0xFF);
    payload.append((height >> 8) & 0xFF);
    payload.append(height & 0xFF);
    sendCommand(buildCommand(CMD_SET_VIDEO_RES, payload));
}

void HardwareDriver::onSerialDataReceived()
{
    QByteArray newData = m_serialPort->readAll();
    m_receiveBuffer.append(newData);
    m_bytesReceived += newData.size();
    
    if (m_watchdogTimer->isActive()) {
        m_watchdogTimer->start();
    }
    
    if (m_receiveBuffer.size() > 1024 * 1024) {
        m_receiveBuffer = m_receiveBuffer.right(512 * 1024);
    }
    
    while (m_receiveBuffer.size() >= 4) {
        if ((quint8)m_receiveBuffer[0] == 0xAA && (quint8)m_receiveBuffer[1] == 0x55) {
            int payloadLen = (quint8)m_receiveBuffer[2];
            
            if (payloadLen < 1 || payloadLen > 255) {
                m_receiveBuffer.remove(0, 2);
                m_consecutiveErrors++;
                continue;
            }
            
            int totalLen = 4 + payloadLen;
            
            if (m_receiveBuffer.size() >= totalLen) {
                quint8 receivedChecksum = m_receiveBuffer[totalLen - 1];
                quint8 calculatedChecksum = 0;
                for (int i = 2; i < totalLen - 1; i++) {
                    calculatedChecksum += (quint8)m_receiveBuffer[i];
                }
                
                if (receivedChecksum == calculatedChecksum) {
                    QByteArray response = m_receiveBuffer.mid(3, payloadLen);
                    parseResponse(response);
                    m_consecutiveErrors = 0;
                } else {
                    m_consecutiveErrors++;
                    qDebug() << "Checksum mismatch! Consecutive errors:" << m_consecutiveErrors;
                }
                m_receiveBuffer = m_receiveBuffer.mid(totalLen);
            } else {
                break;
            }
        } else {
            m_receiveBuffer.remove(0, 1);
        }
    }
    
    if (m_consecutiveErrors > 10) {
        handleTranscriptionError("Too many consecutive errors - resetting connection");
        m_consecutiveErrors = 0;
    }
}

void HardwareDriver::onSerialError(QSerialPort::SerialPortError error)
{
    if (error != QSerialPort::NoError) {
        emit deviceError(m_serialPort->errorString());
    }
}

void HardwareDriver::pollDeviceStatus()
{
    if (isConnected()) {
        sendCommand(buildCommand(CMD_GET_STATUS));
    }
}

void HardwareDriver::parseResponse(const QByteArray& response)
{
    if (response.isEmpty()) return;

    quint8 cmdId = response[0];
    QByteArray payload = response.mid(1);

    switch (cmdId) {
        case CMD_GET_DEVICE_INFO:
            if (payload.size() >= 32) {
                m_deviceInfo.deviceId = QString::fromLatin1(payload.mid(0, 16));
                m_deviceInfo.deviceName = QString::fromLatin1(payload.mid(16, 12));
                m_deviceInfo.firmwareVersion = QString::fromLatin1(payload.mid(28, 4));
            }
            break;

        case CMD_STATUS_UPDATE:
            if (payload.size() >= 11) {
                m_tapeStatus.isPlaying = payload[0] & 0x01;
                m_tapeStatus.isRecording = payload[0] & 0x02;
                m_tapeStatus.currentPosition = 
                    ((quint8)payload[1] << 24) | 
                    ((quint8)payload[2] << 16) | 
                    ((quint8)payload[3] << 8) | 
                    (quint8)payload[4];
                m_tapeStatus.totalLength = 
                    ((quint8)payload[5] << 24) | 
                    ((quint8)payload[6] << 16) | 
                    ((quint8)payload[7] << 8) | 
                    (quint8)payload[8];
                m_tapeStatus.tapeSpeed = (quint8)payload[9] / 10.0f;
                m_tapeStatus.signalLevel = (quint8)payload[10];
                emit tapeStatusUpdated(m_tapeStatus);
            }
            break;

        case CMD_AUDIO_DATA:
            emit audioDataReceived(payload);
            break;

        case CMD_VIDEO_FRAME:
            emit videoFrameReceived(payload);
            break;

        default:
            emit rawDataReceived(response);
            break;
    }
}

void HardwareDriver::sendCommand(const QByteArray& cmd)
{
    if (isConnected() && m_serialPort->isWritable()) {
        m_serialPort->write(cmd);
        m_serialPort->flush();
    }
}

QByteArray HardwareDriver::buildCommand(quint8 cmdId, const QByteArray& payload)
{
    QByteArray cmd;
    cmd.append(0xAA);
    cmd.append(0x55);
    cmd.append(1 + payload.size());
    cmd.append(cmdId);
    cmd.append(payload);
    
    quint8 checksum = 0;
    for (int i = 2; i < cmd.size(); i++) {
        checksum += cmd[i];
    }
    cmd.append(checksum);
    
    return cmd;
}

void HardwareDriver::sendHeartbeat()
{
    if (isConnected()) {
        sendCommand(buildCommand(CMD_PING));
    }
}

void HardwareDriver::onWatchdogTimeout()
{
    if (m_isTranscribing) {
        qDebug() << "Watchdog timeout - no data received during transcription, attempting recovery";
        
        if (m_serialPort->isOpen()) {
            m_serialPort->clear();
            sendCommand(buildCommand(CMD_START_TRANSCRIPTION));
        }
        
        m_consecutiveErrors++;
        if (m_consecutiveErrors > 5) {
            handleTranscriptionError("Watchdog triggered too many times - connection unstable");
        }
    }
}

void HardwareDriver::handleTranscriptionError(const QString& error)
{
    qDebug() << "Transcription error:" << error;
    
    if (m_isTranscribing && m_serialPort->isOpen()) {
        m_serialPort->clear();
        QThread::msleep(50);
        sendCommand(buildCommand(CMD_START_TRANSCRIPTION));
    }
    
    emit deviceError(error);
}
