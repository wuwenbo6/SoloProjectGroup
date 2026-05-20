class ExerciseTemplate {
  final int id;
  final String name;
  final String description;
  final String exerciseType;
  final int difficultyLevel;

  ExerciseTemplate({
    required this.id,
    required this.name,
    required this.description,
    required this.exerciseType,
    required this.difficultyLevel,
  });

  factory ExerciseTemplate.fromJson(Map<String, dynamic> json) => ExerciseTemplate(
        id: json['id'],
        name: json['name'],
        description: json['description'],
        exerciseType: json['exerciseType'],
        difficultyLevel: json['difficultyLevel'],
      );
}
