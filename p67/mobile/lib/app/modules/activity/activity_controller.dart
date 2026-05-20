import 'package:get/get.dart';

class ActivityController extends GetxController {
  final RxString selectedCategory = '全部'.obs;
  final RxBool isLoading = false.obs;

  final List<String> categories = ['全部', '节日', '竞技', '艺术', '表演', '音乐'];

  final List<Map<String, dynamic>> activities = [
    {'id': 1, 'title': '春节庙会', 'category': '节日', 'date': '2024-02-10', 'location': '北京地坛', 'price': 50, 'image': 'https://picsum.photos/400/250?random=51', 'status': '报名中', 'enrolled': 3856, 'capacity': 5000},
    {'id': 2, 'title': '龙舟竞渡', 'category': '竞技', 'date': '2024-06-10', 'location': '杭州西湖', 'price': 100, 'image': 'https://picsum.photos/400/250?random=52', 'status': '报名中', 'enrolled': 1200, 'capacity': 2000},
    {'id': 3, 'title': '中秋赏月', 'category': '节日', 'date': '2024-09-17', 'location': '南京秦淮河', 'price': 80, 'image': 'https://picsum.photos/400/250?random=53', 'status': '报名中', 'enrolled': 2100, 'capacity': 3000},
    {'id': 4, 'title': '剪纸艺术展', 'category': '艺术', 'date': '2024-03-15', 'location': '上海博物馆', 'price': 30, 'image': 'https://picsum.photos/400/250?random=54', 'status': '已结束', 'enrolled': 800, 'capacity': 1000},
    {'id': 5, 'title': '舞狮表演', 'category': '表演', 'date': '2024-05-01', 'location': '广州天河', 'price': 60, 'image': 'https://picsum.photos/400/250?random=55', 'status': '报名中', 'enrolled': 1500, 'capacity': 2500},
    {'id': 6, 'title': '古琴音乐会', 'category': '音乐', 'date': '2024-04-20', 'location': '成都武侯祠', 'price': 120, 'image': 'https://picsum.photos/400/250?random=56', 'status': '名额已满', 'enrolled': 500, 'capacity': 500},
  ];

  List<Map<String, dynamic>> get filteredActivities {
    if (selectedCategory.value == '全部') return activities;
    return activities.where((a) => a['category'] == selectedCategory.value).toList();
  }

  void selectCategory(String category) {
    selectedCategory.value = category;
  }
}
