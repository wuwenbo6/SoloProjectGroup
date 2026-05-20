import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../providers/workout_provider.dart';
import '../services/video_upload_service.dart';
import '../models/video_task.dart';
import '../models/exercise_template.dart';

class OfflineModeScreen extends StatefulWidget {
  const OfflineModeScreen({super.key});

  @override
  State<OfflineModeScreen> createState() => _OfflineModeScreenState();
}

class _OfflineModeScreenState extends State<OfflineModeScreen> {
  CameraController? _cameraController;
  VideoPlayerController? _videoPlayerController;
  bool _isRecording = false;
  bool _isRecordingStarted = false;
  String? _recordedVideoPath;
  List<VideoTask> _tasks = [];
  bool _isLoading = false;
  final VideoUploadService _uploadService = VideoUploadService();
  ExerciseTemplate? _selectedExercise;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
    _loadUserTasks();
  }

  Future<void> _initializeCamera() async {
    try {
      final cameras = await availableCameras();
      final frontCamera = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        frontCamera,
        ResolutionPreset.medium,
        enableAudio: true,
      );

      await _cameraController!.initialize();
      if (mounted) setState(() {});
    } catch (e) {
      print('Camera initialization error: $e');
    }
  }

  Future<void> _loadUserTasks() async {
    setState(() => _isLoading = true);
    try {
      _tasks = await _uploadService.getUserTasks(1);
    } catch (e) {
      print('Error loading tasks: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _startRecording() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    try {
      await _cameraController!.startVideoRecording();
      setState(() {
        _isRecording = true;
        _isRecordingStarted = true;
      });
    } catch (e) {
      print('Start recording error: $e');
    }
  }

  Future<void> _stopRecording() async {
    if (_cameraController == null || !_isRecording) return;

    try {
      final videoFile = await _cameraController!.stopVideoRecording();
      setState(() {
        _isRecording = false;
        _recordedVideoPath = videoFile.path;
      });

      _videoPlayerController = VideoPlayerController.file(File(_recordedVideoPath!))
        ..initialize().then((_) => setState(() {}));
    } catch (e) {
      print('Stop recording error: $e');
    }
  }

  Future<void> _uploadVideo() async {
    if (_recordedVideoPath == null || _selectedExercise == null) return;

    setState(() => _isLoading = true);

    try {
      VideoTask task = await _uploadService.uploadVideo(
        File(_recordedVideoPath!),
        1,
        _selectedExercise!.id,
        onProgress: (sent, total) {
          print('Upload progress: ${(sent / total * 100).toStringAsFixed(0)}%');
        },
      );

      _startPollingTaskStatus(task.taskId);

      setState(() {
        _tasks.insert(0, task);
        _recordedVideoPath = null;
        _videoPlayerController?.dispose();
        _videoPlayerController = null;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('视频已上传，正在后台分析...')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('上传失败: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _startPollingTaskStatus(String taskId) async {
    int attempts = 0;
    while (attempts < 60) {
      await Future.delayed(const Duration(seconds: 2));
      try {
        final updatedTask = await _uploadService.getTaskStatus(taskId);
        final index = _tasks.indexWhere((t) => t.taskId == taskId);
        if (index != -1 && mounted) {
          setState(() {
            _tasks[index] = updatedTask;
          });
        }
        if (updatedTask.isCompleted || updatedTask.isFailed || updatedTask.isCancelled) {
          break;
        }
      } catch (e) {
        print('Polling error: $e');
      }
      attempts++;
    }
  }

  void _discardVideo() {
    setState(() {
      _recordedVideoPath = null;
      _videoPlayerController?.dispose();
      _videoPlayerController = null;
    });
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _videoPlayerController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('离线模式'),
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.videocam), text: '录制'),
              Tab(icon: Icon(Icons.history), text: '历史记录'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildRecordingTab(),
            _buildHistoryTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildRecordingTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildCameraPreview(),
          const SizedBox(height: 24),
          _buildExerciseSelector(),
          const SizedBox(height: 16),
          _buildRecordingControls(),
          if (_recordedVideoPath != null) ...[
            const SizedBox(height: 24),
            _buildVideoPreview(),
          ],
        ],
      ),
    );
  }

  Widget _buildCameraPreview() {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return Container(
        height: 300,
        color: Colors.black,
        child: const Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    return Container(
      height: 300,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          CameraPreview(_cameraController!),
          if (_isRecording)
            Positioned(
              top: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, color: Colors.white, size: 10),
                    SizedBox(width: 8),
                    Text('REC', style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildExerciseSelector() {
    return Consumer<WorkoutProvider>(
      builder: (context, provider, child) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '选择训练项目',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<ExerciseTemplate>(
                value: _selectedExercise,
                hint: const Text('请选择'),
                isExpanded: true,
                items: provider.templates
                    .map((template) => DropdownMenuItem(
                          value: template,
                          child: Text(template.name),
                        ))
                    .toList(),
                onChanged: (value) {
                  setState(() => _selectedExercise = value);
                },
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRecordingControls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (!_isRecordingStarted || _recordedVideoPath != null)
          ElevatedButton.icon(
            onPressed: _selectedExercise != null && !_isLoading ? _startRecording : null,
            icon: const Icon(Icons.videocam),
            label: const Text('开始录制'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
          ),
        if (_isRecording)
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _stopRecording,
            icon: const Icon(Icons.stop),
            label: const Text('停止录制'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.grey.shade700,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
          ),
      ],
    );
  }

  Widget _buildVideoPreview() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          const Text(
            '视频预览',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Container(
            height: 200,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: _videoPlayerController != null &&
                    _videoPlayerController!.value.isInitialized
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      VideoPlayer(_videoPlayerController!),
                      Center(
                        child: IconButton(
                          icon: Icon(
                            _videoPlayerController!.value.isPlaying
                                ? Icons.pause_circle_filled
                                : Icons.play_circle_filled,
                            color: Colors.white,
                            size: 48,
                          ),
                          onPressed: () {
                            setState(() {
                              if (_videoPlayerController!.value.isPlaying) {
                                _videoPlayerController!.pause();
                              } else {
                                _videoPlayerController!.play();
                              }
                            });
                          },
                        ),
                      ),
                    ],
                  )
                : const Center(child: CircularProgressIndicator()),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : _discardVideo,
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label: const Text('丢弃', style: TextStyle(color: Colors.red)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _uploadVideo,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.cloud_upload),
                  label: Text(_isLoading ? '上传中...' : '上传分析'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab() {
    if (_isLoading && _tasks.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_tasks.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.videocam_off, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('暂无历史记录', style: TextStyle(fontSize: 16, color: Colors.grey)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _tasks.length,
      itemBuilder: (context, index) {
        return _buildTaskCard(_tasks[index]);
      },
    );
  }

  Widget _buildTaskCard(VideoTask task) {
    Color statusColor;
    IconData statusIcon;

    if (task.isCompleted) {
      statusColor = Colors.green;
      statusIcon = Icons.check_circle;
    } else if (task.isProcessing) {
      statusColor = Colors.orange;
      statusIcon = Icons.hourglass_bottom;
    } else if (task.isFailed) {
      statusColor = Colors.red;
      statusIcon = Icons.error;
    } else if (task.isCancelled) {
      statusColor = Colors.grey;
      statusIcon = Icons.cancel;
    } else {
      statusColor = Colors.blue;
      statusIcon = Icons.schedule;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(statusIcon, color: statusColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.exerciseName ?? '未知训练',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        task.statusDescription,
                        style: TextStyle(color: statusColor, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Text(
                  '#${task.taskId.substring(task.taskId.length - 6)}',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
            if (task.isProcessing) ...[
              const SizedBox(height: 12),
              LinearProgressIndicator(value: task.progress / 100),
              const SizedBox(height: 8),
              Text('${task.progress}% 完成', style: const TextStyle(fontSize: 12)),
            ],
            if (task.isCompleted) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Text(
                          '${task.averageAccuracy?.toStringAsFixed(1)}%',
                          style: TextStyle(
                            color: Colors.green.shade700,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text('准确度', style: TextStyle(color: Colors.green.shade700)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Text(
                          '${task.repsCount}',
                          style: TextStyle(
                            color: Colors.blue.shade700,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text('次数', style: TextStyle(color: Colors.blue.shade700)),
                      ],
                    ),
                  ),
                ],
              ),
              if (task.suggestionList.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  '改进建议',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                ...task.suggestionList.map((suggestion) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.lightbulb, size: 16, color: Colors.amber.shade700),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(suggestion, style: const TextStyle(fontSize: 13)),
                          ),
                        ],
                      ),
                    )),
              ],
            ],
            const SizedBox(height: 8),
            Text(
              task.createdAt != null
                  ? '创建时间: ${task.createdAt!.toString().substring(0, 19)}'
                  : '',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
