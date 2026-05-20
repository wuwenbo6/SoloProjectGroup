import 'keypoint.dart';

class FrameData {
  final int timestamp;
  final int frameNumber;
  final List<Keypoint> keypoints;
  final String? sessionId;
  final int? userId;
  final int? exerciseTemplateId;

  FrameData({
    required this.timestamp,
    required this.frameNumber,
    required this.keypoints,
    this.sessionId,
    this.userId,
    this.exerciseTemplateId,
  });

  Map<String, dynamic> toJson() => {
        'timestamp': timestamp,
        'frameNumber': frameNumber,
        'keypoints': keypoints.map((k) => k.toJson()).toList(),
        'sessionId': sessionId,
        'userId': userId,
        'exerciseTemplateId': exerciseTemplateId,
      };
}
