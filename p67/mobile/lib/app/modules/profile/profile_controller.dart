import 'package:get/get.dart';

class ProfileController extends GetxController {
  final Map<String, dynamic> user = {
    'name': '张三',
    'phone': '138****1234',
    'avatar': 'https://picsum.photos/100/100?random=80',
    'level': 'VIP会员',
    'points': 2580,
    'coupons': 5,
    'orders': 12,
  };

  final List<Map<String, dynamic>> menuItems = [
    {'icon': Icons.receipt, 'title': '我的订单', 'subtitle': '查看全部订单'},
    {'icon': Icons.card_giftcard, 'title': '优惠券', 'subtitle': '5张可用'},
    {'icon': Icons.stars, 'title': '我的积分', 'subtitle': '2580积分'},
    {'icon': Icons.favorite, 'title': '我的收藏', 'subtitle': '已收藏12项'},
    {'icon': Icons.history, 'title': '浏览历史', 'subtitle': '最近浏览记录'},
    {'icon': Icons.location_on, 'title': '收货地址', 'subtitle': '管理收货地址'},
    {'icon': Icons.headset_mic, 'title': '客服中心', 'subtitle': '在线客服支持'},
    {'icon': Icons.settings, 'title': '设置', 'subtitle': '账号与安全设置'},
  ];
}
