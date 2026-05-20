class Feedback {
  final String type;
  final String message;
  final String? voiceText;
  final double accuracy;
  final int repsCount;
  final List<String> corrections;
  final int timestamp;

  Feedback({
    required this.type,
    required this.message,
    this.voiceText,
    required this.accuracy,
    required this.repsCount,
    required this.corrections,
    required this.timestamp,
  });

  factory Feedback.fromJson(Map<String, dynamic> json) => Feedback(
        type: json['type'],
        message: json['message'],
        voiceText: json['voiceText'],
        accuracy: (json['accuracy'] as num).toDouble(),
        repsCount: json['repsCount'],
        corrections: List<String>.from(json['corrections'] ?? []),
        timestamp: json['timestamp'],
      );
}
