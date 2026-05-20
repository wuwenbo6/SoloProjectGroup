class Keypoint {
  final String name;
  final double x;
  final double y;
  final double z;
  final double visibility;

  Keypoint({
    required this.name,
    required this.x,
    required this.y,
    required this.z,
    required this.visibility,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'x': x,
        'y': y,
        'z': z,
        'visibility': visibility,
      };

  factory Keypoint.fromJson(Map<String, dynamic> json) => Keypoint(
        name: json['name'],
        x: (json['x'] as num).toDouble(),
        y: (json['y'] as num).toDouble(),
        z: (json['z'] as num).toDouble(),
        visibility: (json['visibility'] as num).toDouble(),
      );
}
