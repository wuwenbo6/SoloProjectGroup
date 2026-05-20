import 'package:flutter/material.dart';

class PortfolioPage extends StatelessWidget {
  const PortfolioPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('作品展示'),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(8),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.8,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: 6,
        itemBuilder: (context, index) {
          return _buildPortfolioItem(context, index);
        },
      ),
    );
  }

  Widget _buildPortfolioItem(BuildContext context, int index) {
    final List<Map<String, String>> works = [
      {
        'title': '青花瓷茶具套装',
        'artisan': '李明',
        'craft': '陶瓷制作',
        'price': '¥4,500',
      },
      {
        'title': '苏绣双面绣屏风',
        'artisan': '王芳',
        'craft': '刺绣',
        'price': '¥12,800',
      },
      {
        'title': '东阳木雕佛像',
        'artisan': '张德',
        'craft': '木雕',
        'price': '¥6,800',
      },
      {
        'title': '扬州漆器首饰盒',
        'artisan': '陈静',
        'craft': '漆器',
        'price': '¥2,600',
      },
      {
        'title': '竹编收纳篮',
        'artisan': '林师傅',
        'craft': '竹编',
        'price': '¥380',
      },
      {
        'title': '传统剪纸窗花',
        'artisan': '赵老师',
        'craft': '剪纸',
        'price': '¥168',
      },
    ];

    final work = works[index];

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => WorkDetailPage(work: work),
            ),
          );
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                color: Colors.grey.shade200,
                child: const Center(
                  child: Icon(Icons.image, size: 64, color: Colors.grey),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    work['title']!,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${work['artisan']} · ${work['craft']}',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    work['price']!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WorkDetailPage extends StatelessWidget {
  final Map<String, String> work;

  const WorkDetailPage({super.key, required this.work});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('作品详情'),
        actions: [
          IconButton(
            icon: const Icon(Icons.favorite_border),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 300,
              color: Colors.grey.shade200,
              child: const Center(
                child: Icon(Icons.image, size: 120, color: Colors.grey),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    work['title']!,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      CircleAvatar(
                        child: Text(work['artisan']![0]),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            work['artisan']!,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            work['craft']!,
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    work['price']!,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    '作品描述',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '这是一件精心制作的传统手工艺品，采用传统工艺制作，每一件作品都凝聚了匠人的心血和智慧。作品不仅具有实用价值，更是一件值得收藏的艺术品。',
                    style: TextStyle(height: 1.6),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    '工艺特点',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text('• 采用传统工艺，纯手工制作'),
                  const Text('• 选用优质原材料，保证品质'),
                  const Text('• 每一件作品都独一无二'),
                  const Text('• 支持个性化定制'),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 48),
          ),
          onPressed: () {},
          child: const Text('立即定制'),
        ),
      ),
    );
  }
}
