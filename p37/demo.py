#!/usr/bin/env python
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("="*60)
print("戏曲唱腔数据分析系统 - 功能演示")
print("="*60)

print("\n1. 初始化各模块...")

try:
    from src.data_access.audio_loader import AudioLoader
    from src.feature_extraction.feature_extractor import FeatureExtractor
    from src.analysis.style_classifier import StyleClassifier
    from src.analysis.comparison import SingerComparator
    from src.analysis.trend_analysis import TrendAnalyzer
    print("   ✓ 所有模块导入成功")
except Exception as e:
    print(f"   ✗ 模块导入失败: {e}")
    sys.exit(1)

print("\n2. 创建音频加载器实例...")
audio_loader = AudioLoader()
print(f"   ✓ 支持的格式: {audio_loader.SUPPORTED_FORMATS}")
print(f"   ✓ 默认采样率: {audio_loader.sample_rate} Hz")

print("\n3. 创建特征提取器实例...")
feature_extractor = FeatureExtractor()
print("   ✓ 特征提取器就绪")
print("   • 可提取特征类别: 音调、节奏、音色、频谱")

print("\n4. 创建分析器实例...")
style_classifier = StyleClassifier(model_type='random_forest')
singer_comparator = SingerComparator()
trend_analyzer = TrendAnalyzer()
print("   ✓ 风格分类器就绪 (随机森林)")
print("   ✓ 传承人比较器就绪")
print("   ✓ 趋势分析器就绪")

print("\n5. 生成示例特征数据...")
import numpy as np
import pandas as pd

np.random.seed(42)
n_samples = 100

sample_types = ['祁剧', '潮剧', '京剧', '越剧']
singers = ['张传承人', '李老艺人', '王大师', '陈名家', '林师傅']
years = [2018, 2019, 2020, 2021, 2022]

data = []
for i in range(n_samples):
    opera_type = np.random.choice(sample_types)
    singer = np.random.choice(singers)
    year = np.random.choice(years)

    row = {
        'sample_id': f'S{i:03d}',
        'opera_type': opera_type,
        'singer': singer,
        'year': year,
        'pitch_mean': 200 + np.random.randn() * 50 + sample_types.index(opera_type) * 15,
        'pitch_std': 30 + np.random.randn() * 10,
        'pitch_range': 250 + np.random.randn() * 40,
        'tempo': 80 + np.random.randn() * 15 + years.index(year) * 3,
        'rms_mean': 0.05 + np.random.randn() * 0.02,
        'spectral_centroid_mean': 1000 + np.random.randn() * 200,
        'mfcc_1_mean': np.random.randn() * 10,
        'mfcc_2_mean': np.random.randn() * 10,
        'mfcc_3_mean': np.random.randn() * 10,
    }
    data.append(row)

df = pd.DataFrame(data)
print(f"   ✓ 生成了 {len(df)} 个样本数据")
print(f"   • 戏曲类型分布:")
for t, c in df['opera_type'].value_counts().items():
    print(f"     - {t}: {c} 个")

print("\n6. 测试唱腔风格分类...")
train_result = style_classifier.train(df, df['opera_type'])
print(f"   ✓ 模型训练完成")
print(f"   • 分类准确率: {train_result['accuracy']:.2%}")
print(f"   • 交叉验证准确率: {train_result['cv_mean_accuracy']:.2%}")

print("\n7. 测试传承人唱腔对比...")
if len(singers) >= 2:
    try:
        comp = singer_comparator.compare_two_singers(df, singers[0], singers[1])
        print(f"   ✓ 对比完成: {singers[0]} vs {singers[1]}")
        print(f"   • 余弦相似度: {comp['similarity']['cosine_similarity']:.4f}")
        print(f"   • 欧氏距离: {comp['similarity']['euclidean_distance']:.4f}")
    except Exception as e:
        print(f"   - 对比跳过: {e}")

print("\n8. 测试趋势分析...")
try:
    trend_results = trend_analyzer.analyze_time_trend(df, year_col='year')
    print(f"   ✓ 趋势分析完成")
    print(f"   • 分析年份范围: {trend_results['year_range']}")
    inc = trend_results['overall_trend_summary']['num_increasing']
    dec = trend_results['overall_trend_summary']['num_decreasing']
    print(f"   • 显著趋势特征数: {inc + dec}")
except Exception as e:
    print(f"   - 趋势分析警告: {e}")

print("\n9. 测试特征重要性分析...")
try:
    importance = style_classifier.get_feature_importance()
    print("   ✓ 特征重要性分析完成")
    print("   • Top 5 重要特征:")
    top_features = list(importance.items())[:5]
    for i, (feature, score) in enumerate(top_features, 1):
        print(f"     {i}. {feature}: {score:.4f}")
except Exception as e:
    print(f"   - 特征重要性分析跳过: {e}")

print("\n" + "="*60)
print("所有功能模块演示完成！")
print("="*60)
print("\n启动完整应用请运行: python app.py")
print("\n主要功能:")
print("  • Flask RESTful API 接口")
print("  • Dash 交互式仪表板")
print("  • 用户上传音频分析")
print("  • 戏曲风格分类")
print("  • 传承人唱腔对比")
print("  • 唱腔演变趋势分析")
print("  • 特征热力图可视化")
print("  • 音频波形与频谱展示")
print("="*60)
