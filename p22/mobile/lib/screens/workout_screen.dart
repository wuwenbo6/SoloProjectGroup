import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/workout_provider.dart';
import '../models/room_message.dart';
import '../services/websocket_service.dart';
import '../widgets/camera_preview_widget.dart';
import '../widgets/feedback_display_widget.dart';

class WorkoutScreen extends StatefulWidget {
  const WorkoutScreen({super.key});

  @override
  State<WorkoutScreen> createState() => _WorkoutScreenState();
}

class _WorkoutScreenState extends State<WorkoutScreen> {
  Widget _buildConnectionIndicator(ConnectionStatus status) {
    Color color;
    String tooltip;

    switch (status) {
      case ConnectionStatus.connected:
        color = Colors.green;
        tooltip = '已连接';
        break;
      case ConnectionStatus.connecting:
      case ConnectionStatus.reconnecting:
        color = Colors.orange;
        tooltip = '连接中...';
        break;
      case ConnectionStatus.disconnected:
        color = Colors.red;
        tooltip = '已断开';
        break;
    }

    return Tooltip(
      message: tooltip,
      child: Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.5),
              blurRadius: 4,
              spreadRadius: 1,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCoachCommandCard(RoomMessage command) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.purple.shade600, Colors.blue.shade600],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.sports_gymnastics,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '教练指令',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  command.content,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (command.senderName != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '来自: ${command.senderName}',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Consumer<WorkoutProvider>(
          builder: (context, provider, child) {
            return Row(
              children: [
                Text(provider.selectedTemplate?.name ?? '训练中'),
                const SizedBox(width: 12),
                _buildConnectionIndicator(provider.connectionStatus),
              ],
            );
          },
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      extendBodyBehindAppBar: true,
      body: Consumer<WorkoutProvider>(
        builder: (context, provider, child) {
          return Stack(
            children: [
              const CameraPreviewWidget(),
              if (provider.latestCoachCommand != null)
                Positioned(
                  top: 80,
                  left: 16,
                  right: 16,
                  child: _buildCoachCommandCard(provider.latestCoachCommand!),
                ),
              Positioned(
                top: provider.latestCoachCommand != null ? 180 : 100,
                left: 16,
                right: 16,
                child: const FeedbackDisplayWidget(),
              ),
              Positioned(
                bottom: 32,
                left: 16,
                right: 16,
                child: _buildControlPanel(provider),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildControlPanel(WorkoutProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${provider.currentFeedback?.repsCount ?? 0}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text(
                '次数',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ],
          ),
          FloatingActionButton(
            onPressed: () {
              if (provider.isRecording) {
                provider.stopWorkout();
              } else {
                provider.startWorkout();
              }
            },
            backgroundColor: provider.isRecording ? Colors.red : Colors.blue,
            child: Icon(provider.isRecording ? Icons.stop : Icons.play_arrow),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${(provider.currentFeedback?.accuracy ?? 0).toStringAsFixed(0)}%',
                style: TextStyle(
                  color: (provider.currentFeedback?.accuracy ?? 0) >= 75
                      ? Colors.green
                      : Colors.orange,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text(
                '准确度',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
