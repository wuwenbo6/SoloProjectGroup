#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import open3d as o3d
from src.io import PointCloudIO
from src.preprocessing import PointCloudPreprocessor
from src.wear_analysis import WearAnalyzer
from src.thickness_analysis import ThicknessAnalyzer
from src.safety_assessment import SafetyAssessor
from src.reporting import ReportGenerator
from src.visualization import PointCloudVisualizer


class PointCloudAnalysisPipeline:
    def __init__(self):
        self.io = PointCloudIO()
        self.preprocessor = PointCloudPreprocessor()
        self.wear_analyzer = WearAnalyzer()
        self.thickness_analyzer = ThicknessAnalyzer()
        self.safety_assessor = SafetyAssessor()
        self.report_generator = ReportGenerator()
        self.visualizer = PointCloudVisualizer()

    def run_full_analysis(self, measured_pcd_path: str = None, 
                          reference_pcd_path: str = None,
                          component_id: str = "COMP-001",
                          inspector: str = "System",
                          enable_visualization: bool = True) -> dict:
        print("=" * 60)
        print("点云分析与安全评估系统")
        print("=" * 60)
        
        if measured_pcd_path is None or reference_pcd_path is None:
            print("\n[1/8] 生成示例点云数据...")
            reference_pcd = self.io.generate_sample_point_cloud(num_points=20000, add_noise=False, create_wear=False)
            measured_pcd = self.io.generate_sample_point_cloud(num_points=20000, add_noise=True, create_wear=True)
            print("    ✓ 已生成参考点云和磨损测量点云")
        else:
            print(f"\n[1/8] 加载点云数据...")
            reference_pcd = self.io.load_point_cloud(reference_pcd_path)
            measured_pcd = self.io.load_point_cloud(measured_pcd_path)
            print(f"    ✓ 已加载: {reference_pcd_path}")
            print(f"    ✓ 已加载: {measured_pcd_path}")
        
        print("\n[2/8] 数据预处理...")
        measured_clean = self.preprocessor.remove_outliers(measured_pcd)[0]
        reference_clean = self.preprocessor.remove_outliers(reference_pcd)[0]
        print("    ✓ 异常值移除完成")
        
        if not measured_clean.has_normals():
            measured_clean = self.preprocessor.compute_normals(measured_clean)
        if not reference_clean.has_normals():
            reference_clean = self.preprocessor.compute_normals(reference_clean)
        print("    ✓ 法向量计算完成")
        
        aligned_pcd, _ = self.preprocessor.align_point_clouds(measured_clean, reference_clean)
        print("    ✓ 点云配准完成")
        
        print("\n[3/8] 磨损区域识别...")
        wear_regions, distances, wear_mask = self.wear_analyzer.detect_wear_regions(
            aligned_pcd, reference_clean, wear_threshold=-0.005
        )
        print(f"    ✓ 检测到 {len(wear_regions)} 个磨损区域")
        print(f"    ✓ 总磨损点数: {np.sum(wear_mask)}")
        
        print("\n[4/8] 磨损指标计算...")
        wear_metrics = self.wear_analyzer.compute_wear_metrics(wear_regions, distances, wear_mask)
        print(f"    ✓ 最大磨损深度: {abs(wear_metrics['max_wear_depth']):.6f} m")
        print(f"    ✓ 平均磨损深度: {abs(wear_metrics['mean_wear_depth']):.6f} m")
        print(f"    ✓ 磨损面积比例: {wear_metrics['wear_ratio']*100:.2f}%")
        
        print("\n[5/8] 厚度分析...")
        thickness_values = self.thickness_analyzer.compute_thickness_to_plane(aligned_pcd)
        thickness_stats = self.thickness_analyzer.compute_thickness_statistics(thickness_values)
        print(f"    ✓ 平均厚度: {thickness_stats['mean_thickness']:.6f} m")
        print(f"    ✓ 最小厚度: {thickness_stats['min_thickness']:.6f} m")
        print(f"    ✓ 最大厚度: {thickness_stats['max_thickness']:.6f} m")
        
        print("\n[6/8] 安全评估...")
        thickness_assessment = self.safety_assessor.assess_thickness_safety(
            thickness_stats, original_thickness=0.02
        )
        wear_assessment = self.safety_assessor.assess_wear_safety(wear_metrics)
        overall_assessment = self.safety_assessor.assess_overall_safety(
            thickness_assessment, wear_assessment
        )
        safety_summary = self.safety_assessor.generate_safety_summary({
            'thickness': thickness_assessment,
            'wear': wear_assessment,
            'overall': overall_assessment
        })
        print(f"    ✓ 安全等级: {safety_summary['safety_level']}")
        print(f"    ✓ 安全得分: {safety_summary['safety_score']:.1f}/100")
        print(f"    ✓ 需要检查: {'是' if safety_summary['needs_inspection'] else '否'}")
        print(f"    ✓ 需要立即行动: {'是' if safety_summary['needs_immediate_action'] else '否'}")
        
        print("\n[7/8] 生成分析报告...")
        point_cloud_info = self.io.get_point_cloud_info(aligned_pcd)
        analysis_results = {
            'wear_metrics': wear_metrics,
            'thickness_stats': thickness_stats,
            'safety_summary': safety_summary,
            'point_cloud_info': point_cloud_info,
            'thickness_assessment': thickness_assessment,
            'wear_assessment': wear_assessment,
            'overall_assessment': overall_assessment
        }
        
        reports = self.report_generator.generate_full_report(
            analysis_results, component_id, inspector
        )
        print(f"    ✓ PDF报告: {reports['pdf']}")
        print(f"    ✓ Excel报告: {reports['excel']}")
        print(f"    ✓ JSON报告: {reports['json']}")
        
        if enable_visualization:
            print("\n[8/8] 生成可视化...")
            print("    提示: 关闭可视化窗口后程序将继续...")
            
            self.visualizer.plot_thickness_histogram(thickness_values, save_to_file=True)
            self.visualizer.plot_wear_depth_distribution(distances, save_to_file=True)
            print("    ✓ 统计图表已保存")
            
            heatmap_pcd = self.wear_analyzer.create_wear_heatmap(aligned_pcd, distances)
            self.visualizer.capture_point_cloud_image(heatmap_pcd, "wear_heatmap.png")
            print("    ✓ 磨损热力图已生成")
            
            print("\n    显示点云可视化窗口 (按ESC关闭窗口)...")
            self.visualizer.visualize_wear_regions(aligned_pcd, reference_clean, wear_regions, distances)
            print("    ✓ 可视化完成")
        
        print("\n" + "=" * 60)
        print("分析完成! 总结:")
        print("-" * 60)
        print(f"  组件ID: {component_id}")
        print(f"  安全等级: {safety_summary['safety_level']}")
        print(f"  安全得分: {safety_summary['safety_score']:.1f}/100")
        print(f"  检测到的磨损区域数: {len(wear_regions)}")
        print(f"  报告已保存到目录: {self.report_generator.output_dir}/")
        print("=" * 60)
        
        return {
            'analysis_results': analysis_results,
            'reports': reports,
            'point_clouds': {
                'measured': aligned_pcd,
                'reference': reference_clean
            }
        }

    def analyze_single_point_cloud(self, pcd_path: str, 
                                    component_id: str = "COMP-001",
                                    enable_visualization: bool = True) -> dict:
        print("=" * 60)
        print("单点云分析模式")
        print("=" * 60)
        
        print(f"\n加载点云: {pcd_path}")
        pcd = self.io.load_point_cloud(pcd_path)
        point_cloud_info = self.io.get_point_cloud_info(pcd)
        
        print("\n预处理...")
        pcd_clean = self.preprocessor.remove_outliers(pcd)[0]
        if not pcd_clean.has_normals():
            pcd_clean = self.preprocessor.compute_normals(pcd_clean)
        
        print("\n无参考的磨损分析...")
        wear_regions, wear_result = self.wear_analyzer.analyze_wear_without_reference(
            pcd_clean, curvature_threshold=0.1
        )
        print(f"检测到 {len(wear_regions)} 个潜在磨损区域")
        
        print("\n厚度分析...")
        thickness_values = self.thickness_analyzer.compute_thickness_to_plane(pcd_clean)
        thickness_stats = self.thickness_analyzer.compute_thickness_statistics(thickness_values)
        
        print("\n安全评估...")
        thickness_assessment = self.safety_assessor.assess_thickness_safety(
            thickness_stats, original_thickness=0.02
        )
        wear_metrics = wear_result if isinstance(wear_result, dict) else {}
        wear_assessment = self.safety_assessor.assess_wear_safety(wear_metrics)
        overall_assessment = self.safety_assessor.assess_overall_safety(
            thickness_assessment, wear_assessment
        )
        safety_summary = self.safety_assessor.generate_safety_summary({
            'thickness': thickness_assessment,
            'wear': wear_assessment,
            'overall': overall_assessment
        })
        
        print(f"\n安全等级: {safety_summary['safety_level']}")
        print(f"安全得分: {safety_summary['safety_score']:.1f}/100")
        
        if enable_visualization:
            print("\n生成可视化...")
            self.visualizer.visualize_point_cloud(pcd_clean, window_name="原始点云")
        
        return {
            'safety_summary': safety_summary,
            'thickness_stats': thickness_stats,
            'point_cloud_info': point_cloud_info,
            'wear_regions': wear_regions
        }


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="点云分析与安全评估系统")
    parser.add_argument('--measured', type=str, help='测量点云文件路径')
    parser.add_argument('--reference', type=str, help='参考点云文件路径')
    parser.add_argument('--component', type=str, default='COMP-001', help='组件ID')
    parser.add_argument('--inspector', type=str, default='System', help='检测人员')
    parser.add_argument('--no-vis', action='store_true', help='禁用可视化')
    parser.add_argument('--single', action='store_true', help='单点云分析模式')
    
    args = parser.parse_args()
    
    pipeline = PointCloudAnalysisPipeline()
    
    if args.single and args.measured:
        pipeline.analyze_single_point_cloud(
            args.measured,
            component_id=args.component,
            enable_visualization=not args.no_vis
        )
    else:
        pipeline.run_full_analysis(
            measured_pcd_path=args.measured,
            reference_pcd_path=args.reference,
            component_id=args.component,
            inspector=args.inspector,
            enable_visualization=not args.no_vis
        )


if __name__ == "__main__":
    main()
