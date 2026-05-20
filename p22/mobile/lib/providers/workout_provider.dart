import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/exercise_template.dart';
import '../models/feedback.dart';
import '../models/frame_data.dart';
import '../models/keypoint.dart';
import '../models/room_message.dart';
import '../services/websocket_service.dart';

class WorkoutProvider with ChangeNotifier {
  final WebSocketService _webSocketService = WebSocketService();
  List<ExerciseTemplate> _templates = [];
  ExerciseTemplate? _selectedTemplate;
  Feedback? _currentFeedback;
  bool _isRecording = false;
  int _frameCount = 0;
  int? _currentReconnectAttempt;
  RoomMessage? _latestCoachCommand;
  List<RoomMessage> _messageHistory = [];

  List<ExerciseTemplate> get templates => _templates;
  ExerciseTemplate? get selectedTemplate => _selectedTemplate;
  Feedback? get currentFeedback => _currentFeedback;
  bool get isRecording => _isRecording;
  ConnectionStatus get connectionStatus => _webSocketService.status;
  int? get currentReconnectAttempt => _currentReconnectAttempt;
  bool get isConnected => _webSocketService.status == ConnectionStatus.connected;
  RoomMessage? get latestCoachCommand => _latestCoachCommand;
  List<RoomMessage> get messageHistory => List.unmodifiable(_messageHistory);

  WorkoutProvider() {
    _webSocketService.onFeedbackReceived = _handleFeedback;
    _webSocketService.onRoomMessageReceived = _handleRoomMessage;
    _webSocketService.onConnectionStatusChanged = _handleConnectionStatusChanged;
    _webSocketService.onReconnectAttempt = _handleReconnectAttempt;
  }

  void _handleRoomMessage(RoomMessage message) {
    if (message.isCoachCommand) {
      _latestCoachCommand = message;
    }
    _messageHistory.insert(0, message);
    if (_messageHistory.length > 50) {
      _messageHistory.removeLast();
    }
    notifyListeners();
  }

  Future<void> loadTemplates() async {
    try {
      final response = await http.get(Uri.parse('http://localhost:8080/api/exercises/templates'));
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _templates = data.map((json) => ExerciseTemplate.fromJson(json)).toList();
        notifyListeners();
      }
    } catch (e) {
      print('Failed to load templates: $e');
    }
  }

  void selectTemplate(ExerciseTemplate template) {
    _selectedTemplate = template;
    notifyListeners();
  }

  Future<void> startWorkout() async {
    if (_selectedTemplate == null) return;
    await _webSocketService.connect('ws://localhost:8080/ws/motion');
    _isRecording = true;
    _frameCount = 0;
    notifyListeners();
  }

  void stopWorkout() {
    _webSocketService.disconnect();
    _isRecording = false;
    _currentReconnectAttempt = null;
    notifyListeners();
  }

  void sendKeypoints(List<Keypoint> keypoints) {
    if (!_isRecording) return;
    
    final frameData = FrameData(
      timestamp: DateTime.now().millisecondsSinceEpoch,
      frameNumber: _frameCount++,
      keypoints: keypoints,
      userId: 1,
      exerciseTemplateId: _selectedTemplate?.id,
    );
    _webSocketService.sendFrameData(frameData);
  }

  void _handleFeedback(Feedback feedback) {
    _currentFeedback = feedback;
    notifyListeners();
  }

  void _handleConnectionStatusChanged(ConnectionStatus status) {
    notifyListeners();
  }

  void _handleReconnectAttempt(int attempt) {
    _currentReconnectAttempt = attempt;
    notifyListeners();
  }

  void retryConnection() {
    _webSocketService.resetReconnectAttempts();
    startWorkout();
  }

  @override
  void dispose() {
    _webSocketService.disconnect();
    super.dispose();
  }
}
