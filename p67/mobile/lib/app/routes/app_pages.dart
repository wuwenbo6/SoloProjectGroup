import 'package:get/get.dart';
import '../modules/home/home_binding.dart';
import '../modules/home/home_view.dart';
import '../modules/activity/activity_binding.dart';
import '../modules/activity/activity_view.dart';
import '../modules/order/order_binding.dart';
import '../modules/order/order_view.dart';
import '../modules/video/video_binding.dart';
import '../modules/video/video_view.dart';
import '../modules/profile/profile_binding.dart';
import '../modules/profile/profile_view.dart';

class AppPages {
  AppPages._();

  static const INITIAL = Routes.HOME;

  static final routes = [
    GetPage(
      name: _Paths.HOME,
      page: () => const HomeView(),
      binding: HomeBinding(),
    ),
    GetPage(
      name: _Paths.ACTIVITY,
      page: () => const ActivityView(),
      binding: ActivityBinding(),
    ),
    GetPage(
      name: _Paths.ORDER,
      page: () => const OrderView(),
      binding: OrderBinding(),
    ),
    GetPage(
      name: _Paths.VIDEO,
      page: () => const VideoView(),
      binding: VideoBinding(),
    ),
    GetPage(
      name: _Paths.PROFILE,
      page: () => const ProfileView(),
      binding: ProfileBinding(),
    ),
  ];
}

abstract class Routes {
  Routes._();
  static const HOME = _Paths.HOME;
  static const ACTIVITY = _Paths.ACTIVITY;
  static const ORDER = _Paths.ORDER;
  static const VIDEO = _Paths.VIDEO;
  static const PROFILE = _Paths.PROFILE;
}

abstract class _Paths {
  _Paths._();
  static const HOME = '/home';
  static const ACTIVITY = '/activity';
  static const ORDER = '/order';
  static const VIDEO = '/video';
  static const PROFILE = '/profile';
}
