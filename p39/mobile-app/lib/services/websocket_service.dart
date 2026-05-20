import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketService extends ChangeNotifier {
  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  bool _isManualDisconnect = false;
  final List<Map<String, dynamic>> _notifications = [];
  final StreamController<Map<String, dynamic>> _notificationController =
      StreamController.broadcast();

  final String baseUrl;
  final int? userId;
  final Duration reconnectInterval;

  WebSocketService({
    required this.baseUrl,
    this.userId,
    this.reconnectInterval = const Duration(seconds: 5),
  });

  bool get isConnected => _isConnected;
  List<Map<String, dynamic>> get notifications => _notifications;
  Stream<Map<String, dynamic>> get notificationStream => _notificationController.stream;

  void connect() {
    if (_isConnected) return;

    try {
      final wsUrl = Uri.parse('$baseUrl/ws');
      _channel = WebSocketChannel.connect(wsUrl);

      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );

      _isConnected = true;
      _isManualDisconnect = false;
      debugPrint('WebSocket 连接成功');
      notifyListeners();
    } catch (e) {
      debugPrint('WebSocket 连接失败: $e');
      _scheduleReconnect();
    }
  }

  void _onMessage(dynamic message) {
    try {
      final data = jsonDecode(message);
      if (data is Map<String, dynamic>) {
        _notifications.insert(0, data);
        if (_notifications.length > 50) {
          _notifications.removeLast();
        }
        _notificationController.add(data);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('解析 WebSocket 消息失败: $e');
    }
  }

  void _onError(dynamic error) {
    debugPrint('WebSocket 错误: $error');
    _isConnected = false;
    notifyListeners();
    _scheduleReconnect();
  }

  void _onDone() {
    debugPrint('WebSocket 连接断开');
    _isConnected = false;
    notifyListeners();
    if (!_isManualDisconnect) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_reconnectTimer?.isActive ?? false) return;

    _reconnectTimer = Timer(reconnectInterval, () {
      debugPrint('尝试重新连接 WebSocket...');
      connect();
    });
  }

  void disconnect() {
    _isManualDisconnect = true;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _isConnected = false;
    notifyListeners();
  }

  void send(Map<String, dynamic> message) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(jsonEncode(message));
    }
  }

  void clearNotifications() {
    _notifications.clear();
    notifyListeners();
  }

  void markAsRead(String notificationId) {
    final index = _notifications.indexWhere(
      (n) => n['id']?.toString() == notificationId,
    );
    if (index != -1) {
      _notifications[index]['isRead'] = true;
      notifyListeners();
    }
  }

  int get unreadCount => _notifications.where((n) => !(n['isRead'] ?? false)).length;

  @override
  void dispose() {
    disconnect();
    _notificationController.close();
    super.dispose();
  }
}
