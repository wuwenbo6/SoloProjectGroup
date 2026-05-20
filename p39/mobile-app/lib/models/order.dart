class Order {
  final String? id;
  final String? orderNo;
  final String? userId;
  final String? artisanId;
  final String? requirementId;
  final String title;
  final String? description;
  final double amount;
  final int? status;
  final int? progress;
  final DateTime? estimatedDelivery;
  final DateTime? actualDelivery;
  final DateTime? createTime;
  final DateTime? updateTime;

  Order({
    this.id,
    this.orderNo,
    this.userId,
    this.artisanId,
    this.requirementId,
    required this.title,
    this.description,
    required this.amount,
    this.status,
    this.progress,
    this.estimatedDelivery,
    this.actualDelivery,
    this.createTime,
    this.updateTime,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id']?.toString(),
      orderNo: json['orderNo'] as String?,
      userId: json['userId']?.toString(),
      artisanId: json['artisanId']?.toString(),
      requirementId: json['requirementId']?.toString(),
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as int?,
      progress: json['progress'] as int?,
      estimatedDelivery: json['estimatedDelivery'] != null
          ? DateTime.tryParse(json['estimatedDelivery'] as String)
          : null,
      actualDelivery: json['actualDelivery'] != null
          ? DateTime.tryParse(json['actualDelivery'] as String)
          : null,
      createTime: json['createTime'] != null
          ? DateTime.tryParse(json['createTime'] as String)
          : null,
      updateTime: json['updateTime'] != null
          ? DateTime.tryParse(json['updateTime'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (orderNo != null) 'orderNo': orderNo,
      if (userId != null) 'userId': userId,
      if (artisanId != null) 'artisanId': artisanId,
      if (requirementId != null) 'requirementId': requirementId,
      'title': title,
      if (description != null) 'description': description,
      'amount': amount,
      if (status != null) 'status': status,
      if (progress != null) 'progress': progress,
      if (estimatedDelivery != null)
        'estimatedDelivery': estimatedDelivery!.toIso8601String(),
      if (actualDelivery != null)
        'actualDelivery': actualDelivery!.toIso8601String(),
    };
  }

  Order copyWith({
    String? id,
    String? orderNo,
    String? userId,
    String? artisanId,
    String? requirementId,
    String? title,
    String? description,
    double? amount,
    int? status,
    int? progress,
    DateTime? estimatedDelivery,
    DateTime? actualDelivery,
    DateTime? createTime,
    DateTime? updateTime,
  }) {
    return Order(
      id: id ?? this.id,
      orderNo: orderNo ?? this.orderNo,
      userId: userId ?? this.userId,
      artisanId: artisanId ?? this.artisanId,
      requirementId: requirementId ?? this.requirementId,
      title: title ?? this.title,
      description: description ?? this.description,
      amount: amount ?? this.amount,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      estimatedDelivery: estimatedDelivery ?? this.estimatedDelivery,
      actualDelivery: actualDelivery ?? this.actualDelivery,
      createTime: createTime ?? this.createTime,
      updateTime: updateTime ?? this.updateTime,
    );
  }
}

class Requirement {
  final String? id;
  final String? userId;
  final String title;
  final String description;
  final String craftType;
  final double? budgetMin;
  final double? budgetMax;
  final DateTime? deadline;
  final List<String>? images;
  final int? status;
  final String? selectedArtisanId;
  final int? viewCount;
  final DateTime? createTime;

  Requirement({
    this.id,
    this.userId,
    required this.title,
    required this.description,
    required this.craftType,
    this.budgetMin,
    this.budgetMax,
    this.deadline,
    this.images,
    this.status,
    this.selectedArtisanId,
    this.viewCount,
    this.createTime,
  });

  factory Requirement.fromJson(Map<String, dynamic> json) {
    return Requirement(
      id: json['id']?.toString(),
      userId: json['userId']?.toString(),
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      craftType: json['craftType'] as String? ?? '',
      budgetMin: (json['budgetMin'] as num?)?.toDouble(),
      budgetMax: (json['budgetMax'] as num?)?.toDouble(),
      deadline: json['deadline'] != null
          ? DateTime.tryParse(json['deadline'] as String)
          : null,
      images: json['images'] != null
          ? List<String>.from(json['images'] as List)
          : null,
      status: json['status'] as int?,
      selectedArtisanId: json['selectedArtisanId']?.toString(),
      viewCount: json['viewCount'] as int?,
      createTime: json['createTime'] != null
          ? DateTime.tryParse(json['createTime'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (userId != null) 'userId': userId,
      'title': title,
      'description': description,
      'craftType': craftType,
      if (budgetMin != null) 'budgetMin': budgetMin,
      if (budgetMax != null) 'budgetMax': budgetMax,
      if (deadline != null) 'deadline': deadline!.toIso8601String(),
      if (images != null) 'images': images,
      if (status != null) 'status': status,
      if (selectedArtisanId != null) 'selectedArtisanId': selectedArtisanId,
    };
  }
}
