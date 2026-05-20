class VideoTask {
  final String taskId;
  final String status;
  final String statusDescription;
  final int progress;
  final String originalFilename;
  final int fileSize;
  final String? exerciseName;
  final double? averageAccuracy;
  final int? repsCount;
  final String? suggestions;
  final String? errorMessage;
  final DateTime? createdAt;
  final DateTime? completedAt;
  final int? processingTimeMs;

  VideoTask({
    required this.taskId,
    required this.status,
    required this.statusDescription,
    required this.progress,
    required this.originalFilename,
    required this.fileSize,
    this.exerciseName,
    this.averageAccuracy,
    this.repsCount,
    this.suggestions,
    this.errorMessage,
    this.createdAt,
    this.completedAt,
    this.processingTimeMs,
  });

  factory VideoTask.fromJson(Map<String, dynamic> json) => VideoTask(
        taskId: json['taskId'] as String,
        status: json['status'] as String,
        statusDescription: json['statusDescription'] as String,
        progress: json['progress'] as int? ?? 0,
        originalFilename: json['originalFilename'] as String? ?? '',
        fileSize: json['fileSize'] as int? ?? 0,
        exerciseName: json['exerciseName'] as String?,
        averageAccuracy: (json['averageAccuracy'] as num?)?.toDouble(),
        repsCount: json['repsCount'] as int?,
        suggestions: json['suggestions'] as String?,
        errorMessage: json['errorMessage'] as String?,
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'] as String)
            : null,
        completedAt: json['completedAt'] != null
            ? DateTime.tryParse(json['completedAt'] as String)
            : null,
        processingTimeMs: json['processingTimeMs'] as int?,
      );

  bool get isCompleted => status == 'COMPLETED';
  bool get isProcessing =>
      status == 'PROCESSING' ||
      status == 'FRAME_EXTRACTION' ||
      status == 'POSE_ESTIMATION' ||
      status == 'DTW_ANALYSIS';
  bool get isFailed => status == 'FAILED';
  bool get isCancelled => status == 'CANCELLED';

  List<String> get suggestionList =>
      suggestions?.split('|').where((s) => s.isNotEmpty).toList() ?? [];
}
