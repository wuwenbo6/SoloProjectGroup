#!/usr/bin/env python3
"""
点云分析系统 - 主程序
实现点云导入、缺损识别、厚度分析、安全评估、报表输出、三维渲染功能
"""

import sys
import os
import argparse
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    PointCloudImporter,
    DefectDetector,
    ThicknessAnalyzer,
    SafetyAssessor,
    ReportGenerator,
    PointCloudVisualizer
)


class PointCloudAnalysisPipeline:
    """点云分析流水线类"""
    
    def __init__(self):
        self.importer = PointCloudImporter()
        self.detector = DefectDetector()
        self.analyzer = ThicknessAnalyzer()
        self.assessor = SafetyAssessor()
        self.reporter = ReportGenerator()
        self.visualizer = PointCloudVisualizer()
        
        self.point_cloud = None
        self.defects = None
        self.defect_labels = None
        self.thickness_values = None
        self.thickness_stats = None
        self.safety_report = None
        
    def run_full_analysis(self,
                          input_file: str,
                          reference_file: str = None,
                          output_dir: str = "output",
                          min_thickness: float = 5.0,
                          detection_method: str = "statistical",
                          thickness_method: str = "normal_projection") -> dict:
        """
        运行完整的点云分析流程
        
        Args:
            input_file: 输入点云文件路径
            reference_file: 参考点云文件路径（可选）
            output_dir: 输出目录
            min_thickness: 最小可接受厚度
            detection_method: 缺损检测方法
            thickness_method: 厚度计算方法
            
        Returns:
            分析结果字典
        """
        print("=" * 60)
        print("点云分析系统 - 开始分析")
        print("=" * 60)
        
        os.makedirs(output_dir, exist_ok=True)
        self.reporter.output_dir = Path(output_dir)
        
        print("\n[1/6] 导入点云文件...")
        success, msg = self.importer.import_file(input_file)
        if not success:
            print(f"错误: {msg}")
            return {'success': False, 'error': msg}
        print(f"成功: {msg}")
        
        self.point_cloud = self.importer.get_point_cloud()
        self.visualizer.set_point_cloud(self.point_cloud)
        
        pc_stats = self.importer.get_statistics()
        print(f"点数: {pc_stats['num_points']}")
        print(f"包围盒尺寸: {pc_stats['extent']}")
        
        if reference_file:
            print("\n导入参考点云...")
            ref_importer = PointCloudImporter()
            success, msg = ref_importer.import_file(reference_file)
            if success:
                self.detector.set_reference(ref_importer.get_point_cloud())
                print("参考点云导入成功")
            else:
                print(f"参考点云导入失败: {msg}")
        
        print("\n[2/6] 缺损检测...")
        self.detector.set_point_cloud(self.point_cloud)
        self.defects, self.defect_labels = self.detector.detect_defects(
            method=detection_method
        )
        defect_summary = self.detector.get_defect_summary()
        print(f"检测到 {defect_summary['total_defects']} 个缺损")
        print(f"缺损总面积: {defect_summary['total_defect_area']:.4f}")
        
        self.visualizer.set_defect_labels(self.defect_labels)
        
        print("\n[3/6] 厚度分析...")
        self.analyzer.set_point_cloud(self.point_cloud)
        self.thickness_values, _ = self.analyzer.compute_thickness(
            method=thickness_method
        )
        self.thickness_stats = self.analyzer.get_thickness_statistics()
        print(f"平均厚度: {self.thickness_stats['mean']:.4f}")
        print(f"最小厚度: {self.thickness_stats['min']:.4f}")
        print(f"最大厚度: {self.thickness_stats['max']:.4f}")
        
        self.visualizer.set_thickness_values(self.thickness_values)
        
        print("\n[4/6] 安全评估...")
        self.assessor.set_defect_data(defect_summary)
        self.assessor.set_thickness_data(self.thickness_stats)
        self.safety_report = self.assessor.assess_safety(
            min_acceptable_thickness=min_thickness
        )
        safety_dict = self.assessor.export_report_dict()
        print(f"安全等级: {self.safety_report.overall_safety_level.value}")
        print(f"总体评分: {self.safety_report.overall_score:.1f}/100")
        print(f"建议数量: {len(self.safety_report.recommendations)}")
        
        print("\n[5/6] 生成报告...")
        report_files = self.reporter.generate_full_report(
            point_cloud_stats=pc_stats,
            defect_summary=defect_summary,
            thickness_summary=self.thickness_stats,
            safety_report=safety_dict
        )
        print("生成的报告文件:")
        for fmt, path in report_files.items():
            print(f"  - {fmt}: {path}")
        
        print("\n[6/6] 可视化与导出...")
        vis_output_dir = Path(output_dir) / "visualizations"
        vis_output_dir.mkdir(exist_ok=True)
        
        print("  导出带缺损标记的3D模型...")
        defect_model_path = self.visualizer.export_3d_model(
            vis_output_dir / "point_cloud_defects.ply",
            colored_by='defect'
        )
        
        print("  导出带厚度颜色的3D模型...")
        thickness_model_path = self.visualizer.export_3d_model(
            vis_output_dir / "point_cloud_thickness.ply",
            colored_by='thickness'
        )
        
        print("  生成分析图表...")
        plot_files = self.visualizer.generate_analysis_plots(
            vis_output_dir,
            defect_summary=defect_summary,
            thickness_stats=self.thickness_stats
        )
        
        print("\n" + "=" * 60)
        print("分析完成!")
        print("=" * 60)
        
        return {
            'success': True,
            'point_cloud_stats': pc_stats,
            'defect_summary': defect_summary,
            'thickness_stats': self.thickness_stats,
            'safety_report': safety_dict,
            'report_files': report_files,
            'visualization_files': {
                'defect_model': defect_model_path,
                'thickness_model': thickness_model_path,
                'plots': plot_files
            }
        }
    
    def show_visualizations(self):
        """显示可视化窗口"""
        if self.point_cloud is None:
            print("没有可显示的点云数据")
            return
            
        print("\n打开可视化窗口...")
        print("按 'q' 或关闭窗口继续")
        
        print("\n1. 原始点云")
        self.visualizer.visualize_point_cloud()
        
        if self.defect_labels is not None:
            print("\n2. 缺损可视化")
            self.visualizer.visualize_defects()
        
        if self.thickness_values is not None:
            print("\n3. 厚度可视化")
            self.visualizer.visualize_thickness()


def main():
    parser = argparse.ArgumentParser(
        description='点云分析系统 - 完整的点云分析解决方案',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py input.ply                  # 基本分析
  python main.py input.ply -r reference.ply # 使用参考点云对比
  python main.py input.ply -o results       # 指定输出目录
  python main.py input.ply --show-visual    # 显示可视化窗口
        """
    )
    
    parser.add_argument('input_file', help='输入点云文件路径 (支持PLY, PCD, XYZ等格式)')
    parser.add_argument('-r', '--reference', help='参考点云文件路径', default=None)
    parser.add_argument('-o', '--output', help='输出目录', default='output')
    parser.add_argument('-m', '--min-thickness', type=float, default=5.0,
                        help='最小可接受厚度')
    parser.add_argument('--detection-method', default='statistical',
                        choices=['statistical', 'distance', 'curvature', 'reference'],
                        help='缺损检测方法')
    parser.add_argument('--thickness-method', default='normal_projection',
                        choices=['normal_projection', 'opposite_search', 'ray_casting', 'mesh_distance'],
                        help='厚度计算方法')
    parser.add_argument('--show-visual', action='store_true',
                        help='显示可视化窗口')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"错误: 输入文件不存在: {args.input_file}")
        sys.exit(1)
    
    if args.reference and not os.path.exists(args.reference):
        print(f"错误: 参考文件不存在: {args.reference}")
        sys.exit(1)
    
    pipeline = PointCloudAnalysisPipeline()
    
    result = pipeline.run_full_analysis(
        input_file=args.input_file,
        reference_file=args.reference,
        output_dir=args.output,
        min_thickness=args.min_thickness,
        detection_method=args.detection_method,
        thickness_method=args.thickness_method
    )
    
    if not result['success']:
        print(f"分析失败: {result.get('error', '未知错误')}")
        sys.exit(1)
    
    if args.show_visual:
        pipeline.show_visualizations()
    
    print(f"\n所有输出已保存到: {os.path.abspath(args.output)}")


if __name__ == '__main__':
    main()
