#!/usr/bin/env python3
"""
点云分析系统 - 示例演示脚本
演示如何生成测试数据并运行完整分析流程
"""

import sys
import os
import numpy as np
import open3d as o3d
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import PointCloudAnalysisPipeline


def generate_sample_point_cloud(output_path: str, add_defects: bool = True):
    """
    生成示例点云数据
    
    Args:
        output_path: 输出路径
        add_defects: 是否添加模拟缺损
    """
    print("生成示例点云...")
    
    mesh = o3d.geometry.TriangleMesh.create_sphere(radius=10.0, resolution=50)
    mesh.compute_vertex_normals()
    
    pcd = mesh.sample_points_poisson_disk(number_of_points=20000)
    
    points = np.asarray(pcd.points)
    normals = np.asarray(pcd.normals)
    
    if add_defects:
        print("  添加模拟缺损...")
        
        defect_centers = [
            np.array([3.0, 4.0, 0.0]),
            np.array([-5.0, -2.0, 3.0]),
            np.array([0.0, -6.0, -4.0])
        ]
        
        defect_radii = [1.5, 2.0, 1.2]
        defect_depths = [0.5, 0.8, 0.3]
        
        for center, radius, depth in zip(defect_centers, defect_radii, defect_depths):
            distances = np.linalg.norm(points - center, axis=1)
            mask = distances < radius
            
            direction = center / np.linalg.norm(center)
            points[mask] -= direction * depth
            
            for i in np.where(mask)[0]:
                noise = np.random.normal(0, 0.05, 3)
                points[i] += noise
    
    pcd.points = o3d.utility.Vector3dVector(points)
    pcd.normals = o3d.utility.Vector3dVector(normals)
    
    o3d.io.write_point_cloud(output_path, pcd)
    print(f"示例点云已保存到: {output_path}")
    print(f"点数: {len(points)}")
    
    return pcd


def generate_reference_point_cloud(output_path: str):
    """生成参考（理想）点云"""
    print("\n生成参考点云...")
    
    mesh = o3d.geometry.TriangleMesh.create_sphere(radius=10.0, resolution=50)
    mesh.compute_vertex_normals()
    
    pcd = mesh.sample_points_poisson_disk(number_of_points=20000)
    
    o3d.io.write_point_cloud(output_path, pcd)
    print(f"参考点云已保存到: {output_path}")
    
    return pcd


def main():
    print("=" * 60)
    print("点云分析系统 - 示例演示")
    print("=" * 60)
    
    sample_dir = Path("sample_data")
    sample_dir.mkdir(exist_ok=True)
    
    sample_pcd_path = sample_dir / "sample_defective.ply"
    reference_pcd_path = sample_dir / "sample_reference.ply"
    
    generate_sample_point_cloud(str(sample_pcd_path), add_defects=True)
    generate_reference_point_cloud(str(reference_pcd_path))
    
    print("\n" + "=" * 60)
    print("开始分析示例点云...")
    print("=" * 60)
    
    pipeline = PointCloudAnalysisPipeline()
    
    result = pipeline.run_full_analysis(
        input_file=str(sample_pcd_path),
        reference_file=str(reference_pcd_path),
        output_dir="sample_output",
        min_thickness=1.0,
        detection_method="statistical",
        thickness_method="normal_projection"
    )
    
    if result['success']:
        print("\n" + "=" * 60)
        print("示例分析完成!")
        print("=" * 60)
        print("\n结果摘要:")
        print(f"  缺损数量: {result['defect_summary']['total_defects']}")
        print(f"  平均厚度: {result['thickness_stats']['mean']:.4f}")
        print(f"  安全等级: {result['safety_report']['overall_safety_level']}")
        print(f"  安全评分: {result['safety_report']['overall_score']:.1f}")
        
        print("\n生成的文件:")
        print("  报告:")
        for fmt, path in result['report_files'].items():
            print(f"    - {fmt}: {os.path.abspath(path)}")
        
        print("\n  可视化:")
        print(f"    - 缺损模型: {os.path.abspath(result['visualization_files']['defect_model'])}")
        print(f"    - 厚度模型: {os.path.abspath(result['visualization_files']['thickness_model'])}")
        
        print("\n可以使用以下命令查看交互式可视化:")
        print(f"  python main.py {sample_pcd_path} --show-visual")
        print("\n或者直接用Open3D或MeshLab查看生成的PLY文件。")
    else:
        print(f"分析失败: {result.get('error', '未知错误')}")


if __name__ == '__main__':
    main()
