import 'package:get/get.dart';

class VideoController extends GetxController {
  final List<Map<String, dynamic>> videos = [
    {'id': 1, 'title': '春节庙会精彩回顾', 'thumbnail': 'https://picsum.photos/400/225?random=61', 'duration': '12:35', 'views': '12.5万', 'author': '民俗文化频道'},
    {'id': 2, 'title': '龙舟竞渡比赛实况', 'thumbnail': 'https://picsum.photos/400/225?random=62', 'duration': '45:20', 'views': '8.3万', 'author': '体育竞技频道'},
    {'id': 3, 'title': '中秋赏月晚会全程', 'thumbnail': 'https://picsum.photos/400/225?random=63', 'duration': '01:30:00', 'views': '25.6万', 'author': '央视综艺'},
    {'id': 4, 'title': '舞狮表演教学', 'thumbnail': 'https://picsum.photos/400/225?random=64', 'duration': '18:45', 'views': '5.2万', 'author': '传统技艺教学'},
    {'id': 5, 'title': '古琴名曲欣赏', 'thumbnail': 'https://picsum.photos/400/225?random=65', 'duration': '25:10', 'views': '3.8万', 'author': '古典音乐堂'},
    {'id': 6, 'title': '剪纸艺术入门教程', 'thumbnail': 'https://picsum.photos/400/225?random=66', 'duration': '32:15', 'views': '2.1万', 'author': '手工艺教学'},
  ];
}
