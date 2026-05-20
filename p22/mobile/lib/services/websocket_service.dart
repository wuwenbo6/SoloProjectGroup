import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/frame_data.dart';
import '../models/feedback.dart';
import '../models/room_message.dart';

enum ConnectionStatus {
  disconnected,
  connecting,
  connected,
  reconnecting,
}

class WebSocketService {
  WebSocketChannel? _channel;
  String? _serverUrl;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 10;
  static const Duration _heartbeatInterval = Duration(seconds: 25);
  static const Duration _baseReconnectDelay = Duration(seconds: 2);

  ConnectionStatus _status = ConnectionStatus.disconnected;
  ConnectionStatus get status => _status;

  Function(Feedback)? onFeedbackReceived;
  Function(RoomMessage)? onRoomMessageReceived;
  Function(ConnectionStatus)? onConnectionStatusChanged;
  Function(int)? onReconnectAttempt;

  Future<void> connect(String url) async {
    _serverUrl = url;
    _reconnectAttempts = 0;
    await _doConnect();
  }

  Future<void> _doConnect() async {
    if (_status == ConnectionStatus.connecting || _status == ConnectionStatus.reconnecting) {
      return;
    }

    _status = _reconnectAttempts > 0
        ? ConnectionStatus.reconnecting
        : ConnectionStatus.connecting;
    _notifyStatusChanged();

    try {
      print('WebSocket connecting (attempt ${_reconnectAttempts + 1})...');
      _channel = WebSocketChannel.connect(Uri.parse(_serverUrl!));

      _channel!.stream.listen(
        (message) {
          _handleMessage(message);
        },
        onError: (error) {
          print('WebSocket error: $error');
          _handleDisconnection();
        },
        onDone: () {
          print('WebSocket connection closed');
          _handleDisconnection();
        },
        cancelOnError: true,
      );

      _status = ConnectionStatus.connected;
      _notifyStatusChanged();
      _reconnectAttempts = 0;
      _startHeartbeat();

      print('WebSocket connected successfully');
    } catch (e) {
      print('Failed to connect: $e');
      _handleDisconnection();
    }
  }

  void _handleMessage(dynamic message) {
    if (message == 'PONG') {
      print('Received PONG from server');
      return;
    }

    try {
      final data = jsonDecode(message);

      if (data['type'] != null) {
        final roomMessage = RoomMessage.fromJson(data);
        if (onRoomMessageReceived != null) {
          onRoomMessageReceived!(roomMessage);
        }
        return;
      }

      if (onFeedbackReceived != null) {
        onFeedbackReceived!(Feedback.fromJson(data));
      }
    } catch (e) {
      print('Error parsing message: $e');
    }
  }

  void _handleDisconnection() {
    _stopHeartbeat();
    _channel = null;

    if (_status == ConnectionStatus.disconnected) {
      return;
    }

    if (_reconnectAttempts < _maxReconnectAttempts) {
      _scheduleReconnect();
    } else {
      _status = ConnectionStatus.disconnected;
      _notifyStatusChanged();
      print('Max reconnect attempts reached, giving up');
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();

    final delay = Duration(
      milliseconds: _baseReconnectDelay.inMilliseconds * (1 << _reconnectAttempts),
    ).clamp(Duration.zero, Duration(seconds: 30));

    print('Scheduling reconnect in ${delay.inSeconds}s (attempt ${_reconnectAttempts + 1}/$_maxReconnectAttempts)');

    _status = ConnectionStatus.reconnecting;
    _notifyStatusChanged();
    onReconnectAttempt?.call(_reconnectAttempts + 1);

    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      _doConnect();
    });
  }

  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) {
      if (_channel != null && _status == ConnectionStatus.connected) {
        try {
          _channel!.sink.add('PING');
          print('Sent PING to server');
        } catch (e) {
          print('Failed to send heartbeat: $e');
          _handleDisconnection();
        }
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void _notifyStatusChanged() {
    onConnectionStatusChanged?.call(_status);
  }

  void sendFrameData(FrameData frameData) {
    if (_channel != null && _status == ConnectionStatus.connected) {
      try {
        _channel!.sink.add(jsonEncode(frameData.toJson()));
      } catch (e) {
        print('Failed to send frame data: $e');
      }
    }
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectAttempts = 0;
    _stopHeartbeat();
    _channel?.sink.close();
    _channel = null;
    _status = ConnectionStatus.disconnected;
    _notifyStatusChanged();
    print('WebSocket disconnected manually');
  }

  void resetReconnectAttempts() {
    _reconnectAttempts = 0;
  }
}
