import 'package:get/get.dart';

class OrderController extends GetxController {
  final RxInt selectedTab = 0.obs;

  final List<String> tabs = ['全部', '待支付', '已支付', '已取消'];

  final List<Map<String, dynamic>> orders = [
    {'id': 'ORD001', 'title': '春节庙会', 'date': '2024-02-10', 'location': '北京地坛', 'price': 100, 'quantity': 2, 'status': '已支付', 'createTime': '2024-01-15 10:30', 'image': 'https://picsum.photos/200/150?random=71'},
    {'id': 'ORD002', 'title': '龙舟竞渡', 'date': '2024-06-10', 'location': '杭州西湖', 'price': 200, 'quantity': 2, 'status': '待支付', 'createTime': '2024-01-15 11:20', 'image': 'https://picsum.photos/200/150?random=72'},
    {'id': 'ORD003', 'title': '中秋赏月', 'date': '2024-09-17', 'location': '南京秦淮河', 'price': 80, 'quantity': 1, 'status': '已取消', 'createTime': '2024-01-14 09:15', 'image': 'https://picsum.photos/200/150?random=73'},
    {'id': 'ORD004', 'title': '舞狮表演', 'date': '2024-05-01', 'location': '广州天河', 'price': 120, 'quantity': 2, 'status': '已支付', 'createTime': '2024-01-14 14:45', 'image': 'https://picsum.photos/200/150?random=74'},
  ];

  List<Map<String, dynamic>> get filteredOrders {
    if (selectedTab.value == 0) return orders;
    String status = tabs[selectedTab.value];
    return orders.where((o) => o['status'] == status).toList();
  }

  Color getStatusColor(String status) {
    switch (status) {
      case '已支付': return Colors.green;
      case '待支付': return Colors.orange;
      case '已取消': return Colors.grey;
      default: return Colors.blue;
    }
  }
}
