import 'dart:async';
import 'package:dio/dio.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'order_cache_helper.dart';

class RetryHttpClient {
  final Dio _dio;
  final int maxRetries;
  final Duration retryDelay;
  
  RetryHttpClient({Dio? dio, this.maxRetries = 3, this.retryDelay = const Duration(seconds: 2)})
      : _dio = dio ?? Dio();
  
  Future<Response<T>> postWithRetry<T>(
    String url, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
    Function(int retryCount)? onRetry,
  }) async {
    int retryCount = 0;
    
    while (true) {
      try {
        final connectivityResult = await Connectivity().checkConnectivity();
        if (connectivityResult == ConnectivityResult.none) {
          throw DioException(
            requestOptions: RequestOptions(path: url),
            error: '网络连接不可用，请检查网络设置',
            type: DioExceptionType.connectionError,
          );
        }
        
        final response = await _dio.post<T>(
          url,
          data: data,
          queryParameters: queryParameters,
          options: options,
          cancelToken: cancelToken,
          onSendProgress: onSendProgress,
          onReceiveProgress: onReceiveProgress,
        );
        
        return response;
      } catch (e) {
        if (retryCount >= maxRetries) {
          rethrow;
        }
        
        if (_isRetryableError(e)) {
          retryCount++;
          onRetry?.call(retryCount);
          await Future.delayed(retryDelay * retryCount);
          continue;
        }
        
        rethrow;
      }
    }
  }
  
  Future<Response<T>> submitOrderWithCache<T>(
    String url, {
    required Map<String, dynamic> orderData,
    Options? options,
    Function(int retryCount)? onRetry,
  }) async {
    final orderId = OrderValidator.generateOrderNo();
    orderData['orderId'] = orderId;
    
    await OrderCacheHelper.savePendingOrder(orderData);
    
    try {
      final response = await postWithRetry<T>(
        url,
        data: orderData,
        options: options,
        onRetry: onRetry,
      );
      
      await OrderCacheHelper.removePendingOrder(orderId);
      return response;
    } catch (e) {
      await OrderCacheHelper.incrementRetryCount(orderId);
      await OrderCacheHelper.saveFailedOrder(orderData, e.toString());
      rethrow;
    }
  }
  
  Future<void> retryPendingOrders(String submitUrl) async {
    final pendingOrders = await OrderCacheHelper.getPendingOrders();
    
    for (final order in pendingOrders) {
      final retryCount = order['retryCount'] ?? 0;
      if (retryCount < maxRetries) {
        try {
          await postWithRetry(
            submitUrl,
            data: order,
            onRetry: (count) async {
              await OrderCacheHelper.incrementRetryCount(order['orderId']);
            },
          );
          await OrderCacheHelper.removePendingOrder(order['orderId']);
        } catch (e) {
          await OrderCacheHelper.saveFailedOrder(order, e.toString());
        }
      }
    }
  }
  
  bool _isRetryableError(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.connectionError:
          return true;
        case DioExceptionType.badResponse:
          final statusCode = error.response?.statusCode;
          return statusCode == 500 || statusCode == 502 || statusCode == 503 || statusCode == 504;
        default:
          return false;
      }
    }
    return false;
  }
  
  void setBaseUrl(String baseUrl) {
    _dio.options.baseUrl = baseUrl;
  }
  
  void setHeaders(Map<String, dynamic> headers) {
    _dio.options.headers.addAll(headers);
  }
}
