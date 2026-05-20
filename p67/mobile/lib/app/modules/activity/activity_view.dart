import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:cached_network_image/cached_network_image.dart';
import './activity_controller.dart';

class ActivityView extends GetView<ActivityController> {
  const ActivityView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF8DC),
      appBar: AppBar(
        title: const Text('民俗活动', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFFC41E3A),
        elevation: 0,
      ),
      body: Column(
        children: [
          Container(
            height: 50,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Obx(() => ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: controller.categories.length,
              itemBuilder: (context, index) {
                final category = controller.categories[index];
                final isSelected = controller.selectedCategory.value == category;
                return GestureDetector(
                  onTap: () => controller.selectCategory(category),
                  child: Container(
                    margin: const EdgeInsets.only(right: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFC41E3A) : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)],
                    ),
                    child: Text(category, style: TextStyle(color: isSelected ? Colors.white : const Color(0xFF8B4513), fontWeight: FontWeight.bold)),
                  ),
                );
              },
            )),
          ),
          Expanded(
            child: Obx(() => ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: controller.filteredActivities.length,
              itemBuilder: (context, index) {
                final activity = controller.filteredActivities[index];
                return GestureDetector(
                  onTap: () {},
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8)],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                              child: CachedNetworkImage(
                                imageUrl: activity['image'],
                                height: 180,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              top: 12,
                              right: 12,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: activity['status'] == '报名中' ? Colors.green : activity['status'] == '已结束' ? Colors.grey : Colors.orange,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(activity['status'], style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(activity['title'], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF8B4513))),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
                                  const SizedBox(width: 4),
                                  Text(activity['date'], style: TextStyle(color: Colors.grey[600], fontSize: 14)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(Icons.location_on, size: 16, color: Colors.grey[600]),
                                  const SizedBox(width: 4),
                                  Text(activity['location'], style: TextStyle(color: Colors.grey[600], fontSize: 14)),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text.rich(
                                        TextSpan(
                                          children: [
                                            const TextSpan(text: '¥', style: TextStyle(color: Color(0xFFC41E3A), fontSize: 14)),
                                            TextSpan(text: '${activity['price']}', style: const TextStyle(color: Color(0xFFC41E3A), fontSize: 24, fontWeight: FontWeight.bold)),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      SizedBox(
                                        width: 120,
                                        child: LinearProgressIndicator(
                                          value: activity['enrolled'] / activity['capacity'],
                                          backgroundColor: Colors.grey[200],
                                          valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFD4AF37)),
                                        ),
                                      ),
                                      Text('${activity['enrolled']}/${activity['capacity']} 人已报名', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                                    ],
                                  ),
                                  ElevatedButton(
                                    onPressed: activity['status'] == '报名中' ? () {} : null,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFC41E3A),
                                      foregroundColor: Colors.white,
                                      disabledBackgroundColor: Colors.grey[300],
                                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                    ),
                                    child: const Text('立即报名', style: TextStyle(fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
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
