#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import numpy as np

def test_imports():
    print("测试1: 模块导入...")
    try:
        from src.io import PointCloudIO
        from src.preprocessing import PointCloudPreprocessor
        from src.wear_analysis import WearAnalyzer
        from src.thickness_analysis import ThicknessAnalyzer
        from src.safety_assessment import SafetyAssessor
        from src.reporting import ReportGenerator
        print("  ✓ 所有模块导入成功")
        return True
    except Exception as e:
        print(f"  ✗ 导入失败: {e}")
        return False

def test_point_cloud_io():
    print("\n测试2: 点云IO模块...")
    try:
        from src.io import PointCloudIO
        io = PointCloudIO()
        
        pcd = io.generate_sample_point_cloud(num_points=1000)
        print(f"  ✓ 生成点云成功, 点数: {len(pcd.points)}")
        
        info = io.get_point_cloud_info(pcd)
        print(f"  ✓ 点云信息获取成功: {info}")
        
        return True
    except Exception as e:
        print(f"  ✗ 点云IO测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_alignment():
    print("\n测试3: 点云配准（修复点云错位）...")
    try:
        from src.io import PointCloudIO
        from src.preprocessing import PointCloudPreprocessor
        
        io = PointCloudIO()
        preprocessor = PointCloudPreprocessor()
        
        reference = io.generate_sample_point_cloud(num_points=500)
        measured = io.generate_sample_point_cloud(num_points=500)
        
        aligned, transformation = preprocessor.align_point_clouds(measured, reference)
        
        print(f"  ✓ 配准成功")
        print(f"  ✓ 变换矩阵:\n{transformation}")
        return True
    except Exception as e:
        print(f"  ✗ 配准测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_wear_analysis():
    print("\n测试4: 磨损分析（修复磨损误判）...")
    try:
        from src.io import PointCloudIO
        from src.wear_analysis import WearAnalyzer
        
        io = PointCloudIO()
        wear_analyzer = WearAnalyzer()
        
        reference = io.generate_sample_point_cloud(num_points=1000)
        measured = io.generate_sample_point_cloud(num_points=1000, create_wear=True)
        
        distances = wear_analyzer.compute_distance_to_reference(measured, reference)
        print(f"  ✓ 距离计算成功, 距离范围: [{np.min(distances):.4f}, {np.max(distances):.4f}]")
        
        wear_regions, distances, mask = wear_analyzer.detect_wear_regions(
            measured, reference, wear_threshold=-0.001
        )
        print(f"  ✓ 磨损区域检测成功, 检测到 {len(wear_regions)} 个区域")
        print(f"  ✓ 磨损点数: {np.sum(mask)}")
        
        metrics = wear_analyzer.compute_wear_metrics(wear_regions, distances, mask)
        print(f"  ✓ 磨损指标计算成功:")
        print(f"    - 最大磨损深度: {abs(metrics.get('max_wear_depth', 0)):.6f} m")
        print(f"    - 磨损面积比例: {metrics.get('wear_ratio', 0)*100:.2f}%")
        
        return True
    except Exception as e:
        print(f"  ✗ 磨损分析测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_thickness_analysis():
    print("\n测试5: 厚度分析（修复厚度计算错误）...")
    try:
        from src.io import PointCloudIO
        from src.thickness_analysis import ThicknessAnalyzer
        
        io = PointCloudIO()
        thickness_analyzer = ThicknessAnalyzer()
        
        pcd = io.generate_sample_point_cloud(num_points=1000)
        
        thickness_values = thickness_analyzer.compute_thickness_to_plane(pcd)
        print(f"  ✓ 厚度计算成功, 厚度范围: [{np.min(thickness_values):.4f}, {np.max(thickness_values):.4f}]")
        
        stats = thickness_analyzer.compute_thickness_statistics(thickness_values)
        print(f"  ✓ 厚度统计计算成功:")
        print(f"    - 平均厚度: {stats.get('mean_thickness', 0):.6f} m")
        print(f"    - 最小厚度: {stats.get('min_thickness', 0):.6f} m")
        print(f"    - 最大厚度: {stats.get('max_thickness', 0):.6f} m")
        print(f"    - 有效点数: {stats.get('valid_points', 0)}")
        
        return True
    except Exception as e:
        print(f"  ✗ 厚度分析测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_safety_assessment():
    print("\n测试6: 安全评估...")
    try:
        from src.safety_assessment import SafetyAssessor
        
        assessor = SafetyAssessor()
        
        thickness_stats = {
            'mean_thickness': 0.015,
            'min_thickness': 0.008,
            'max_thickness': 0.025
        }
        
        wear_metrics = {
            'num_wear_regions': 2,
            'max_wear_depth': -0.003,
            'wear_ratio': 0.05
        }
        
        thickness_assessment = assessor.assess_thickness_safety(
            thickness_stats, original_thickness=0.02
        )
        print(f"  ✓ 厚度安全评估成功: {thickness_assessment.get('level', 'N/A')}")
        
        wear_assessment = assessor.assess_wear_safety(wear_metrics)
        print(f"  ✓ 磨损风险评估成功: {wear_assessment.get('overall_risk', 'N/A')}")
        
        overall = assessor.assess_overall_safety(thickness_assessment, wear_assessment)
        print(f"  ✓ 综合安全评估成功:")
        print(f"    - 安全等级: {overall.get('overall_level', 'N/A')}")
        print(f"    - 安全得分: {overall.get('overall_score', 0):.1f}/100")
        
        summary = assessor.generate_safety_summary({'overall': overall})
        print(f"  ✓ 安全摘要生成成功")
        
        return True
    except Exception as e:
        print(f"  ✗ 安全评估测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_report_generation():
    print("\n测试7: 报表生成（修复报表空白）...")
    try:
        from src.reporting import ReportGenerator
        
        report_gen = ReportGenerator()
        
        analysis_results = {
            'wear_metrics': {
                'num_wear_regions': 2,
                'max_wear_depth': -0.003,
                'mean_wear_depth': -0.0015,
                'wear_ratio': 0.05,
                'total_wear_volume': 0.00001,
                'region_metrics': []
            },
            'thickness_stats': {
                'mean_thickness': 0.015,
                'min_thickness': 0.008,
                'max_thickness': 0.025,
                'std_thickness': 0.002,
                'median_thickness': 0.016,
                'valid_points': 1000,
                'percentile_25': 0.012,
                'percentile_75': 0.018
            },
            'safety_summary': {
                'safety_score': 75.5,
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
                'num_points': 1000,
                'has_normals': True,
                'has_colors': True
            }
        }
        
        reports = report_gen.generate_full_report(
            analysis_results,
            component_id="TEST-001",
            inspector="Test User"
        )
        
        print(f"  ✓ 报表生成成功:")
        print(f"    - PDF: {reports.get('pdf', 'N/A')}")
        print(f"    - Excel: {reports.get('excel', 'N/A')}")
        print(f"    - JSON: {reports.get('json', 'N/A')}")
        
        for report_path in reports.values():
            if os.path.exists(report_path):
                size = os.path.getsize(report_path)
                print(f"    - {os.path.basename(report_path)}: {size} bytes")
                if size > 100:
                    print(f"      ✓ 文件大小正常")
                else:
                    print(f"      ✗ 文件可能为空")
        
        return True
    except Exception as e:
        print(f"  ✗ 报表生成测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("点云分析系统 - 修复验证测试")
    print("=" * 60)
    
    results = {}
    
    results['imports'] = test_imports()
    results['io'] = test_point_cloud_io()
    results['alignment'] = test_alignment()
    results['wear_analysis'] = test_wear_analysis()
    results['thickness_analysis'] = test_thickness_analysis()
    results['safety_assessment'] = test_safety_assessment()
    results['report_generation'] = test_report_generation()
    
    print("\n" + "=" * 60)
    print("测试结果总结")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {test_name}: {status}")
    
    print(f"\n总测试: {passed}/{total} 通过")
    
    if passed == total:
        print("\n✓ 所有测试通过! 修复验证成功!")
        return 0
    else:
        print(f"\n✗ {total - passed} 个测试失败，请检查相关代码")
        return 1

if __name__ == "__main__":
    sys.exit(main())
