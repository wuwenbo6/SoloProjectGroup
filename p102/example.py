#!/usr/bin/env python3
"""
榫卯结构受力模拟系统 - 示例脚本
Mortise and Tenon Joint Stress Simulation - Examples
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parameters import ParameterManager
from simulation import StressSimulation
from visualization import ResultsVisualizer
from optimization import JointOptimizer


def example_1_basic_simulation():
    """示例1: 基础受力模拟"""
    print("=" * 60)
    print("示例 1: 基础受力模拟")
    print("Example 1: Basic Stress Simulation")
    print("=" * 60)
    
    param_manager = ParameterManager()
    
    param_manager.set_structure_parameters(
        wood_type='oak',
        joint_type='mortise_tenon',
        beam_width=0.05,
        beam_height=0.05,
        beam_length=0.3,
        tenon_length=0.03,
        tenon_width=0.02,
        mortise_depth=0.02,
        load_magnitude=1000.0,
        load_direction='bending',
        friction_coefficient=0.5
    )
    
    print("\n木材属性:")
    wood_props = param_manager.get_wood_properties('oak')
    for key, value in wood_props.items():
        print(f"  {key}: {value}")
    
    print(f"\n接触面积: {param_manager.get_contact_area()*1e6:.2f} mm²")
    
    errors = param_manager.validate_parameters()
    if errors:
        print("\n参数警告:")
        for error in errors:
            print(f"  - {error}")
    else:
        print("\n参数验证通过 ✓")
    
    simulation = StressSimulation(param_manager)
    results = simulation.run_simulation()
    
    print("\n" + simulation.get_summary())
    
    return results


def example_2_stress_visualization():
    """示例2: 应力分布可视化"""
    print("\n" + "=" * 60)
    print("示例 2: 应力分布可视化")
    print("Example 2: Stress Distribution Visualization")
    print("=" * 60)
    
    param_manager = ParameterManager()
    param_manager.set_structure_parameters(
        wood_type='pine',
        joint_type='lap_joint',
        beam_width=0.06,
        beam_height=0.04,
        beam_length=0.4,
        tenon_length=0.05,
        tenon_width=0.025,
        mortise_depth=0.02,
        load_magnitude=800.0,
        load_direction='shear'
    )
    
    simulation = StressSimulation(param_manager)
    results = simulation.run_simulation()
    
    visualizer = ResultsVisualizer(results)
    
    print("\n生成可视化图表...")
    
    visualizer.plot_stress_heatmap('von_mises', show=False,
                                  save_path='data/example2_von_mises.png')
    print("  - Von Mises 应力热力图已保存")
    
    visualizer.plot_stress_profile(show=False,
                                 save_path='data/example2_stress_profile.png')
    print("  - 应力剖面图已保存")
    
    visualizer.plot_safety_factors(show=False,
                                 save_path='data/example2_safety_factors.png')
    print("  - 安全系数柱状图已保存")
    
    visualizer.plot_joint_schematic(show=False,
                                  save_path='data/example2_schematic.png')
    print("  - 榫卯结构示意图已保存")
    
    print(f"\n可视化文件保存在: {os.path.abspath('data')}")
    
    return results


def example_3_parametric_study():
    """示例3: 参数化研究"""
    print("\n" + "=" * 60)
    print("示例 3: 参数化研究 - 榫头长度优化")
    print("Example 3: Parametric Study - Tenon Length Optimization")
    print("=" * 60)
    
    param_manager = ParameterManager()
    param_manager.set_structure_parameters(
        wood_type='rosewood',
        joint_type='mortise_tenon',
        beam_width=0.05,
        beam_height=0.05,
        beam_length=0.35,
        tenon_length=0.03,
        tenon_width=0.02,
        mortise_depth=0.02,
        load_magnitude=1200.0,
        load_direction='axial'
    )
    
    simulation = StressSimulation(param_manager)
    
    print("\n运行参数化研究: 榫头长度 10mm ~ 60mm...")
    study_results = simulation.run_parametric_study(
        param_name='tenon_length',
        start=0.01,
        end=0.06,
        num_points=12
    )
    
    print(f"完成 {len(study_results)} 次模拟")
    
    print("\n关键结果摘要:")
    print(f"  最小安全系数: {min(r['safety_factors']['overall'] for r in study_results):.3f}")
    print(f"  最大安全系数: {max(r['safety_factors']['overall'] for r in study_results):.3f}")
    
    visualizer = ResultsVisualizer(study_results[-1])
    visualizer.plot_parametric_study(study_results, 'tenon_length',
                                   save_path='data/example3_parametric.png',
                                   show=False)
    print(f"\n参数化研究图表已保存至: data/example3_parametric.png")
    
    return study_results


def example_4_joint_optimization():
    """示例4: 结构参数优化"""
    print("\n" + "=" * 60)
    print("示例 4: 结构参数优化")
    print("Example 4: Joint Parameter Optimization")
    print("=" * 60)
    
    param_manager = ParameterManager()
    param_manager.set_structure_parameters(
        wood_type='oak',
        joint_type='dovetail',
        beam_width=0.05,
        beam_height=0.05,
        beam_length=0.3,
        tenon_length=0.02,
        tenon_width=0.015,
        mortise_depth=0.015,
        load_magnitude=1500.0,
        load_direction='bending'
    )
    
    simulation = StressSimulation(param_manager)
    initial_results = simulation.run_simulation()
    
    print(f"\n初始配置安全系数: {initial_results['safety_factors']['overall']:.3f}")
    
    print("\n运行参数优化 (随机搜索, 30次迭代)...")
    optimizer = JointOptimizer(param_manager, simulation)
    
    opt_results = optimizer.optimize(
        method='random',
        param_names=['tenon_length', 'tenon_width', 'mortise_depth'],
        n_iterations=30,
        weights={'safety_factor': 0.6, 'deformation': 0.3, 'stress': 0.1}
    )
    
    print("\n" + optimizer.get_optimization_summary())
    
    print("\n生成优化结果图表...")
    optimizer.plot_convergence(save_path='data/example4_convergence.png', show=False)
    optimizer.compare_before_after(save_path='data/example4_comparison.png', show=False)
    
    print(f"优化结果图表已保存至 data/")
    
    return opt_results


def example_5_save_and_load():
    """示例5: 结果保存与加载"""
    print("\n" + "=" * 60)
    print("示例 5: 结果保存与加载")
    print("Example 5: Save and Load Results")
    print("=" * 60)
    
    param_manager = ParameterManager()
    param_manager.set_structure_parameters(
        wood_type='oak',
        joint_type='mortise_tenon',
        beam_width=0.05,
        beam_height=0.05,
        beam_length=0.3,
        tenon_length=0.03,
        tenon_width=0.02,
        mortise_depth=0.02,
        load_magnitude=500.0,
        load_direction='bending'
    )
    
    simulation = StressSimulation(param_manager)
    results = simulation.run_simulation()
    
    print("\n保存结果...")
    h5_path = simulation.save_results('data/example5_results.h5')
    print(f"  HDF5 结果: {h5_path}")
    
    param_path = 'data/example5_parameters.json'
    param_manager.save_parameters(param_path)
    print(f"  JSON 参数: {param_path}")
    
    print("\n加载结果...")
    loaded_results = StressSimulation.load_results(h5_path)
    print(f"  模拟ID: {loaded_results['simulation_id']}")
    print(f"  安全系数: {loaded_results['safety_factors']['overall']:.3f}")
    print(f"  最大应力: {loaded_results['max_stresses']['max_von_mises']/1e6:.2f} MPa")
    
    print("\n数据验证通过 ✓")
    
    return loaded_results


def run_all_examples():
    """运行所有示例"""
    print("\n" + "╔" + "=" * 58 + "╗")
    print("║" + "  榫卯结构受力模拟系统 - 示例演示".center(58) + "║")
    print("║" + "  Mortise & Tenon Simulation - Demo Examples".center(58) + "║")
    print("╚" + "=" * 58 + "╝")
    
    os.makedirs('data', exist_ok=True)
    
    try:
        example_1_basic_simulation()
        example_2_stress_visualization()
        example_3_parametric_study()
        example_4_joint_optimization()
        example_5_save_and_load()
        
        print("\n" + "=" * 60)
        print("所有示例运行完成!")
        print("All examples completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='榫卯结构模拟示例脚本')
    parser.add_argument('--example', type=int, default=0,
                       choices=[0, 1, 2, 3, 4, 5],
                       help='运行指定示例 (0=全部, 1-5=单个示例)')
    
    args = parser.parse_args()
    
    examples = {
        1: example_1_basic_simulation,
        2: example_2_stress_visualization,
        3: example_3_parametric_study,
        4: example_4_joint_optimization,
        5: example_5_save_and_load
    }
    
    if args.example == 0:
        run_all_examples()
    else:
        examples[args.example]()
