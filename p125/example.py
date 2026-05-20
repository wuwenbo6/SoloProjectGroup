#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from src.io import PointCloudIO
from src.preprocessing import PointCloudPreprocessor
from src.wear_analysis import WearAnalyzer
from src.thickness_analysis import ThicknessAnalyzer
from src.safety_assessment import SafetyAssessor
from src.reporting import ReportGenerator
from src.visualization import PointCloudVisualizer


def example_basic_usage():
    print("示例1: 基本点云导入和可视化")
    print("-" * 50)
    
    io = PointCloudIO()
    vis = PointCloudVisualizer()
    
    pcd = io.generate_sample_point_cloud(num_points=10000)
    print(f"点云点数: {len(pcd.points)}")
    print(f"包含法向量: {pcd.has_normals()}")
    print(f"包含颜色: {pcd.has_colors()}")
    
    io.save_point_cloud(pcd, "sample_point_cloud.ply")
    print("已保存到: sample_point_cloud.ply")
    
    print("\n")


def example_wear_analysis():
    print("示例2: 磨损分析")
    print("-" * 50)
    
    io = PointCloudIO()
    wear_analyzer = WearAnalyzer()
    
    reference = io.generate_sample_point_cloud(num_points=15000, create_wear=False)
    measured = io.generate_sample_point_cloud(num_points=15000, create_wear=True)
    
    wear_regions, distances, wear_mask = wear_analyzer.detect_wear_regions(
        measured, reference, wear_threshold=-0.005
    )
    
    print(f"检测到 {len(wear_regions)} 个磨损区域")
    print(f"最大磨损深度: {np.min(distances):.6f} m")
    print(f"平均磨损深度: {np.mean(distances[wear_mask]):.6f} m")
    
    metrics = wear_analyzer.compute_wear_metrics(wear_regions, distances, wear_mask)
    print(f"磨损面积比例: {metrics['wear_ratio']*100:.2f}%")
    print("\n")


def example_thickness_analysis():
    print("示例3: 厚度分析")
    print("-" * 50)
    
    io = PointCloudIO()
    thickness_analyzer = ThicknessAnalyzer()
    
    pcd = io.generate_sample_point_cloud(num_points=10000)
    
    thickness_values = thickness_analyzer.compute_thickness_to_plane(pcd)
    stats = thickness_analyzer.compute_thickness_statistics(thickness_values)
    
    print(f"平均厚度: {stats['mean_thickness']:.6f} m")
    print(f"最小厚度: {stats['min_thickness']:.6f} m")
    print(f"最大厚度: {stats['max_thickness']:.6f} m")
    print(f"厚度标准差: {stats['std_thickness']:.6f} m")
    print("\n")


def example_safety_assessment():
    print("示例4: 安全评估")
    print("-" * 50)
    
    assessor = SafetyAssessor()
    
    thickness_stats = {
        'mean_thickness': 0.015,
        'min_thickness': 0.008,
        'max_thickness': 0.022
    }
    
    wear_metrics = {
        'num_wear_regions': 2,
        'max_wear_depth': -0.005,
        'wear_ratio': 0.08
    }
    
    thickness_assessment = assessor.assess_thickness_safety(
        thickness_stats, original_thickness=0.02
    )
    wear_assessment = assessor.assess_wear_safety(wear_metrics)
    overall = assessor.assess_overall_safety(thickness_assessment, wear_assessment)
    
    print(f"厚度安全等级: {thickness_assessment['level']}")
    print(f"磨损风险等级: {wear_assessment['overall_risk']}")
    print(f"综合安全等级: {overall['overall_level']}")
    print(f"综合安全得分: {overall['overall_score']:.1f}/100")
    
    print("\n评估建议:")
    for rec in overall['recommendations']:
        print(f"  - {rec}")
    print("\n")


def example_report_generation():
    print("示例5: 报告生成")
    print("-" * 50)
    
    report_gen = ReportGenerator()
    
    analysis_results = {
        'wear_metrics': {
            'num_wear_regions': 2,
            'max_wear_depth': -0.005,
            'mean_wear_depth': -0.003,
            'wear_ratio': 0.08,
            'total_wear_volume': 0.0001,
            'region_metrics': []
        },
        'thickness_stats': {
            'mean_thickness': 0.015,
            'min_thickness': 0.008,
            'max_thickness': 0.022,
            'std_thickness': 0.002,
            'median_thickness': 0.016,
            'valid_points': 10000
        },
        'safety_summary': {
            'safety_score': 75.0,
            'safety_level': 'CAUTION',
            'is_safe': True,
            'needs_inspection': True,
            'needs_immediate_action': False,
            'key_findings': ['Moderate wear detected'],
            'recommendations': [
                'Component showing signs of wear - increase monitoring frequency',
                'Moderate wear detected - monitor closely'
            ]
        },
        'point_cloud_info': {
            'num_points': 10000,
            'has_normals': True,
            'has_colors': True
        }
    }
    
    reports = report_gen.generate_full_report(
        analysis_results,
        component_id="EXAMPLE-001",
        inspector="Demo User"
    )
    
    print(f"PDF报告: {reports['pdf']}")
    print(f"Excel报告: {reports['excel']}")
    print(f"JSON报告: {reports['json']}")
    print("\n")


def example_visualization():
    print("示例6: 可视化功能")
    print("-" * 50)
    print("注意: 此示例将打开可视化窗口，按ESC关闭")
    
    io = PointCloudIO()
    vis = PointCloudVisualizer()
    
    pcd = io.generate_sample_point_cloud(num_points=8000)
    distances = np.random.randn(len(pcd.points)) * 0.01
    
    print("1. 显示原始点云...")
    vis.visualize_point_cloud(pcd, "原始点云")
    
    print("2. 显示磨损热力图...")
    heatmap = vis.visualize_wear_heatmap(pcd, distances, "磨损热力图")
    
    print("3. 生成统计图表...")
    thickness = np.random.randn(len(pcd.points)) * 0.002 + 0.015
    vis.plot_thickness_histogram(thickness, save_to_file=True)
    vis.plot_wear_depth_distribution(distances, save_to_file=True)
    
    print("✓ 直方图已保存到 visualizations/ 目录")
    print("\n")


def run_full_pipeline():
    print("完整分析流程示例")
    print("=" * 60)
    
    from main import PointCloudAnalysisPipeline
    
    pipeline = PointCloudAnalysisPipeline()
    results = pipeline.run_full_analysis(
        component_id="DEMO-001",
        inspector="Demo User",
        enable_visualization=False
    )
    
    print("\n✓ 完整分析流程完成!")
    print(f"  报告位置: {results['reports']['pdf']}")


if __name__ == "__main__":
    print("=" * 60)
    print("点云分析与安全评估系统 - 示例程序")
    print("=" * 60)
    print("\n")
    
    example_basic_usage()
    example_wear_analysis()
    example_thickness_analysis()
    example_safety_assessment()
    example_report_generation()
    
    print("=" * 60)
    print("示例运行完成!")
    print("=" * 60)
    print("\n提示:")
    print("  - 运行 'python main.py' 执行完整分析流程（含可视化）")
    print("  - 运行 'python main.py --no-vis' 执行分析（无可视化）")
    print("  - 查看 reports/ 目录下生成的报告")
    print("  - 查看 visualizations/ 目录下的可视化结果")
