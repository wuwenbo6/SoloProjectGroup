#!/usr/bin/env python3
"""
榫卯结构受力模拟系统 - 主入口
Mortise and Tenon Joint Stress Simulation System - Main Entry
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parameters import ParameterManager
from simulation import StressSimulation
from visualization import ResultsVisualizer
from optimization import JointOptimizer


def run_basic_simulation():
    print("=" * 60)
    print("榫卯结构受力模拟系统")
    print("Mortise and Tenon Joint Stress Simulation")
    print("=" * 60)
    print()
    
    param_manager = ParameterManager()
    
    print("设置模拟参数...")
    print("-" * 60)
    
    params = param_manager.set_structure_parameters(
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
    
    errors = param_manager.validate_parameters()
    if errors:
        print("参数警告/错误:")
        for error in errors:
            print(f"  - {error}")
    else:
        print("参数验证通过 ✓")
    
    print()
    print("运行受力模拟...")
    print("-" * 60)
    
    simulation = StressSimulation(param_manager)
    results = simulation.run_simulation()
    
    print()
    print(simulation.get_summary())
    print()
    
    print("保存模拟结果...")
    h5_path = simulation.save_results()
    print(f"结果已保存至: {h5_path}")
    
    params_path = os.path.join(os.path.dirname(h5_path), 
                               f"params_{results['simulation_id']}.json")
    param_manager.save_parameters(params_path)
    print(f"参数已保存至: {params_path}")
    
    print()
    print("生成可视化报告...")
    print("-" * 60)
    
    visualizer = ResultsVisualizer(results)
    report_dir = visualizer.generate_report()
    print(f"可视化报告已生成至: {report_dir}")
    
    return results, param_manager, simulation


def run_parametric_study():
    print("\n" + "=" * 60)
    print("参数化研究")
    print("Parametric Study")
    print("=" * 60)
    print()
    
    param_manager = ParameterManager()
    param_manager.set_structure_parameters(
        wood_type='pine',
        joint_type='mortise_tenon',
        beam_width=0.05,
        beam_height=0.05,
        beam_length=0.3,
        tenon_length=0.03,
        tenon_width=0.02,
        mortise_depth=0.02,
        load_magnitude=800.0,
        load_direction='shear'
    )
    
    simulation = StressSimulation(param_manager)
    
    print("研究榫头长度对结构性能的影响...")
    param_name = 'tenon_length'
    study_results = simulation.run_parametric_study(
        param_name=param_name,
        start=0.01,
        end=0.08,
        num_points=15
    )
    
    print(f"完成 {len(study_results)} 次模拟")
    
    visualizer = ResultsVisualizer(study_results[-1])
    study_plot_path = os.path.join(
        os.path.dirname(__file__), 
        'data', 
        'reports',
        'parametric_study.png'
    )
    os.makedirs(os.path.dirname(study_plot_path), exist_ok=True)
    visualizer.plot_parametric_study(study_results, param_name, 
                                    save_path=study_plot_path, show=False)
    print(f"参数化研究图表已保存至: {study_plot_path}")
    
    return study_results


def run_optimization():
    print("\n" + "=" * 60)
    print("参数优化")
    print("Parameter Optimization")
    print("=" * 60)
    print()
    
    param_manager = ParameterManager()
    param_manager.set_structure_parameters(
        wood_type='oak',
        joint_type='mortise_tenon',
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
    
    print("运行贝叶斯优化...")
    print("-" * 60)
    
    optimizer = JointOptimizer(param_manager, simulation)
    
    opt_results = optimizer.optimize(
        method='random',
        param_names=['tenon_length', 'tenon_width', 'mortise_depth'],
        n_iterations=30,
        weights={'safety_factor': 0.5, 'deformation': 0.3, 'stress': 0.2}
    )
    
    print()
    print(optimizer.get_optimization_summary())
    print()
    
    print("保存优化结果...")
    opt_plot_path = os.path.join(
        os.path.dirname(__file__),
        'data', 'reports', 'optimization_convergence.png')
    os.makedirs(os.path.dirname(opt_plot_path), exist_ok=True)
    optimizer.plot_convergence(save_path=opt_plot_path, show=False)
    print(f"收敛曲线已保存至: {opt_plot_path}")
    
    compare_plot_path = os.path.join(
        os.path.dirname(__file__),
        'data', 'reports', 'optimization_comparison.png')
    optimizer.compare_before_after(save_path=compare_plot_path, show=False)
    print(f"对比图已保存至: {compare_plot_path}")
    
    return opt_results


def load_existing_results(h5_path: str):
    print(f"\n加载已有结果: {h5_path}")
    
    results = StressSimulation.load_results(h5_path)
    
    print("\n加载的模拟结果:")
    print(f"  模拟ID: {results['simulation_id']}")
    print(f"  木材类型: {results['parameters']['wood_type']}")
    print(f"  榫卯类型: {results['parameters']['joint_type']}")
    print(f"  安全系数: {results['safety_factors']['overall']:.3f}")
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description='榫卯结构受力模拟系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py                    # 运行完整流程
  python main.py --mode simulation      # 仅运行基础模拟
  python main.py --mode study       # 运行参数化研究
  python main.py --mode optimize    # 运行参数优化
  python main.py --load results.h5    # 加载已有结果
        """
    )
    
    parser.add_argument('--mode', type=str, default='all',
                       choices=['all', 'simulation', 'study', 'optimize'],
                       help='运行模式')
    parser.add_argument('--load', type=str, default=None,
                       help='加载已有的HDF5结果文件')
    parser.add_argument('--wood', type=str, default='oak',
                       help='木材类型: pine, oak, rosewood')
    parser.add_argument('--joint', type=str, default='mortise_tenon',
                       help='榫卯类型')
    parser.add_argument('--load-dir', type=str, default=None,
                       help='受力方向: axial, shear, bending, torsion')
    parser.add_argument('--force', type=float, default=1000.0,
                       help='载荷大小 (N)')
    
    args = parser.parse_args()
    
    if args.load:
        load_existing_results(args.load)
        return
    
    if args.mode == 'all' or args.mode == 'simulation':
        results, param_manager, simulation = run_basic_simulation()
    
    if args.mode == 'all' or args.mode == 'study':
        run_parametric_study()
    
    if args.mode == 'all' or args.mode == 'optimize':
        run_optimization()
    
    print("\n" + "=" * 60)
    print("所有任务完成!")
    print("All tasks completed!")
    print("=" * 60)


if __name__ == '__main__':
    main()
