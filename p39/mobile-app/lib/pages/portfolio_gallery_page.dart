import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import '../models/portfolio.dart';
import '../services/api_service.dart';

class PortfolioGalleryPage extends StatefulWidget {
  final int artisanId;
  final int? initialIndex;

  const PortfolioGalleryPage({
    super.key,
    required this.artisanId,
    this.initialIndex,
  });

  @override
  State<PortfolioGalleryPage> createState() => _PortfolioGalleryPageState();
}

class _PortfolioGalleryPageState extends State<PortfolioGalleryPage> {
  final List<Portfolio> _portfolios = [];
  bool _isLoading = true;
  bool _hasError = false;
  int _currentPage = 1;
  final int _pageSize = 20;
  bool _hasMore = true;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadPortfolios();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent * 0.8) {
      if (_hasMore && !_isLoading) {
        _loadMore();
      }
    }
  }

  Future<void> _loadPortfolios() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      final result = await ApiService.getArtisanPortfolios(
        widget.artisanId,
        page: _currentPage,
        pageSize: _pageSize,
      );

      if (mounted) {
        setState(() {
          _portfolios.addAll(result);
          _isLoading = false;
          _hasMore = result.length == _pageSize;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = true;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    _currentPage++;
    await _loadPortfolios();
  }

  Future<void> _refresh() async {
    _currentPage = 1;
    _portfolios.clear();
    _hasMore = true;
    await _loadPortfolios();
  }

  void _openGallery(int index) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _FullScreenGallery(
          portfolios: _portfolios,
          initialIndex: index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          '作品展示',
          style: TextStyle(color: Colors.white),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _portfolios.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    if (_hasError && _portfolios.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: Colors.white, size: 48),
            const SizedBox(height: 16),
            const Text(
              '加载失败',
              style: TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _refresh,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: StaggeredGridView.countBuilder(
        controller: _scrollController,
        crossAxisCount: 2,
        itemCount: _portfolios.length + (_hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _portfolios.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(color: Colors.white),
              ),
            );
          }

          final portfolio = _portfolios[index];
          return _PortfolioTile(
            portfolio: portfolio,
            onTap: () => _openGallery(index),
            index: index,
          );
        },
        staggeredTileBuilder: (index) {
          if (index == _portfolios.length) {
            return const StaggeredTile.fit(2);
          }
          return StaggeredTile.count(
            1,
            index.isEven ? 1.2 : 1.6,
          );
        },
        mainAxisSpacing: 4,
        crossAxisSpacing: 4,
      ),
    );
  }
}

class _PortfolioTile extends StatelessWidget {
  final Portfolio portfolio;
  final VoidCallback onTap;
  final int index;

  const _PortfolioTile({
    required this.portfolio,
    required this.onTap,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Hero(
        tag: 'portfolio_${portfolio.id}',
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: portfolio.coverUrl ?? '',
              fit: BoxFit.cover,
              placeholder: (context, url) => Container(
                color: Colors.grey[900],
                child: const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white54,
                    ),
                  ),
                ),
              ),
              errorWidget: (context, url, error) => Container(
                color: Colors.grey[900],
                child: const Icon(
                  Icons.broken_image,
                  color: Colors.white54,
                ),
              ),
              memCacheWidth: 400,
              memCacheHeight: 600,
            ),
          ),
        ),
      ),
    );
  }
}

class _FullScreenGallery extends StatefulWidget {
  final List<Portfolio> portfolios;
  final int initialIndex;

  const _FullScreenGallery({
    required this.portfolios,
    required this.initialIndex,
  });

  @override
  State<_FullScreenGallery> createState() => _FullScreenGalleryState();
}

class _FullScreenGalleryState extends State<_FullScreenGallery> {
  late PageController _pageController;
  late int _currentIndex;
  bool _showInfo = true;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                _showInfo = !_showInfo;
              });
            },
            child: PhotoViewGallery.builder(
              pageController: _pageController,
              scrollPhysics: const ClampingScrollPhysics(),
              builder: (BuildContext context, int index) {
                final portfolio = widget.portfolios[index];
                return PhotoViewGalleryPageOptions(
                  imageProvider: CachedNetworkImageProvider(
                    portfolio.imageUrl ?? portfolio.coverUrl ?? '',
                  ),
                  initialScale: PhotoViewComputedScale.contained,
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.covered * 2,
                  heroAttributes: PhotoViewHeroAttributes(
                    tag: 'portfolio_${portfolio.id}',
                  ),
                );
              },
              itemCount: widget.portfolios.length,
              loadingBuilder: (context, event) => Center(
                child: SizedBox(
                  width: 30,
                  height: 30,
                  child: CircularProgressIndicator(
                    value: event == null
                        ? 0
                        : event.cumulativeBytesLoaded /
                            (event.expectedTotalBytes ?? 1),
                    color: Colors.white,
                  ),
                ),
              ),
              onPageChanged: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
            ),
          ),
          if (_showInfo) _buildAppBar(),
          if (_showInfo) _buildBottomInfo(),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: kToolbarHeight + MediaQuery.of(context).padding.top,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.black.withOpacity(0.8),
              Colors.transparent,
            ],
          ),
        ),
        child: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: const CloseButton(color: Colors.white),
          title: Text(
            '${_currentIndex + 1} / ${widget.portfolios.length}',
            style: const TextStyle(color: Colors.white),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomInfo() {
    final portfolio = widget.portfolios[_currentIndex];
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).padding.bottom + 16,
          left: 16,
          right: 16,
          top: 32,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              Colors.black.withOpacity(0.8),
              Colors.transparent,
            ],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              portfolio.title ?? '',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (portfolio.description != null) ...[
              const SizedBox(height: 8),
              Text(
                portfolio.description!,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
