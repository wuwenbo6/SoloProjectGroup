import 'package:get/get.dart';

class HomeController extends GetxController {
  final RxInt currentIndex = 0.obs;

  final List<Map<String, dynamic>> banners = [
    {'id': 1, 'title': '春节庙会', 'subtitle': '体验传统年味儿', 'image': 'https://picsum.photos/800/400?random=31'},
    {'id': 2, 'title': '龙舟竞渡', 'subtitle': '端午精彩活动', 'image': 'https://picsum.photos/800/400?random=32'},
    {'id': 3, 'title': '中秋赏月', 'subtitle': '阖家团圆佳节', 'image': 'https://picsum.photos/800/400?random=33'},
  ];

  final List<Map<String, dynamic>> categories = [
    {'id': 1, 'name': '全部', 'icon': '🎯'},
    {'id': 2, 'name': '节日', 'icon': '🎉'},
    {'id': 3, 'name': '竞技', 'icon': '🏆'},
    {'id': 4, 'name': '艺术', 'icon': '🎨'},
    {'id': 5, 'name': '表演', 'icon': '🎭'},
    {'id': 6, 'name': '音乐', 'icon': '🎵'},
  ];

  final List<Map<String, dynamic>> hotActivities = [
    {'id': 1, 'title': '春节庙会', 'date': '2024-02-10', 'location': '北京地坛', 'price': 50, 'image': 'https://picsum.photos/400/250?random=41', 'status': '报名中'},
    {'id': 2, 'title': '龙舟竞渡', 'date': '2024-06-10', 'location': '杭州西湖', 'price': 100, 'image': 'https://picsum.photos/400/250?random=42', 'status': '报名中'},
    {'id': 3, 'title': '中秋赏月', 'date': '2024-09-17', 'location': '南京秦淮河', 'price': 80, 'image': 'https://picsum.photos/400/250?random=43', 'status': '报名中'},
    {'id': 4, 'title': '舞狮表演', 'date': '2024-05-01', 'location': '广州天河', 'price': 60, 'image': 'https://picsum.photos/400/250?random=44', 'status': '报名中'},
  ];

  void changeTab(int index) {
    currentIndex.value = index;
  }
}
