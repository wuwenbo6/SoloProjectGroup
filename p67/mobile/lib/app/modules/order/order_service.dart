import 'package:get/get.dart';
import '../../core/utils/order_validator.dart';
import '../../core/utils/retry_http_client.dart';
import '../../core/utils/order_cache_helper.dart';

class OrderService extends GetxService {
  final RetryHttpClient _httpClient = RetryHttpClient();
  final String baseUrl = 'http://localhost:9000/api/order';
  
  final RxList<Map<String, dynamic>> pendingOrders = <Map<String, dynamic>>[].obs;
  final RxList<Map<String, dynamic>> failedOrders = <Map<String, dynamic>>[].obs;
  
  @override
  void onInit() {
    super.onInit();
    _httpClient.setBaseUrl(baseUrl);
    loadCachedOrders();
  }
  
  Future<void> loadCachedOrders() async {
    pendingOrders.value = await OrderCacheHelper.getPendingOrders();
    failedOrders.value = await OrderCacheHelper.getFailedOrders();
  }
  
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> orderData) async {
    final validation = OrderValidator.validateOrderData(orderData);
    if (!validation.isValid) {
      throw Exception(validation.errorMessage);
    }
    
    try {
      final response = await _httpClient.submitOrderWithCache<Map<String, dynamic>>(
        '/create',
        orderData: orderData,
        onRetry: (retryCount) {
          print('订单提交重试中... 第$retryCount次');
        },
      );
      
      await loadCachedOrders();
      return response.data ?? {};
    } catch (e) {
      await loadCachedOrders();
      rethrow;
    }
  }
  
  Future<List<dynamic>> getUserOrders(int userId) async {
    try {
      final response = await _httpClient.postWithRetry(
        '/user/$userId',
      );
      return response.data ?? [];
    } catch (e) {
      print('获取订单列表失败: $e');
      rethrow;
    }
  }
  
  Future<bool> cancelOrder(String orderNo) async {
    try {
      final response = await _httpClient.postWithRetry(
        '/cancel/$orderNo',
      );
      return response.data ?? false;
    } catch (e) {
      print('取消订单失败: $e');
      rethrow;
    }
  }
  
  Future<bool> payOrder(String orderNo, String paymentMethod, double amount) async {
    final paymentData = {
      'orderNo': orderNo,
      'paymentMethod': paymentMethod,
      'amount': amount,
    };
    
    final validation = OrderValidator.validatePaymentData(paymentData);
    if (!validation.isValid) {
      throw Exception(validation.errorMessage);
    }
    
    try {
      final response = await _httpClient.postWithRetry(
        '/pay/$orderNo',
        queryParameters: {'paymentMethod': paymentMethod},
      );
      return response.data ?? false;
    } catch (e) {
      print('支付失败: $e');
      rethrow;
    }
  }
  
  Future<void> retryAllPendingOrders() async {
    await _httpClient.retryPendingOrders('$baseUrl/create');
    await loadCachedOrders();
  }
  
  Future<void> retryFailedOrder(Map<String, dynamic> order) async {
    try {
      final response = await _httpClient.postWithRetry(
        '/create',
        data: order,
      );
      if (response.statusCode == 200) {
        await OrderCacheHelper.removePendingOrder(order['orderId']);
        await loadCachedOrders();
      }
    } catch (e) {
      print('重试失败订单失败: $e');
      rethrow;
    }
  }
  
  Future<void> clearExpiredOrders() async {
    await OrderCacheHelper.clearExpiredOrders();
    await loadCachedOrders();
  }
}
