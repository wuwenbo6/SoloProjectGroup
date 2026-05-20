#!/usr/bin/env python3
"""
点云磨损分析系统 - 主程序入口
功能: 点云导入、磨损检测、厚度分析、安全评估、报表输出、三维可视化、
       风化趋势预测、多期对比、维修量估算、模型切片
"""

import sys
import argparse
import numpy as np
from datetime import datetime, timedelta

from pointcloud_analysis import (
    PointCloudImporter,
    WearDetector,
    ThicknessAnalyzer,
    SafetyEvaluator,
    Visualizer3D,
    ReportGenerator,
    WeatheringPredictor,
    MultiPeriodComparator,
    RepairEstimator,
    PointCloudSlicer
)


def run_demo():
    """运行演示程序，使用生成的示例点云"""
    print("=" * 70)
    print("点云磨损分析系统 - 完整功能演示模式")
    print("=" * 70)

    importer = PointCloudImporter()
    wear_detector = WearDetector()
    thickness_analyzer = ThicknessAnalyzer()
    safety_evaluator = SafetyEvaluator()
    visualizer = Visualizer3D()
    report_gen = ReportGenerator()
    weathering_predictor = WeatheringPredictor()
    repair_estimator = RepairEstimator()
    slicer = PointCloudSlicer()

    print("\n[1] 生成示例点云...")
    reference_cloud = importer.generate_sample(num_points=5000, shape='sphere')
    print(f"  参考点云: {len(reference_cloud.points)} 个点")

    print("\n[2] 模拟磨损...")
    test_cloud = wear_detector.apply_wear_simulation(
        reference_cloud,
        wear_depth=0.05,
        wear_radius=0.5
    )
    print(f"  测试点云: {len(test_cloud.points)} 个点（已添加磨损）")

    print("\n[3] 点云配准...")
    wear_detector.set_point_clouds(reference_cloud, test_cloud)
    transform = wear_detector.register_point_clouds()
    print("  配准完成")

    print("\n[4] 计算距离和检测磨损...")
    distances = wear_detector.compute_distances()
    wear_values, wear_mask = wear_detector.detect_wear(threshold=0.01)
    wear_stats = wear_detector.get_wear_statistics()
    print(f"  磨损点数: {wear_stats['wear_points']}")
    print(f"  磨损比例: {wear_stats['wear_percentage']:.2f}%")
    print(f"  最大磨损: {wear_stats['max_wear']:.4f}m")

    print("\n[5] 厚度分析...")
    thickness_analyzer.set_point_cloud(test_cloud)
    thickness_values = thickness_analyzer.compute_thickness_by_normal(max_distance=0.3)
    thickness_stats = thickness_analyzer.get_thickness_statistics()
    print(f"  有效厚度测量: {thickness_stats['num_valid_points']}")
    print(f"  平均厚度: {thickness_stats['mean_thickness']:.4f}m")

    print("\n[6] 模型切片分析...")
    slicer.set_point_cloud(test_cloud)
    slices = slicer.create_multiple_slices(axis='z', num_slices=10, thickness=0.02)
    slice_info = {
        'slice_count': len(slices),
        'axis': 'z',
        'avg_points': np.mean([len(s['points']) for s in slices]) if slices else 0
    }
    print(f"  创建了 {len(slices)} 个切片")

    print("\n[7] 维修量估算...")
    repair_volume = repair_estimator.estimate_repair_volume(
        test_cloud, wear_values, wear_mask
    )
    repair_plan = repair_estimator.generate_repair_plan(
        wear_values, wear_mask, np.asarray(test_cloud.points)
    )
    print(f"  修复体积: {repair_volume.get('repair_volume_m3', 0):.4f} m³")
    print(f"  修复面积: {repair_volume.get('repair_area_m2', 0):.4f} m²")
    print(f"  材料重量: {repair_volume.get('material_weight_kg', 0):.1f} kg")
    print(f"  维修建议: {repair_plan.get('recommendation', '无需维修')}")

    print("\n[8] 添加历史数据模拟风化趋势预测...")
    base_date = datetime.now()
    for i in range(3):
        hist_date = base_date - timedelta(days=(3 - i) * 90)
        sim_wear_stats = {
            'wear_percentage': wear_stats['wear_percentage'] * (0.5 + i * 0.25),
            'max_wear': wear_stats['max_wear'] * (0.3 + i * 0.35),
            'mean_wear': wear_stats['mean_wear'] * (0.4 + i * 0.3)
        }
        sim_thickness_stats = {
            'mean_thickness': thickness_stats['mean_thickness'] * (1.2 - i * 0.1),
            'min_thickness': thickness_stats['min_thickness'] * (1.3 - i * 0.15)
        }
        weathering_predictor.add_history_record(hist_date, sim_wear_stats, sim_thickness_stats)
    print("  添加了3个历史数据点")

    print("\n[9] 风化趋势预测...")
    prediction = weathering_predictor.predict(days_ahead=365)
    if 'error' not in prediction:
        print(f"  预计剩余寿命: {prediction.get('remaining_life_days', 0):.1f} 天")
        print(f"  预测方法: {prediction.get('method', '线性')}")
    else:
        print(f"  预测提示: {prediction['error']}")

    print("\n[10] 安全评估...")
    comprehensive_result = safety_evaluator.comprehensive_evaluation(
        thickness_values, wear_values, wear_mask
    )
    print(f"  总体安全等级: {comprehensive_result['overall_safety_level'].value}")
    print(f"  总体评分: {comprehensive_result['overall_score'] * 100:.1f}")

    print("\n[11] 生成综合分析报告...")
    point_cloud_info = importer.get_info()
    point_cloud_info['num_valid_points'] = thickness_stats.get('num_valid_points', 0)

    advanced_results = {
        'prediction': prediction if 'error' not in prediction else {},
        'repair': {**repair_volume, **repair_plan},
        'slice': slice_info
    }

    html_report = report_gen.generate_html_report(
        comprehensive_result,
        point_cloud_info,
        advanced_results
    )
    json_report = report_gen.generate_json_report(
        comprehensive_result,
        point_cloud_info,
        advanced_results
    )
    print(f"  HTML报告: {html_report}")
    print(f"  JSON报告: {json_report}")

    if 'error' not in prediction:
        pred_report = report_gen.generate_prediction_report(prediction)
        print(f"  趋势预测报告: {pred_report}")

    print("\n" + "=" * 70)
    print("演示完成！")
    print("=" * 70)


def analyze_point_clouds(reference_path: str, test_path: str,
                         output_dir: str = "reports",
                         do_slice: bool = False,
                         do_prediction: bool = False):
    """分析两个点云文件"""
    print("=" * 70)
    print("点云磨损分析系统 - 完整分析模式")
    print("=" * 70)

    importer = PointCloudImporter()
    wear_detector = WearDetector()
    thickness_analyzer = ThicknessAnalyzer()
    safety_evaluator = SafetyEvaluator()
    report_gen = ReportGenerator(output_dir=output_dir)
    repair_estimator = RepairEstimator()
    slicer = PointCloudSlicer()

    print(f"\n[1] 加载参考点云: {reference_path}")
    reference_cloud = importer.load(reference_path)
    ref_info = importer.get_info()
    print(f"  点数: {ref_info['num_points']}")

    print(f"\n[2] 加载测试点云: {test_path}")
    test_cloud = importer.load(test_path)
    test_info = importer.get_info()
    print(f"  点数: {test_info['num_points']}")

    print("\n[3] 点云配准...")
    wear_detector.set_point_clouds(reference_cloud, test_cloud)
    transform = wear_detector.register_point_clouds()
    print("  配准完成")

    print("\n[4] 计算距离和检测磨损...")
    distances = wear_detector.compute_distances()
    wear_values, wear_mask = wear_detector.detect_wear(threshold=0.005)
    wear_stats = wear_detector.get_wear_statistics()
    print(f"  磨损点数: {wear_stats['wear_points']}")
    print(f"  磨损比例: {wear_stats['wear_percentage']:.2f}%")

    print("\n[5] 厚度分析...")
    thickness_analyzer.set_point_cloud(test_cloud)
    thickness_values = thickness_analyzer.compute_thickness_by_normal(max_distance=0.3)
    thickness_stats = thickness_analyzer.get_thickness_statistics()
    print(f"  平均厚度: {thickness_stats.get('mean_thickness', 0):.4f}m")
    print(f"  有效测量: {thickness_stats.get('num_valid_points', 0)}")

    advanced_results = {}

    if do_slice:
        print("\n[6] 模型切片分析...")
        slicer.set_point_cloud(test_cloud)
        slices = slicer.create_multiple_slices(axis='z', num_slices=10, thickness=0.02)
        advanced_results['slice'] = {
            'slice_count': len(slices),
            'axis': 'z',
            'avg_points': np.mean([len(s['points']) for s in slices]) if slices else 0
        }
        print(f"  创建了 {len(slices)} 个切片")

    print("\n[7] 维修量估算...")
    repair_volume = repair_estimator.estimate_repair_volume(
        test_cloud, wear_values, wear_mask
    )
    repair_plan = repair_estimator.generate_repair_plan(
        wear_values, wear_mask, np.asarray(test_cloud.points)
    )
    advanced_results['repair'] = {**repair_volume, **repair_plan}
    print(f"  修复体积: {repair_volume.get('repair_volume_m3', 0):.4f} m³")
    print(f"  修复面积: {repair_volume.get('repair_area_m2', 0):.4f} m²")

    if do_prediction:
        print("\n[8] 风化趋势预测 (基于当前数据)...")
        weathering_predictor = WeatheringPredictor()
        weathering_predictor.add_history_record(
            datetime.now() - timedelta(days=180),
            {'wear_percentage': wear_stats['wear_percentage'] * 0.5,
             'max_wear': wear_stats['max_wear'] * 0.4},
            thickness_stats
        )
        weathering_predictor.add_history_record(
            datetime.now(),
            wear_stats,
            thickness_stats
        )
        prediction = weathering_predictor.predict(days_ahead=365)
        if 'error' not in prediction:
            advanced_results['prediction'] = prediction
            print(f"  预计剩余寿命: {prediction.get('remaining_life_days', 0):.1f} 天")

    print("\n[9] 安全评估...")
    comprehensive_result = safety_evaluator.comprehensive_evaluation(
        thickness_values, wear_values, wear_mask
    )
    print(f"  总体安全等级: {comprehensive_result['overall_safety_level'].value}")

    print("\n[10] 生成报告...")
    test_info['num_valid_points'] = thickness_stats.get('num_valid_points', 0)
    html_report = report_gen.generate_html_report(
        comprehensive_result, test_info, advanced_results
    )
    json_report = report_gen.generate_json_report(
        comprehensive_result, test_info, advanced_results
    )
    print(f"  HTML报告: {html_report}")
    print(f"  JSON报告: {json_report}")

    print("\n" + "=" * 70)
    print("分析完成！")
    print("=" * 70)


def compare_periods(period_files: list, output_dir: str = "reports"):
    """多期数据对比"""
    if len(period_files) < 2:
        print("错误: 需要至少2个文件进行对比")
        return

    print("=" * 70)
    print("点云磨损分析系统 - 多期数据对比模式")
    print("=" * 70)

    importer = PointCloudImporter()
    wear_detector = WearDetector()
    thickness_analyzer = ThicknessAnalyzer()
    comparator = MultiPeriodComparator()
    report_gen = ReportGenerator(output_dir=output_dir)

    reference_cloud = None

    for i, file_path in enumerate(period_files):
        print(f"\n[{i+1}] 加载点云: {file_path}")
        cloud = importer.load(file_path)

        if i == 0:
            reference_cloud = cloud
            print("  设置为参考基准")
            continue

        wear_detector.set_point_clouds(reference_cloud, cloud)
        wear_detector.register_point_clouds()
        wear_values, wear_mask = wear_detector.detect_wear(threshold=0.005)

        thickness_analyzer.set_point_cloud(cloud)
        thickness_values = thickness_analyzer.compute_thickness_by_normal(max_distance=0.3)

        comparator.add_period(f"第{i}期", cloud, wear_values, thickness_values)
        print(f"  添加到对比分析")

    print("\n[*] 进行多期对比...")
    comparison = comparator.get_comparison_summary()

    print("\n[*] 生成对比报告...")
    compare_report = report_gen.generate_comparison_report(comparison)
    print(f"  对比报告: {compare_report}")

    print("\n" + "=" * 70)
    print("对比分析完成！")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="点云磨损分析系统 v1.1")
    parser.add_argument('--demo', action='store_true', help='运行完整演示模式')
    parser.add_argument('--reference', type=str, help='参考点云文件路径')
    parser.add_argument('--test', type=str, help='测试点云文件路径')
    parser.add_argument('--periods', type=str, nargs='+', help='多期对比的点云文件列表')
    parser.add_argument('--output', type=str, default='reports', help='报告输出目录')
    parser.add_argument('--slice', action='store_true', help='启用切片分析')
    parser.add_argument('--predict', action='store_true', help='启用趋势预测')

    args = parser.parse_args()

    if args.demo:
        run_demo()
    elif args.periods and len(args.periods) >= 2:
        compare_periods(args.periods, args.output)
    elif args.reference and args.test:
        analyze_point_clouds(
            args.reference, args.test, args.output,
            do_slice=args.slice, do_prediction=args.predict
        )
    else:
        print("使用方法:")
        print("  演示模式: python main.py --demo")
        print("  分析模式: python main.py --reference <ref.ply> --test <test.ply> [--slice] [--predict]")
        print("  多期对比: python main.py --periods file1.ply file2.ply [file3.ply...]")
        sys.exit(1)


if __name__ == "__main__":
    main()
