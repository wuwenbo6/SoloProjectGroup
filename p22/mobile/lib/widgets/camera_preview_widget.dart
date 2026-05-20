import 'dart:async';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:provider/provider.dart';
import '../providers/workout_provider.dart';
import '../models/keypoint.dart';

class CameraPreviewWidget extends StatefulWidget {
  const CameraPreviewWidget({super.key});

  @override
  State<CameraPreviewWidget> createState() => _CameraPreviewWidgetState();
}

class _CameraPreviewWidgetState extends State<CameraPreviewWidget> {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  Timer? _frameTimer;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras!.isNotEmpty) {
        _controller = CameraController(
          _cameras!.firstWhere(
            (cam) => cam.lensDirection == CameraLensDirection.front,
            orElse: () => _cameras!.first,
          ),
          ResolutionPreset.medium,
        );
        await _controller!.initialize();
        if (mounted) {
          setState(() {
            _isInitialized = true;
          });
          _startFrameProcessing();
        }
      }
    } catch (e) {
      print('Camera initialization error: $e');
    }
  }

  void _startFrameProcessing() {
    _frameTimer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      _processFrame();
    });
  }

  void _processFrame() {
    final provider = Provider.of<WorkoutProvider>(context, listen: false);
    if (provider.isRecording) {
      final mockKeypoints = _generateMockKeypoints();
      provider.sendKeypoints(mockKeypoints);
    }
  }

  List<Keypoint> _generateMockKeypoints() {
    return [
      Keypoint(name: 'nose', x: 0.5, y: 0.2, z: 0.0, visibility: 1.0),
      Keypoint(name: 'left_shoulder', x: 0.35, y: 0.35, z: 0.0, visibility: 1.0),
      Keypoint(name: 'right_shoulder', x: 0.65, y: 0.35, z: 0.0, visibility: 1.0),
      Keypoint(name: 'left_elbow', x: 0.25, y: 0.5, z: 0.0, visibility: 1.0),
      Keypoint(name: 'right_elbow', x: 0.75, y: 0.5, z: 0.0, visibility: 1.0),
      Keypoint(name: 'left_wrist', x: 0.2, y: 0.65, z: 0.0, visibility: 1.0),
      Keypoint(name: 'right_wrist', x: 0.8, y: 0.65, z: 0.0, visibility: 1.0),
      Keypoint(name: 'left_hip', x: 0.4, y: 0.65, z: 0.0, visibility: 1.0),
      Keypoint(name: 'right_hip', x: 0.6, y: 0.65, z: 0.0, visibility: 1.0),
      Keypoint(name: 'left_knee', x: 0.35, y: 0.8, z: 0.0, visibility: 1.0),
      Keypoint(name: 'right_knee', x: 0.65, y: 0.8, z: 0.0, visibility: 1.0),
      Keypoint(name: 'left_ankle', x: 0.3, y: 0.95, z: 0.0, visibility: 1.0),
      Keypoint(name: 'right_ankle', x: 0.7, y: 0.95, z: 0.0, visibility: 1.0),
    ];
  }

  @override
  void dispose() {
    _frameTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized || _controller == null) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 16),
              Text(
                '正在初始化摄像头...',
                style: TextStyle(color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        CameraPreview(_controller!),
        CustomPaint(
          painter: SkeletonPainter(),
        ),
      ],
    );
  }
}

class SkeletonPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.green
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;

    final dotPaint = Paint()
      ..color = Colors.blue
      ..style = PaintingStyle.fill;

    final joints = {
      'left_shoulder': Offset(size.width * 0.35, size.height * 0.35),
      'right_shoulder': Offset(size.width * 0.65, size.height * 0.35),
      'left_elbow': Offset(size.width * 0.25, size.height * 0.5),
      'right_elbow': Offset(size.width * 0.75, size.height * 0.5),
      'left_wrist': Offset(size.width * 0.2, size.height * 0.65),
      'right_wrist': Offset(size.width * 0.8, size.height * 0.65),
      'left_hip': Offset(size.width * 0.4, size.height * 0.65),
      'right_hip': Offset(size.width * 0.6, size.height * 0.65),
      'left_knee': Offset(size.width * 0.35, size.height * 0.8),
      'right_knee': Offset(size.width * 0.65, size.height * 0.8),
      'left_ankle': Offset(size.width * 0.3, size.height * 0.95),
      'right_ankle': Offset(size.width * 0.7, size.height * 0.95),
    };

    final connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['right_shoulder', 'right_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['right_hip', 'right_knee'],
      ['left_knee', 'left_ankle'],
      ['right_knee', 'right_ankle'],
    ];

    for (var connection in connections) {
      final start = joints[connection[0]];
      final end = joints[connection[1]];
      if (start != null && end != null) {
        canvas.drawLine(start, end, paint);
      }
    }

    for (var joint in joints.values) {
      canvas.drawCircle(joint, 8, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
