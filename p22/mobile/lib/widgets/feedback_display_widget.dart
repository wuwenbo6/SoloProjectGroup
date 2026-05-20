import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/workout_provider.dart';
import '../services/websocket_service.dart';

class FeedbackDisplayWidget extends StatelessWidget {
  const FeedbackDisplayWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<WorkoutProvider>(
      builder: (context, provider, child) {
        final feedback = provider.currentFeedback;
        final isRecording = provider.isRecording;
        final connectionStatus = provider.connectionStatus;
        final reconnectAttempt = provider.currentReconnectAttempt;

        if (!provider.isConnected) {
          return _buildConnectionStatusCard(connectionStatus, reconnectAttempt, provider);
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _getBackgroundColor(feedback?.type),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Icon(
                    _getFeedbackIcon(feedback?.type),
                    color: Colors.white,
                    size: 28,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      feedback?.message ?? (isRecording ? '正在分析动作...' : '点击开始按钮开始训练'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              if (feedback != null && feedback.corrections.isNotEmpty) ...[
                const SizedBox(height: 12),
                ...feedback.corrections.map((correction) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber, color: Colors.yellow, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              correction,
                              style: const TextStyle(color: Colors.white70, fontSize: 14),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildConnectionStatusCard(
    ConnectionStatus status,
    int? reconnectAttempt,
    WorkoutProvider provider,
  ) {
    Color bgColor;
    IconData icon;
    String message;
    bool showRetry = false;

    switch (status) {
      case ConnectionStatus.connecting:
        bgColor = Colors.blue.shade700;
        icon = Icons.sync;
        message = '正在连接服务器...';
        break;
      case ConnectionStatus.reconnecting:
        bgColor = Colors.orange.shade700;
        icon = Icons.refresh;
        message = '网络中断，正在重连... (第${reconnectAttempt ?? 1}次尝试)';
        break;
      case ConnectionStatus.disconnected:
        bgColor = Colors.red.shade700;
        icon = Icons.cloud_off;
        message = '连接已断开';
        showRetry = true;
        break;
      default:
        bgColor = Colors.grey.shade700;
        icon = Icons.help_outline;
        message = '未知状态';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              status == ConnectionStatus.connecting || status == ConnectionStatus.reconnecting
                  ? SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Icon(icon, color: Colors.white, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (showRetry) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => provider.retryConnection(),
                icon: const Icon(Icons.refresh, size: 20),
                label: const Text('立即重连'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: bgColor,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
          if (status == ConnectionStatus.reconnecting) ...[
            const SizedBox(height: 12),
            LinearProgressIndicator(
              backgroundColor: Colors.white.withOpacity(0.2),
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ],
        ],
      ),
    );
  }

  Color _getBackgroundColor(String? type) {
    switch (type) {
      case 'CORRECT':
        return Colors.green.shade700;
      case 'CORRECTION':
        return Colors.orange.shade700;
      case 'INFO':
        return Colors.blue.shade700;
      default:
        return Colors.grey.shade700;
    }
  }

  IconData _getFeedbackIcon(String? type) {
    switch (type) {
      case 'CORRECT':
        return Icons.check_circle;
      case 'CORRECTION':
        return Icons.error_outline;
      case 'INFO':
        return Icons.info;
      default:
        return Icons.fitness_center;
    }
  }
}
