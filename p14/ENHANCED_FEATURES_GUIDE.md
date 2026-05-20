# 🚀 增强功能使用指南

## 📋 概述

本文档介绍数据分析平台新增的4个高级功能：

1. **Dask大数据加载器** - 超大型数据集分块处理
2. **智能缓存管理器** - Redis/内存双层缓存加速
3. **Apriori关联规则挖掘** - 频繁项集与关联规则发现
4. **仪表板自定义布局** - 拖拽式图表位置调整

---

## 📊 功能1: Dask大数据加载器

### 使用场景
- 处理超过内存容量的大型数据集（10GB+）
- CSV/Parquet等格式的分布式加载
- 增量数据处理

### 快速开始

```python
from data_access.dask_loader import DaskDataLoader, StreamingDataProcessor

# 方式1: 自动检测，大文件自动使用Dask
loader = DaskDataLoader(use_dask=True)
df = loader.load_csv("huge_dataset.csv")  # 支持10GB+文件

# 方式2: 强制使用Dask
loader = DaskDataLoader(use_dask=True)
df = loader.load_csv("data.parquet", force_dask=True)

# 获取数据摘要（自动分布式计算）
summary = loader.compute_summary()
print(f"数据统计: {summary}")

# 数据采样（大文件快速预览）
sample = loader.sample_data(n=1000)
print(f"样本大小: {len(sample)}")

# 数据过滤
filtered = loader.filter_data({
    'column_A': ('>', 100),
    'column_B': (['category1', 'category2'])
})

# 转换为Pandas DataFrame（注意内存）
pandas_df = loader.to_pandas()
```

### 流式处理器（真正超大数据）

```python
processor = StreamingDataProcessor(chunk_size=50000)

# 流式处理CSV
def process_chunk(chunk, index):
    return {
        'mean': chunk['value'].mean(),
        'count': len(chunk)
    }

results = processor.process_csv_stream("very_large.csv", callback=process_chunk)
```

---

## 💾 功能2: 智能缓存管理器

### 使用场景
- 加速仪表板加载
- 缓存频繁计算的结果
- 减少数据库/API调用

### 快速开始

```python
from core.cache_manager import CacheManager, DashboardCache, get_global_cache

# 1. 基础缓存
cache = CacheManager(
    redis_url="redis://localhost:6379/0",  # Redis地址
    default_ttl=3600,  # 默认1小时过期
    use_memory_fallback=True  # Redis不可用时使用内存缓存
)

# 设置/获取缓存
cache.set("dataset_summary", {'rows': 10000, 'columns': 20})
result = cache.get("dataset_summary")

# 2. 函数结果缓存（装饰器）
@cache.memoize("expensive_calc", ttl=600)
def calculate_correlation(dataset_id, method):
    # 耗时的计算...
    return result

# 第一次调用执行计算，之后直接返回缓存
result = calculate_correlation("dataset_001", "pearson")

# 3. 仪表板专用缓存
dash_cache = DashboardCache(cache)

# 数据集摘要缓存
dash_cache.set_dataset_summary("ds_001", {'rows': 10000, 'columns': 20})
summary = dash_cache.get_dataset_summary("ds_001")

# 相关性矩阵缓存
dash_cache.set_correlation_matrix("ds_001", "pearson", corr_matrix)
cached_corr = dash_cache.get_correlation_matrix("ds_001", "pearson")

# 聚类结果缓存
dash_cache.set_clustering_result("ds_001", "kmeans", {'n': 3}, cluster_result)
clusters = dash_cache.get_clustering_result("ds_001", "kmeans", {'n': 3})

# 图表缓存
dash_cache.set_figure("scatter_001", plotly_figure, ttl=300)
fig = dash_cache.get_figure("scatter_001")

# 4. 获取统计信息
stats = dash_cache.get_load_time_stats()
print(f"缓存命中率: {stats['hit_rate']:.1f}%")
print(f"预计节省时间: {stats['estimated_saved_seconds']:.1f}秒")

# 5. 失效管理
cache.delete("my_key")  # 删除特定键
cache.invalidate_pattern("ds_001")  # 失效匹配模式的所有键
cache.clear_all()  # 清空所有缓存
```

---

## 🔗 功能3: Apriori关联规则挖掘

### 使用场景
- 市场购物篮分析
- 推荐系统
- 用户行为模式发现
- 特征关联分析

### 快速开始

```python
from analysis.apriori import Apriori, RuleMiner
import pandas as pd

# 方式1: 从事务列表数据
transactions = [
    ['牛奶', '面包', '鸡蛋'],
    ['牛奶', '面包', '黄油'],
    ['牛奶', '咖啡', '糖'],
    ['面包', '鸡蛋', '黄油'],
    ['牛奶', '面包', '鸡蛋', '黄油'],
]

miner = RuleMiner()
miner.from_list(transactions)

# 方式2: 从DataFrame（用于结构化数据）
df = pd.read_csv("customer_data.csv")
miner = RuleMiner(df)
miner.prepare_transactions(
    columns=['age_group', 'income_level', 'product_category'],
    numeric_bins=3  # 数值列分箱数量
)

# 挖掘关联规则
rules = miner.mine_rules(
    min_support=0.1,       # 最小支持度（出现频率）
    min_confidence=0.5,    # 最小置信度
    min_lift=1.2,          # 最小提升度
    max_len=4              # 规则最大长度
)

# 查看结果
print(f"发现 {len(rules)} 条关联规则")
print(rules[['antecedent_str', 'consequent_str', 'support', 'confidence', 'lift']])

# 获取推荐
recommendations = miner.get_top_recommendations('牛奶', top_n=5)
print("牛奶的关联推荐:")
print(recommendations)

# 可视化规则
fig = miner.visualize_rules(top_n=20)
fig.show()  # 显示Plotly散点图

# 网络图可视化
network_fig = miner.itemsets_network(top_n=30)
network_fig.show()

# 获取挖掘摘要
summary = miner.get_summary()
print(f"""
总事务数: {summary['total_transactions']}
频繁项集数: {summary['total_frequent_itemsets']}
关联规则数: {summary['total_rules']}
平均提升度: {summary['avg_lift']:.2f}
""")
```

### 直接使用Apriori类

```python
# 初始化
apriori = Apriori(min_support=0.1, min_confidence=0.5, min_lift=1.0, max_len=3)

# 拟合数据
apriori.fit([set(t) for t in transactions])

# 获取频繁项集
itemsets = apriori.get_frequent_itemsets(min_len=2)
print("频繁项集:")
print(itemsets.sort_values('support', ascending=False).head(10))

# 获取规则
rules = apriori.get_rules()
print(rules.sort_values('lift', ascending=False).head(5))
```

---

## 🎨 功能4: 仪表板自定义布局

### 使用场景
- 用户自定义仪表板布局
- 多图表排列管理
- 布局模板快速应用
- 布局导出/导入分享

### 快速开始

```python
from dashboard.layout_manager import (
    LayoutManager, LayoutItem, DashboardLayout,
    create_template_layout, TEMPLATES
)

# 1. 初始化管理器
lm = LayoutManager(
    storage_path="~/.dash_dashboard/layouts"  # 布局保存位置
)

# 2. 创建新布局
layout = lm.create_layout("销售分析仪表板")

# 3. 添加图表到布局
chart1 = LayoutItem(
    chart_id='scatter_sales',
    chart_type='scatter',
    x=0, y=0,      # 网格位置（基于12列网格）
    width=6, height=4,  # 占据的列数和行数
    config={
        'x_axis': 'date',
        'y_axis': 'sales',
        'color': 'region'
    }
)

chart2 = LayoutItem(
    chart_id='histogram_units',
    chart_type='histogram',
    x=6, y=0, width=6, height=4,
    config={'column': 'units_sold'}
)

chart3 = LayoutItem(
    chart_id='heatmap_correlation',
    chart_type='heatmap',
    x=0, y=4, width=12, height=4,
)

# 添加到布局
layout.add_item(chart1)
layout.add_item(chart2)
layout.add_item(chart3)

# 保存布局
lm.save_layout(layout)
print(f"布局已保存，ID: {layout.layout_id}")

# 4. 使用模板快速创建布局
charts_config = [
    {'id': 'chart_a', 'type': 'scatter'},
    {'id': 'chart_b', 'type': 'histogram'},
    {'id': 'chart_c', 'type': 'box'},
]

# 可用模板: '2x2', '1+2', 'sidebar', '3_row'
template_layout = create_template_layout(
    template_name='1+2',  # 1个大图 + 2个小图
    charts=charts_config,
    name="模板布局示例"
)
lm.save_layout(template_layout)

# 5. 布局管理操作
# 列出所有布局
all_layouts = lm.list_layouts()
print("可用布局:")
for l in all_layouts:
    print(f"  - {l['name']}: {l['chart_count']} 图表")

# 获取特定布局
my_layout = lm.get_layout(layout.layout_id)
if my_layout:
    print(f"获取布局: {my_layout.name}, 包含 {len(my_layout.items)} 个图表")

# 复制布局
copy_layout = lm.duplicate_layout(
    layout_id=layout.layout_id,
    new_name="销售分析（副本）"
)

# 设置默认布局
lm.set_default_layout(layout.layout_id)
default = lm.get_default_layout()
print(f"默认布局: {default.name}")

# 删除布局
# lm.delete_layout(copy_layout.layout_id)

# 6. 导出/导入布局
lm.export_layout(layout.layout_id, "my_layout_export.json")
imported = lm.import_layout("my_layout_export.json")
print(f"导入成功: {imported.name}")

# 7. 高级布局操作
layout.remove_item('chart_b')  # 移除图表
layout.update_item('chart_a', width=12, y=0)  # 更新图表位置/大小
layout.reorder_items()  # 自动重排，避免重叠
lm.save_layout(layout)

# 8. 可用模板
print("可用布局模板:", list(TEMPLATES.keys()))
```

---

## 🔧 安装依赖

```bash
# 安装基础依赖
pip install -r requirements.txt

# 可选：Dask（大数据处理）
pip install dask[distributed]

# 可选：Redis（缓存）
# 需要先安装Redis服务器: https://redis.io/download
pip install redis

# 可选：dash-grid-layout（拖拽布局）
pip install dash-grid-layout
```

---

## 🚀 完整使用示例

```python
# 综合应用示例：大数据分析 + 缓存加速

from data_access.dask_loader import DaskDataLoader
from core.cache_manager import CacheManager, DashboardCache
from analysis.apriori import RuleMiner

# 1. 加载大数据
loader = DaskDataLoader(use_dask=True)
loader.load_csv("sales_data.csv")  # 10GB+ 数据

# 2. 初始化缓存
cache = CacheManager(redis_url="redis://localhost:6379/0")
dash_cache = DashboardCache(cache)

# 3. 计算并缓存关联规则
def mine_associations():
    # 从数据创建事务
    transactions = loader.sample_data(10000)[['product', 'customer', 'region']]
    miner = RuleMiner(transactions)
    miner.prepare_transactions(['product', 'customer', 'region'])
    return miner.mine_rules(min_support=0.05)

# 第一次执行计算，之后从缓存获取
rules = cache.get_or_compute("sales_associations", mine_associations, ttl=86400)

print(f"发现 {len(rules)} 条关联规则")
```

---

## 📝 最佳实践

### 大数据加载
- **>1GB**: 使用Dask模式
- **>10GB**: 使用StreamingDataProcessor流式处理
- **Parquet格式**: 强烈推荐使用Parquet而非CSV，可提升性能10倍

### 缓存策略
- **汇总数据**: 缓存24小时（TTL=86400）
- **计算结果**: 缓存1-4小时
- **图表**: 缓存5-10分钟
- **频繁访问**: 优先使用内存缓存

### 关联规则挖掘
- 先从高支持度开始（如0.1），逐步降低
- 使用lift > 1.2筛选有意义的规则
- 规则长度控制在2-4个项目

### 布局管理
- 使用模板快速搭建基础布局
- 自定义后保存到个人布局
- 重要布局导出备份

---

## 📞 问题排查

### Dask相关
- **问题**: Dask启动慢
  **解决**: 减少worker数量，或者不使用分布式模式

### Redis缓存
- **问题**: Redis连接失败
  **解决**: 检查Redis是否启动，确认地址/端口配置正确

### 关联规则
- **问题**: 找不到规则
  **解决**: 降低min_support和min_confidence参数

---

## ✨ 下一步

查看各个模块的详细文档，或运行示例代码：
```bash
python test_enhanced_features.py  # 测试所有增强功能
```
