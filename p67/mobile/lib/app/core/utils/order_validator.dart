class OrderValidator {
  static ValidationResult validateOrderData(Map<String, dynamic> data) {
    final errors = <String>[];
    
    if (data['userId'] == null || data['userId'].toString().isEmpty) {
      errors.add('用户ID不能为空');
    }
    
    if (data['activityId'] == null || data['activityId'].toString().isEmpty) {
      errors.add('活动ID不能为空');
    }
    
    if (data['userName'] == null || data['userName'].toString().trim().isEmpty) {
      errors.add('用户姓名不能为空');
    }
    
    if (data['userPhone'] == null || !_isValidPhone(data['userPhone'].toString())) {
      errors.add('请输入有效的手机号码');
    }
    
    if (data['quantity'] == null || data['quantity'] < 1) {
      errors.add('报名人数至少为1人');
    }
    
    if (data['unitPrice'] == null || data['unitPrice'] < 0) {
      errors.add('单价不能为负数');
    }
    
    final requiredFields = ['activityName', 'activityTime', 'activityLocation'];
    for (final field in requiredFields) {
      if (data[field] == null || data[field].toString().trim().isEmpty) {
        errors.add('$field不能为空');
      }
    }
    
    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }
  
  static bool _isValidPhone(String phone) {
    if (phone.length != 11) return false;
    final regex = RegExp(r'^1[3-9]\d{9}$');
    return regex.hasMatch(phone);
  }
  
  static ValidationResult validatePaymentData(Map<String, dynamic> data) {
    final errors = <String>[];
    
    if (data['orderNo'] == null || data['orderNo'].toString().isEmpty) {
      errors.add('订单号不能为空');
    }
    
    if (data['amount'] == null || data['amount'] <= 0) {
      errors.add('支付金额必须大于0');
    }
    
    if (data['paymentMethod'] == null || data['paymentMethod'].toString().isEmpty) {
      errors.add('支付方式不能为空');
    }
    
    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }
  
  static String generateOrderNo() {
    final now = DateTime.now();
    final timestamp = now.millisecondsSinceEpoch;
    final random = now.microsecond.toString().padLeft(6, '0');
    return 'ORD$timestamp$random';
  }
}

class ValidationResult {
  final bool isValid;
  final List<String> errors;
  
  ValidationResult({required this.isValid, required this.errors});
  
  String get errorMessage => errors.join('\n');
}
