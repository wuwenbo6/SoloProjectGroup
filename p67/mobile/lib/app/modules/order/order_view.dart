import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:cached_network_image/cached_network_image.dart';
import './order_controller.dart';

class OrderView extends GetView<OrderController> {
  const OrderView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF8DC),
      appBar: AppBar(
        title: const Text('我的订单', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFFC41E3A),
        elevation: 0,
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            child: Obx(() => TabBar(
              controller: TabController(length: 4, vsync: Navigator.of(context)),
              isScrollable: true,
              labelColor: const Color(0xFFC41E3A),
              unselectedLabelColor: Colors.grey,
              indicatorColor: const Color(0xFFC41E3A),
              tabs: controller.tabs.map((tab) => Tab(text: tab)).toList(),
            )),
          ),
          Expanded(
            child: Obx(() => ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: controller.filteredOrders.length,
              itemBuilder: (context, index) {
                final order = controller.filteredOrders[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8)],
                  ),
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('订单号: ${order['id']}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                            Text(order['createTime'], style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                          ],
                        ),
                      ),
                      const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: CachedNetworkImage(
                                imageUrl: order['image'],
                                width: 80,
                                height: 60,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(order['title'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF8B4513))),
                                  const SizedBox(height: 4),
                                  Text('📅 ${order['date']}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                  const SizedBox(height: 4),
                                  Text('📍 ${order['location']}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('共${order['quantity']}件', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                const SizedBox(height: 4),
                                Text.rich(
                                  TextSpan(
                                    children: [
                                      const TextSpan(text: '合计: ', style: TextStyle(color: Color(0xFF8B4513))),
                                      TextSpan(text: '¥${order['price']}', style: const TextStyle(color: Color(0xFFC41E3A), fontSize: 18, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: controller.getStatusColor(order['status']).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(order['status'], style: TextStyle(color: controller.getStatusColor(order['status']), fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                                if (order['status'] == '待支付') ...[
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: () {},
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFC41E3A),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                    ),
                                    child: const Text('去支付', style: TextStyle(fontSize: 12)),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            )),
          ),
        ],
      ),
    );
  }
}
