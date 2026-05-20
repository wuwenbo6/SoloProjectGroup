import 'dart:async';
import 'dart:convert';
import 'package:get/get.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class WebSocketSyncService extends GetxService {
  WebSocketChannel? _channel;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  
  final String _wsUrl = 'ws://localhost:9000/ws/order-sync';
  final int _heartbeatInterval = 30;
  final int _maxReconnectAttempts = 5;
  int _reconnectAttempts = 0;
  bool _isManualDisconnect = false;
  
  final RxBool isConnected = false.obs;
  final RxList<Map<String, dynamic>> pendingMessages = <Map<String, dynamic>>[].obs;
  final RxMap<String, dynamic> lastKnownStates = <String, dynamic>{}.obs;
  
  final StreamController<Map<String, dynamic>> _messageController = StreamController.broadcast();
  Stream<Map<String, dynamic>> get onMessage => _messageController.stream;
  
  @override
  void onInit() {
    super.onInit();
    _initConnectivityListener();
  }
  
  @override
  void onClose() {
    disconnect();
    _messageController.close();
    super.onClose();
  }
  
  void _initConnectivityListener() {
    Connectivity().onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none && !isConnected.value) {
        _attemptReconnect();
      }
    });
  }
  
  Future<void> connect({String? userId}) async {
    if (isConnected.value) return;
    
    try {
      final uri = userId != null 
          ? Uri.parse('$_wsUrl?userId=$userId')
          : Uri.parse(_wsUrl);
      
      _channel = WebSocketChannel.connect(uri);
      _isManualDisconnect = false;
      
      _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDone,
      );
      
      isConnected.value = true;
      _reconnectAttempts = 0;
      _startHeartbeat();
      
      print('WebSocket连接成功');
      
      _sendPendingMessages();
    } catch (e) {
      print('WebSocket连接失败: $e');
      isConnected.value = false;
      _attemptReconnect();
    }
  }
  
  void disconnect() {
    _isManualDisconnect = true;
    _heartbeatTimer?.cancel();
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    isConnected.value = false;
  }
  
  void _handleMessage(dynamic message) {
    try {
      final data = jsonDecode(message.toString());
      final msgType = data['type'] ?? '';
      
      switch (msgType) {
        case 'ORDER_STATUS_UPDATE':
          _handleOrderStatusUpdate(data);
          break;
        case 'HEARTBEAT_ACK':
          print('收到心跳响应');
          break;
        case 'SYNC_RESPONSE':
          _handleSyncResponse(data);
          break;
        default:
          print('收到未知消息类型: $msgType');
      }
      
      _messageController.add(data);
    } catch (e) {
      print('解析WebSocket消息失败: $e');
    }
  }
  
  void _handleOrderStatusUpdate(Map<String, dynamic> data) {
    final orderNo = data['orderNo'];
    final status = data['status'];
    final updateTime = data['updateTime'];
    
    if (orderNo != null) {
      final currentState = lastKnownStates[orderNo];
      if (currentState == null || 
          DateTime.parse(updateTime).isAfter(DateTime.parse(currentState['updateTime']))) {
        lastKnownStates[orderNo] = {
          'status': status,
          'updateTime': updateTime,
          'data': data,
        };
        print('订单状态更新: $orderNo -> $status');
      }
    }
  }
  
  void _handleSyncResponse(Map<String, dynamic> data) {
    final orders = data['orders'] as List?;
    if (orders != null) {
      for (final order in orders) {
        final orderNo = order['orderNo'];
        if (orderNo != null) {
          lastKnownStates[orderNo] = {
            'status': order['status'],
            'updateTime': order['updateTime'],
            'data': order,
          };
        }
      }
    }
  }
  
  void _handleError(dynamic error) {
    print('WebSocket错误: $error');
    isConnected.value = false;
  }
  
  void _handleDone() {
    print('WebSocket连接关闭');
    isConnected.value = false;
    if (!_isManualDisconnect) {
      _attemptReconnect();
    }
  }
  
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(Duration(seconds: _heartbeatInterval), (_) {
      if (isConnected.value) {
        _sendMessage({'type': 'HEARTBEAT', 'timestamp': DateTime.now().toIso8601String()});
      }
    });
  }
  
  void _attemptReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      print('达到最大重连次数，停止重连');
      return;
    }
    
    _reconnectTimer?.cancel();
    final delay = Duration(seconds: 2 * (_reconnectAttempts + 1));
    
    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      print('尝试第$_reconnectAttempts次重连...');
      connect();
    });
  }
  
  void _sendMessage(Map<String, dynamic> message) {
    if (_channel != null && isConnected.value) {
      _channel!.sink.add(jsonEncode(message));
    }
  }
  
  void _sendPendingMessages() {
    for (final msg in pendingMessages) {
      _sendMessage(msg);
    }
    pendingMessages.clear();
  }
  
  void sendOrderSyncRequest(String orderNo) {
    final message = {
      'type': 'SYNC_REQUEST',
      'orderNo': orderNo,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    if (isConnected.value) {
      _sendMessage(message);
    } else {
      pendingMessages.add(message);
    }
  }
  
  void sendBatchSyncRequest(List<String> orderNos) {
    final message = {
      'type': 'BATCH_SYNC_REQUEST',
      'orderNos': orderNos,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    if (isConnected.value) {
      _sendMessage(message);
    } else {
      pendingMessages.add(message);
    }
  }
  
  Future<bool> waitForOrderStatus(String orderNo, int targetStatus, {Duration timeout = const Duration(seconds: 30)}) async {
    final completer = Completer<bool>();
    Timer? timeoutTimer;
    
    StreamSubscription? subscription;
    subscription = onMessage.listen((data) {
      if (data['type'] == 'ORDER_STATUS_UPDATE' && 
          data['orderNo'] == orderNo && 
          data['status'] == targetStatus) {
        subscription?.cancel();
        timeoutTimer?.cancel();
        completer.complete(true);
      }
    });
    
    timeoutTimer = Timer(timeout, () {
      subscription?.cancel();
      completer.complete(false);
    });
    
    sendOrderSyncRequest(orderNo);
    
    return completer.future;
  }
}
