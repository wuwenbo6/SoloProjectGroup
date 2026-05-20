import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class OrderCacheHelper {
  static const String _pendingOrdersKey = 'pending_orders';
  static const String _failedOrdersKey = 'failed_orders';
  
  static Future<void> savePendingOrder(Map<String, dynamic> orderData) async {
    final prefs = await SharedPreferences.getInstance();
    final orderId = orderData['orderId'] ?? DateTime.now().millisecondsSinceEpoch.toString();
    orderData['cacheTime'] = DateTime.now().toIso8601String();
    orderData['retryCount'] = 0;
    
    List<String> pendingOrders = prefs.getStringList(_pendingOrdersKey) ?? [];
    pendingOrders.add(jsonEncode(orderData));
    await prefs.setStringList(_pendingOrdersKey, pendingOrders);
  }
  
  static Future<List<Map<String, dynamic>>> getPendingOrders() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> pendingOrders = prefs.getStringList(_pendingOrdersKey) ?? [];
    return pendingOrders.map((e) => jsonDecode(e) as Map<String, dynamic>).toList();
  }
  
  static Future<void> removePendingOrder(String orderId) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> pendingOrders = prefs.getStringList(_pendingOrdersKey) ?? [];
    pendingOrders.removeWhere((e) {
      final order = jsonDecode(e);
      return order['orderId'] == orderId;
    });
    await prefs.setStringList(_pendingOrdersKey, pendingOrders);
  }
  
  static Future<void> saveFailedOrder(Map<String, dynamic> orderData, String error) async {
    final prefs = await SharedPreferences.getInstance();
    orderData['error'] = error;
    orderData['failTime'] = DateTime.now().toIso8601String();
    
    List<String> failedOrders = prefs.getStringList(_failedOrdersKey) ?? [];
    failedOrders.add(jsonEncode(orderData));
    await prefs.setStringList(_failedOrdersKey, failedOrders);
  }
  
  static Future<List<Map<String, dynamic>>> getFailedOrders() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> failedOrders = prefs.getStringList(_failedOrdersKey) ?? [];
    return failedOrders.map((e) => jsonDecode(e) as Map<String, dynamic>).toList();
  }
  
  static Future<void> incrementRetryCount(String orderId) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> pendingOrders = prefs.getStringList(_pendingOrdersKey) ?? [];
    
    for (int i = 0; i < pendingOrders.length; i++) {
      final order = jsonDecode(pendingOrders[i]);
      if (order['orderId'] == orderId) {
        order['retryCount'] = (order['retryCount'] ?? 0) + 1;
        pendingOrders[i] = jsonEncode(order);
        break;
      }
    }
    await prefs.setStringList(_pendingOrdersKey, pendingOrders);
  }
  
  static Future<void> clearExpiredOrders() async {
    final prefs = await SharedPreferences.getInstance();
    final now = DateTime.now();
    
    List<String> pendingOrders = prefs.getStringList(_pendingOrdersKey) ?? [];
    pendingOrders.removeWhere((e) {
      final order = jsonDecode(e);
      final cacheTime = DateTime.tryParse(order['cacheTime'] ?? '') ?? now;
      return now.difference(cacheTime).inHours > 24;
    });
    await prefs.setStringList(_pendingOrdersKey, pendingOrders);
  }
}
