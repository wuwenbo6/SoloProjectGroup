class RoomMessage {
  final String type;
  final String roomId;
  final int? senderId;
  final String? senderName;
  final String content;
  final DateTime? timestamp;
  final dynamic data;

  RoomMessage({
    required this.type,
    required this.roomId,
    this.senderId,
    this.senderName,
    required this.content,
    this.timestamp,
    this.data,
  });

  factory RoomMessage.fromJson(Map<String, dynamic> json) => RoomMessage(
        type: json['type'] ?? 'UNKNOWN',
        roomId: json['roomId'] ?? '',
        senderId: json['senderId'],
        senderName: json['senderName'],
        content: json['content'] ?? '',
        timestamp: json['timestamp'] != null
            ? DateTime.tryParse(json['timestamp'])
            : null,
        data: json['data'],
      );

  bool get isCoachCommand => type == 'COACH_COMMAND';
  bool get isUserJoin => type == 'USER_JOIN';
  bool get isUserLeave => type == 'USER_LEAVE';
}
