import 'package:flutter/material.dart';
import 'create_requirement_page.dart';
import '../models/order.dart';
import '../services/api_service.dart';

class OrderPage extends StatefulWidget {
  const OrderPage({super.key});

  @override
  State<OrderPage> createState() => _OrderPageState();
}

class _OrderPageState extends State<OrderPage>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  late TabController _tabController;
  List<Order> _orders = [];
  bool _isLoading = true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadOrders();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final orders = await ApiService().getUserOrders('10001');
      setState(() {
        _orders = orders;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _navigateToCreateRequirement() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const CreateRequirementPage(),
      ),
    );
    if (result == true) {
      _loadOrders();
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('我的订单'),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _loadOrders,
            ),
          ],
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: '全部'),
              Tab(text: '待支付'),
              Tab(text: '进行中'),
              Tab(text: '待确认'),
              Tab(text: '已完成'),
            ],
          ),
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _buildOrderList(context, null),
                  _buildOrderList(context, 1),
                  _buildOrderList(context, 3),
                  _buildOrderList(context, 4),
                  _buildOrderList(context, 5),
                ],
              ),
        floatingActionButton: FloatingActionButton(
          onPressed: _navigateToCreateRequirement,
          child: const Icon(Icons.add),
        ),
      ),
    );
  }

  Widget _buildOrderList(BuildContext context, int? statusFilter) {
    final filteredOrders = _orders.where((order) {
      if (statusFilter == null) return true;
      return order.status == statusFilter;
    }).toList();

    if (filteredOrders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              '暂无订单',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: filteredOrders.length,
      itemBuilder: (context, index) {
        final order = filteredOrders[index];
        return _buildOrderCard(context, order);
      },
    );
  }

  Widget _buildOrderCard(BuildContext context, Order order) {
    String statusText;
    Color statusColor;
    switch (order.status) {
      case 1:
        statusText = '待支付';
        statusColor = Colors.amber;
        break;
      case 2:
        statusText = '已支付';
        statusColor = Colors.blue;
        break;
      case 3:
        statusText = '制作中';
        statusColor = Theme.of(context).colorScheme.primary;
        break;
      case 4:
        statusText = '待确认';
        statusColor = Colors.orange;
        break;
      case 5:
        statusText = '已完成';
        statusColor = Colors.green;
        break;
      default:
        statusText = '未知';
        statusColor = Colors.grey;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    order.title,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(color: statusColor, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('订单号: ${order.orderNo ?? '-'}',
                style: TextStyle(color: Colors.grey.shade600)),
            Text(
                '下单时间: ${order.createTime != null ? '${order.createTime!.year}-${order.createTime!.month.toString().padLeft(2, '0')}-${order.createTime!.day.toString().padLeft(2, '0')}' : '-'}',
                style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 12),
            if (order.status == 3 && order.progress != null) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('制作进度'),
                  Text('${order.progress}%',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 4),
              LinearProgressIndicator(value: order.progress! / 100),
              const SizedBox(height: 12),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '¥${order.amount.toStringAsFixed(2)}',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: () {},
                      child: const Text('联系匠人'),
                    ),
                    const SizedBox(width: 8),
                    if (order.status == 1)
                      ElevatedButton(
                        onPressed: () => _handlePayment(order),
                        child: const Text('支付'),
                      ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handlePayment(Order order) async {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('确认支付'),
        content: Text('您确定要支付 ¥${order.amount.toStringAsFixed(2)} 吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              _processPayment(order);
            },
            child: const Text('确认支付'),
          ),
        ],
      ),
    );
  }

  Future<void> _processPayment(Order order) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(),
      ),
    );

    final result = await ApiService().processPayment(order.id ?? '', 'ALIPAY');

    if (mounted) {
      Navigator.pop(context);
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('支付成功'), backgroundColor: Colors.green),
        );
        _loadOrders();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? '支付失败'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
