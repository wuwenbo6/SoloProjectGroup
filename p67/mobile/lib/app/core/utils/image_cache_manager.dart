import 'package:flutter_cache_manager/flutter_cache_manager.dart';

class CustomCacheManager extends CacheManager with ImageCacheManager {
  static const key = 'customCache';
  static const int cacheSize = 100;
  static const int cacheAge = 7;

  static CustomCacheManager? _instance;
  static CustomCacheManager get instance {
    _instance ??= CustomCacheManager._();
    return _instance!;
  }

  CustomCacheManager._() : super(Config(key, stalePeriod: const Duration(days: cacheAge), maxNrOfCacheObjects: cacheSize));
}
