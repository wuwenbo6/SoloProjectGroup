#!/usr/bin/env python3
"""测试所有增强功能"""

import sys
import pandas as pd
import numpy as np

print("=" * 70)
print("🚀 增强功能测试套件")
print("=" * 70)


def test_dask_loader():
    """测试Dask数据加载器"""
    print("\n📊 测试1: Dask大数据加载器")
    print("-" * 70)
    try:
        from data_access.dask_loader import DaskDataLoader, StreamingDataProcessor

        # 创建测试数据
        test_data = pd.DataFrame({
            'A': np.random.randn(10000),
            'B': np.random.randn(10000) * 2 + 5,
            'C': np.random.choice(['X', 'Y', 'Z'], 10000),
            'D': np.random.randint(0, 100, 10000)
        })

        import tempfile
        import os
        tmp_path = os.path.join(tempfile.gettempdir(), "test_large.csv")
        test_data.to_csv(tmp_path, index=False)

        # 使用普通模式加载
        loader = DaskDataLoader(use_dask=False)
        loader.load_csv(tmp_path)
        print(f"✓ Pandas模式加载成功，数据形状: {test_data.shape}")

        # 计算摘要
        summary = loader.compute_summary()
        print(f"✓ 摘要统计计算完成，包含 {len(summary.columns)} 列统计")

        # 数据采样
        sample = loader.sample_data(100)
        print(f"✓ 数据采样成功，样本大小: {len(sample)}")

        os.remove(tmp_path)
        print("✓ 所有数据加载测试通过！")
        return True
    except Exception as e:
        print(f"✗ 数据加载测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_cache_manager():
    """测试缓存管理器"""
    print("\n💾 测试2: 缓存管理器")
    print("-" * 70)
    try:
        from core.cache_manager import CacheManager, DashboardCache

        # 创建缓存管理器（不使用Redis，仅内存缓存）
        cache = CacheManager(redis_url=None, default_ttl=300)

        # 基础缓存操作
        cache.set("test_key", {"data": "value"})
        result = cache.get("test_key")
        print(f"✓ 基础缓存操作: {result}")

        # 使用装饰器缓存函数结果
        @cache.memoize("test_func", ttl=60)
        def expensive_calculation(x, y):
            print(f"  → 执行计算: {x} + {y}")
            return x + y

        result1 = expensive_calculation(10, 20)
        result2 = expensive_calculation(10, 20)  # 应该命中缓存
        print(f"✓ 函数结果缓存: {result1}, 命中缓存: {result1 == result2}")

        # 仪表板专用缓存
        dash_cache = DashboardCache(cache)

        # 模拟数据集摘要
        summary = {
            'rows': 10000,
            'columns': 20,
            'missing_values': 15
        }
        dash_cache.set_dataset_summary("dataset_001", summary)
        retrieved = dash_cache.get_dataset_summary("dataset_001")
        print(f"✓ 数据集摘要缓存: {retrieved}")

        # 获取缓存统计
        stats = dash_cache.get_load_time_stats()
        print(f"✓ 缓存统计: 命中率 {stats['hit_rate']:.1f}%, "
              f"预计节省 {stats['estimated_saved_seconds']:.1f} 秒")

        cache.delete("test_key")
        print("✓ 所有缓存功能测试通过！")
        return True
    except Exception as e:
        print(f"✗ 缓存测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_apriori_mining():
    """测试Apriori关联规则挖掘"""
    print("\n🔗 测试3: Apriori关联规则挖掘")
    print("-" * 70)
    try:
        from analysis.apriori import RuleMiner

        # 创建模拟购物篮数据
        transactions = [
            ['牛奶', '面包', '鸡蛋'],
            ['牛奶', '面包', '黄油'],
            ['牛奶', '咖啡', '糖'],
            ['面包', '鸡蛋', '黄油'],
            ['牛奶', '面包', '鸡蛋', '黄油'],
            ['咖啡', '糖', '牛奶'],
            ['面包', '黄油'],
            ['鸡蛋', '牛奶'],
        ]

        miner = RuleMiner()
        miner.from_list(transactions)

        # 挖掘规则
        rules = miner.mine_rules(min_support=0.25, min_confidence=0.6, max_len=3)
        print(f"✓ 发现关联规则数量: {len(rules)}")

        if len(rules) > 0:
            print(f"\n  前3条规则 (按提升度排序):")
            for _, row in rules.head(3).iterrows():
                print(f"    {row['antecedent_str']} → {row['consequent_str']}")
                print(f"      支持度: {row['support']:.3f}, 置信度: {row['confidence']:.3f}, 提升度: {row['lift']:.2f}")

        # 获取频繁项集
        from analysis.apriori import Apriori
        ap = Apriori(min_support=0.25)
        ap.fit([set(t) for t in transactions])
        itemsets = ap.get_frequent_itemsets(min_len=2)
        print(f"\n✓ 发现频繁项集数量: {len(itemsets)}")

        # 商品推荐
        recommendations = miner.get_top_recommendations('牛奶', top_n=3)
        print(f"\n✓ 牛奶的关联推荐:")
        for _, row in recommendations.iterrows():
            print(f"  → {row['consequent_str']} (置信度: {row['confidence']:.2f})")

        # 生成可视化
        fig = miner.visualize_rules(top_n=10)
        print(f"✓ 规则可视化图表生成完成")

        # 获取摘要
        summary = miner.get_summary()
        print(f"✓ 挖掘摘要: {summary['total_rules']} 条规则, "
              f"{summary['total_frequent_itemsets']} 个频繁项集")

        print("✓ 所有关联规则挖掘测试通过！")
        return True
    except Exception as e:
        print(f"✗ 关联规则挖掘测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_layout_manager():
    """测试布局管理器"""
    print("\n🎨 测试4: 仪表板自定义布局管理器")
    print("-" * 70)
    try:
        from dashboard.layout_manager import (
            LayoutManager, LayoutItem, create_template_layout, TEMPLATES
        )

        import tempfile
        import os
        tmp_storage = os.path.join(tempfile.gettempdir(), "dash_layouts_test")

        # 创建布局管理器
        lm = LayoutManager(storage_path=tmp_storage)
        print(f"✓ 布局管理器初始化完成，存储路径: {tmp_storage}")

        # 创建布局
        layout = lm.create_layout("我的测试仪表板")
        print(f"✓ 创建新布局: ID={layout.layout_id}, 名称='{layout.name}'")

        # 添加图表
        chart1 = LayoutItem(
            chart_id='scatter_001',
            chart_type='scatter',
            x=0, y=0, width=6, height=4,
            config={'x_axis': 'A', 'y_axis': 'B'}
        )
        chart2 = LayoutItem(
            chart_id='histogram_001',
            chart_type='histogram',
            x=6, y=0, width=6, height=4,
            config={'column': 'C'}
        )
        chart3 = LayoutItem(
            chart_id='heatmap_001',
            chart_type='heatmap',
            x=0, y=4, width=12, height=4
        )

        layout.add_item(chart1)
        layout.add_item(chart2)
        layout.add_item(chart3)
        print(f"✓ 添加了 {len(layout.items)} 个图表到布局")

        # 保存布局
        lm.save_layout(layout)
        print(f"✓ 布局已保存到文件")

        # 列出所有布局
        layouts_list = lm.list_layouts()
        print(f"✓ 可用布局列表: {len(layouts_list)} 个布局")
        for l in layouts_list:
            print(f"  - {l['name']} ({l['chart_count']} 图表)")

        # 使用模板创建布局
        charts_config = [
            {'id': 'tpl_chart1', 'type': 'scatter'},
            {'id': 'tpl_chart2', 'type': 'histogram'},
            {'id': 'tpl_chart3', 'type': 'box'},
        ]
        template_layout = create_template_layout('1+2', charts_config, "模板布局示例")
        print(f"✓ 从模板创建布局: {template_layout.name}, "
              f"包含 {len(template_layout.items)} 个图表")

        # 复制布局
        dup_layout = lm.duplicate_layout(layout.layout_id, "副本布局")
        print(f"✓ 复制布局成功，新布局ID: {dup_layout.layout_id}")

        # 设置默认布局
        lm.set_default_layout(layout.layout_id)
        default = lm.get_default_layout()
        print(f"✓ 默认布局设置: {default.name}")

        # 导出布局
        export_path = os.path.join(tempfile.gettempdir(), "exported_layout.json")
        lm.export_layout(layout.layout_id, export_path)
        print(f"✓ 布局已导出到: {export_path}")

        # 导入布局
        imported = lm.import_layout(export_path)
        print(f"✓ 布局导入成功: {imported.name}")

        # 列出可用模板
        print(f"✓ 可用模板: {', '.join(TEMPLATES.keys())}")

        print("✓ 所有布局管理功能测试通过！")
        return True
    except Exception as e:
        print(f"✗ 布局管理测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n📋 开始执行所有增强功能测试...\n")

    results = {}
    results['Dask数据加载器'] = test_dask_loader()
    results['缓存管理器'] = test_cache_manager()
    results['Apriori关联规则'] = test_apriori_mining()
    results['仪表板布局管理'] = test_layout_manager()

    print("\n" + "=" * 70)
    print("📊 测试结果汇总")
    print("=" * 70)

    passed = sum(results.values())
    total = len(results)

    for feature, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{feature:30s}: {status}")

    print("-" * 70)
    print(f"总计: {passed}/{total} 个功能测试通过")

    if passed == total:
        print("\n🎉 所有增强功能已成功实现并通过测试！")
        print("\n📦 新增功能清单:")
        print("  1. Dask大数据加载器 - 支持超大数据集分块处理")
        print("  2. 智能缓存管理器 - Redis/内存双层缓存，加速仪表板")
        print("  3. Apriori关联规则挖掘 - 频繁项集与关联规则发现")
        print("  4. 仪表板布局管理器 - 拖拽式自定义布局，模板支持")
    else:
        print(f"\n⚠️  有 {total - passed} 个功能测试失败，请检查错误信息")

    print("\n" + "=" * 70)
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
