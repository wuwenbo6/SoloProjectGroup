import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import '../../core/utils/image_cache_manager.dart';

class WorkPreviewView extends StatefulWidget {
  const WorkPreviewView({super.key});

  @override
  State<WorkPreviewView> createState() => _WorkPreviewViewState();
}

class _WorkPreviewViewState extends State<WorkPreviewView> with SingleTickerProviderStateMixin {
  late PageController pageController;
  int currentIndex = 0;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  final List<String> works = [
    'https://picsum.photos/800/1200?random=101',
    'https://picsum.photos/800/1200?random=102',
    'https://picsum.photos/800/1200?random=103',
    'https://picsum.photos/800/1200?random=104',
    'https://picsum.photos/800/1200?random=105',
  ];

  @override
  void initState() {
    super.initState();
    pageController = PageController(viewportFraction: 0.85);
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(_animationController);
    _preloadImages();
    _animationController.forward();
  }

  Future<void> _preloadImages() async {
    for (String url in works) {
      precacheImage(CachedNetworkImageProvider(url), context);
    }
  }

  @override
  void dispose() {
    pageController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  void _openFullScreen(int index) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            FullScreenPreview(works: works, initialIndex: index),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 300),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('民俗作品展示', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFFC41E3A),
        elevation: 0,
      ),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('优秀作品展示', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF8B4513))),
                  Text('${currentIndex + 1} / ${works.length}', style: TextStyle(color: Colors.grey[600])),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: pageController,
                onPageChanged: (index) => setState(() => currentIndex = index),
                itemCount: works.length,
                itemBuilder: (context, index) {
                  return AnimatedBuilder(
                    animation: pageController,
                    builder: (context, child) {
                      double value = 1.0;
                      if (pageController.position.haveDimensions) {
                        value = pageController.page! - index;
                        value = (1 - (value.abs() * 0.08)).clamp(0.85, 1.0);
                      }
                      return Center(
                        child: Transform.scale(
                          scale: value,
                          child: child,
                        ),
                      );
                    },
                    child: GestureDetector(
                      onTap: () => _openFullScreen(index),
                      child: Hero(
                        tag: 'work_$index',
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 20,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                CachedNetworkImage(
                                  imageUrl: works[index],
                                  fit: BoxFit.cover,
                                  cacheManager: CustomCacheManager.instance,
                                  placeholder: (context, url) => Container(
                                    color: Colors.grey[200],
                                    child: const Center(child: CircularProgressIndicator(color: Color(0xFFC41E3A))),
                                  ),
                                  errorWidget: (context, url, error) => Container(
                                    color: Colors.grey[200],
                                    child: const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                                  ),
                                ),
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          Colors.transparent,
                                          Colors.black.withOpacity(0.7),
                                        ],
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '作品 #${index + 1}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        const Text(
                                          '点击查看大图',
                                          style: TextStyle(color: Colors.white70, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(works.length, (index) {
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: currentIndex == index ? 12 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: currentIndex == index ? const Color(0xFFC41E3A) : Colors.grey[300],
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FullScreenPreview extends StatefulWidget {
  final List<String> works;
  final int initialIndex;

  const FullScreenPreview({super.key, required this.works, required this.initialIndex});

  @override
  State<FullScreenPreview> createState() => _FullScreenPreviewState();
}

class _FullScreenPreviewState extends State<FullScreenPreview> {
  late PageController pageController;
  late int currentIndex;
  bool showControls = true;

  @override
  void initState() {
    super.initState();
    currentIndex = widget.initialIndex;
    pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () => setState(() => showControls = !showControls),
        child: Stack(
          children: [
            PhotoViewGallery.builder(
              scrollPhysics: const BouncingScrollPhysics(),
              pageController: pageController,
              onPageChanged: (index) => setState(() => currentIndex = index),
              itemCount: widget.works.length,
              builder: (context, index) {
                return PhotoViewGalleryPageOptions(
                  imageProvider: CachedNetworkImageProvider(widget.works[index]),
                  initialScale: PhotoViewComputedScale.contained,
                  minScale: PhotoViewComputedScale.contained * 0.8,
                  maxScale: PhotoViewComputedScale.covered * 2,
                  heroAttributes: PhotoViewHeroAttributes(tag: 'work_$index'),
                );
              },
              scrollDirection: Axis.horizontal,
            ),
            AnimatedOpacity(
              opacity: showControls ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 200),
              child: Column(
                children: [
                  AppBar(
                    backgroundColor: Colors.black54,
                    title: Text('${currentIndex + 1} / ${widget.works.length}'),
                    leading: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.all(16),
                    color: Colors.black54,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.save_alt, color: Colors.white),
                          onPressed: () {},
                          tooltip: '保存图片',
                        ),
                        IconButton(
                          icon: const Icon(Icons.share, color: Colors.white),
                          onPressed: () {},
                          tooltip: '分享',
                        ),
                        IconButton(
                          icon: const Icon(Icons.favorite_border, color: Colors.white),
                          onPressed: () {},
                          tooltip: '收藏',
                        ),
                      ],
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
