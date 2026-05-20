import 'dart:io';
import 'package:dio/dio.dart';
import '../models/video_task.dart';

class VideoUploadService {
  final Dio _dio = Dio();
  final String baseUrl = 'http://localhost:8080/api';

  Future<VideoTask> uploadVideo(
    File videoFile,
    int userId,
    int exerciseTemplateId, {
    Function(int sent, int total)? onProgress,
  }) async {
    String fileName = videoFile.path.split('/').last;

    FormData formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        videoFile.path,
        filename: fileName,
      ),
      'userId': userId,
      'exerciseTemplateId': exerciseTemplateId,
    });

    final response = await _dio.post(
      '$baseUrl/video/upload',
      data: formData,
      onSendProgress: (sent, total) {
        if (onProgress != null && total > 0) {
          onProgress(sent, total);
        }
      },
    );

    return VideoTask.fromJson(response.data);
  }

  Future<VideoTask> getTaskStatus(String taskId) async {
    final response = await _dio.get('$baseUrl/video/task/$taskId');
    return VideoTask.fromJson(response.data);
  }

  Future<List<VideoTask>> getUserTasks(int userId) async {
    final response = await _dio.get('$baseUrl/video/tasks/user/$userId');
    return (response.data as List)
        .map((json) => VideoTask.fromJson(json))
        .toList();
  }

  Future<void> cancelTask(String taskId) async {
    await _dio.post('$baseUrl/video/task/$taskId/cancel');
  }

  Future<Map<String, dynamic>> getUserStats(int userId) async {
    final response = await _dio.get('$baseUrl/video/stats/user/$userId');
    return Map<String, dynamic>.from(response.data);
  }
}
