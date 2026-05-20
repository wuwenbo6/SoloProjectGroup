import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/order.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:9000/api';
  static const Duration timeout = Duration(seconds: 30);

  final Map<String, String> headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
  };

  static final ApiService instance = ApiService._internal();
  factory ApiService() => instance;
  ApiService._internal();

  Future<Map<String, dynamic>> submitRequirement(Requirement requirement) async {
    try {
      final body = json.encode(requirement.toJson());
      
      final response = await http
          .post(
            Uri.parse('$baseUrl/requirement/requirement'),
            headers: headers,
            body: body,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        if (result['code'] == 200) {
          return {
            'success': true,
            'data': result['data'],
            'message': result['message'] ?? '提交成功',
          };
        } else {
          return {
            'success': false,
            'message': result['message'] ?? '提交失败',
          };
        }
      } else {
        return {
          'success': false,
          'message': '网络请求失败，状态码: ${response.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': '提交失败: ${e.toString()}',
      };
    }
  }

  Future<List<Order>> getUserOrders(String userId, {int page = 1, int size = 10}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$baseUrl/order/order/user/$userId?page=$page&size=$size'),
            headers: headers,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        if (result['code'] == 200 && result['data'] != null) {
          final List<dynamic> records = result['data']['records'] ?? [];
          return records.map((json) => Order.fromJson(json)).toList();
        }
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }

  Future<Order?> getOrderDetail(String orderId) async {
    try {
      final response = await http
          .get(
            Uri.parse('$baseUrl/order/order/$orderId'),
            headers: headers,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        if (result['code'] == 200 && result['data'] != null) {
          return Order.fromJson(result['data']);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> updateOrderProgress(String orderId, int progress) async {
    try {
      final response = await http
          .put(
            Uri.parse('$baseUrl/order/order/$orderId/progress?progress=$progress'),
            headers: headers,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        return result['code'] == 200;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>> submitOrder(Order order) async {
    try {
      final body = json.encode(order.toJson());
      
      final response = await http
          .post(
            Uri.parse('$baseUrl/order/order'),
            headers: headers,
            body: body,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        if (result['code'] == 200) {
          return {
            'success': true,
            'data': result['data'],
            'message': result['message'] ?? '订单创建成功',
          };
        } else {
          return {
            'success': false,
            'message': result['message'] ?? '创建订单失败',
          };
        }
      } else {
        return {
          'success': false,
          'message': '网络请求失败，状态码: ${response.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': '创建订单失败: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> processPayment(String orderId, String paymentMethod) async {
    try {
      final body = json.encode({
        'orderId': orderId,
        'paymentMethod': paymentMethod,
      });

      final response = await http
          .post(
            Uri.parse('$baseUrl/payment/payment/process'),
            headers: headers,
            body: body,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        if (result['code'] == 200) {
          return {
            'success': true,
            'data': result['data'],
            'message': result['message'] ?? '支付成功',
          };
        } else {
          return {
            'success': false,
            'message': result['message'] ?? '支付失败',
          };
        }
      } else {
        return {
          'success': false,
          'message': '网络请求失败，状态码: ${response.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': '支付失败: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> verifyArtisan(String artisanId, int status, String reason) async {
    try {
      final body = json.encode({
        'artisanId': artisanId,
        'status': status,
        'reason': reason,
      });

      final response = await http
          .post(
            Uri.parse('$baseUrl/artisan/artisan/verify'),
            headers: headers,
            body: body,
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final result = json.decode(utf8.decode(response.bodyBytes));
        if (result['code'] == 200) {
          return {
            'success': true,
            'message': result['message'] ?? '审核成功',
          };
        } else {
          return {
            'success': false,
            'message': result['message'] ?? '审核失败',
          };
        }
      } else {
        return {
          'success': false,
          'message': '网络请求失败，状态码: ${response.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': '审核失败: ${e.toString()}',
      };
    }
  }
}
