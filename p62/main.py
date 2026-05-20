#!/usr/bin/env python3
"""
戏曲唱腔特征分析系统主入口
支持祁剧、潮剧等小众戏曲的唱腔特征提取、分类与可视化
"""

import argparse
import sys
from pathlib import Path
import pandas as pd

sys.path.append(str(Path(__file__).parent))

from src.audio import AudioLoader
from src.features import FeatureExtractor
from src.analysis import VocalAnalyzer
from src.visualization import DashVisualizer


def load_and_process_data(data_dir: str = None, n_samples: int = 30) -> pd.DataFrame:
    """
    加载音频数据并提取特征
    """
    loader = AudioLoader()

    if data_dir and Path(data_dir).exists():
        print(f"从目录加载数据: {data_dir}")
        audio_data = loader.load_directory(data_dir)
    else:
        print("生成示例数据...")
        samples = loader.generate_sample_data(n_samples=n_samples)
        audio_data = {}
        for file_name, sample_info in samples.items():
            audio_data[file_name] = sample_info

    print("提取特征...")
    extractor = FeatureExtractor()
    features_df = extractor.extract_features_batch(audio_data)

    print(f"成功处理 {len(features_df)} 个样本")
    print(f"提取 {len(features_df.select_dtypes(include=['number']).columns)} 个特征")

    return features_df


def analyze_features(features_df: pd.DataFrame) -> dict:
    """
    执行唱腔特征分析
    """
    print("执行唱腔分析...")
    analyzer = VocalAnalyzer()

    results = {}

    print("1. 唱腔风格分类...")
    classification = analyzer.classify_opera_style(features_df)
    results['classification'] = classification

    print("2. 训练分类器...")
    try:
        classifier_result = analyzer.train_style_classifier(features_df)
        results['classifier'] = classifier_result
        print(f"   分类准确率: {classifier_result['accuracy']:.4f}")
    except Exception as e:
        print(f"   分类器训练跳过: {e}")

    print("3. 分析音域特征...")
    vocal_range = analyzer.analyze_vocal_range(features_df)
    results['vocal_range'] = vocal_range

    inheritors = features_df['inheritor'].unique()
    if len(inheritors) >= 2:
        print(f"4. 传承人对比 ({inheritors[0]} vs {inheritors[1]})...")
        comparison = analyzer.compare_inheritors(features_df, inheritors[0], inheritors[1])
        results['comparison'] = comparison

    if 'year' in features_df.columns and not features_df['year'].isna().all():
        print("5. 演变趋势分析...")
        trend = analyzer.analyze_temporal_trend(features_df)
        results['trend'] = trend

    return results


def save_results(features_df: pd.DataFrame, output_dir: str = 'data/processed'):
    """
    保存分析结果
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    features_df.to_csv(output_path / 'features.csv', index=False, encoding='utf-8-sig')
    print(f"特征数据已保存至: {output_path / 'features.csv'}")


def run_dashboard(features_df: pd.DataFrame = None, port: int = 8050):
    """
    启动Dash可视化仪表板
    """
    print("启动戏曲唱腔分析仪表板...")

    if features_df is None:
        features_df = load_and_process_data()

    dashboard = DashVisualizer(features_df)
    print(f"仪表板将在 http://localhost:{port} 启动")
    print("按 Ctrl+C 停止服务")
    dashboard.run(port=port)


def main():
    parser = argparse.ArgumentParser(
        description='戏曲唱腔特征分析系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 使用示例数据运行仪表板
  python main.py

  # 从指定目录加载音频数据
  python main.py --data-dir ./data/raw

  # 仅处理数据并保存特征
  python main.py --process-only

  # 指定端口运行仪表板
  python main.py --port 8080
        """
    )

    parser.add_argument(
        '--data-dir', '-d',
        type=str,
        help='音频数据目录路径'
    )

    parser.add_argument(
        '--n-samples', '-n',
        type=int,
        default=30,
        help='生成示例数据的数量 (默认: 30)'
    )

    parser.add_argument(
        '--process-only', '-p',
        action='store_true',
        help='仅处理数据并保存特征，不启动仪表板'
    )

    parser.add_argument(
        '--port',
        type=int,
        default=8050,
        help='Dash仪表板端口 (默认: 8050)'
    )

    parser.add_argument(
        '--output', '-o',
        type=str,
        default='data/processed',
        help='特征输出目录 (默认: data/processed)'
    )

    args = parser.parse_args()

    print("=" * 50)
    print("    戏曲唱腔特征分析系统")
    print("=" * 50)

    features_df = load_and_process_data(args.data_dir, args.n_samples)

    if not features_df.empty:
        analyze_features(features_df)
        save_results(features_df, args.output)

        if not args.process_only:
            run_dashboard(features_df, args.port)
    else:
        print("错误: 未能处理有效数据")
        sys.exit(1)


if __name__ == '__main__':
    main()
