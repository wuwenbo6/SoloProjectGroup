#!/usr/bin/env python3
"""
刺绣针法张力模拟系统 - 主程序入口
"""

import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'src'))

from tension_simulator import TensionSimulator, StitchType
from stitch_acquisition import StitchAcquisition
from numerical_computation import NumericalComputation
from visualization import Visualization
from parameter_optimization import ParameterOptimization
from data_storage import DataStorage


def run_basic_simulation(args):
    """运行基础模拟"""
    print("=" * 60)
    print("运行刺绣张力基础模拟")
    print("=" * 60)
    
    simulator = TensionSimulator(sample_rate=args.sample_rate)
    
    time, tension = simulator.simulate_stitch_tension(
        stitch_type=args.stitch_type,
        thread_type=args.thread_type,
        base_tension=args.base_tension,
        stitch_count=args.stitch_count
    )
    
    print(f"\n模拟完成:")
    print(f"  针法类型: {args.stitch_type}")
    print(f"  丝线类型: {args.thread_type}")
    print(f"  基础张力: {args.base_tension} N")
    print(f"  针数: {args.stitch_count}")
    print(f"  采样点数: {len(tension)}")
    
    metrics = simulator.calculate_tension_metrics(tension)
    print(f"\n张力统计:")
    print(f"  均值: {metrics['mean']:.4f} N")
    print(f"  标准差: {metrics['std']:.4f} N")
    print(f"  最大值: {metrics['max']:.4f} N")
    print(f"  最小值: {metrics['min']:.4f} N")
    print(f"  变异系数: {metrics['cv']:.4f}")
    
    safety = simulator.check_tension_safety(args.thread_type, tension)
    print(f"\n安全性检查:")
    print(f"  安全: {'是' if safety['safe'] else '否'}")
    print(f"  安全系数: {safety['safety_factor']:.4f}")
    
    storage = DataStorage()
    dataset_name = storage.save_simulation_result(
        time, tension,
        params={
            'stitch_type': args.stitch_type,
            'thread_type': args.thread_type,
            'base_tension': args.base_tension,
            'stitch_count': args.stitch_count
        }
    )
    print(f"\n结果已保存: {dataset_name}")
    
    if not args.no_plot:
        viz = Visualization(output_dir=args.output_dir)
        viz.plot_tension_time_series(time, tension, 
            title=f"Tension Simulation - {args.stitch_type}",
            filename=f"tension_{args.stitch_type}_{args.thread_type}.png"
        )
        print(f"图表已保存到: {args.output_dir}/")
    
    return time, tension


def run_parameter_optimization(args):
    """运行参数优化"""
    print("=" * 60)
    print("刺绣张力参数优化")
    print("=" * 60)
    
    simulator = TensionSimulator(sample_rate=args.sample_rate)
    
    def simulation_wrapper(base_tension):
        return simulator.simulate_stitch_tension(
            stitch_type=args.stitch_type,
            thread_type=args.thread_type,
            base_tension=base_tension,
            stitch_count=50
        )
    
    optimizer = ParameterOptimization()
    optimizer.set_bounds('base_tension', args.min_tension, args.max_tension)
    optimizer.set_target_tension(args.target_tension)
    
    print(f"\n优化参数:")
    print(f"  目标张力: {args.target_tension} N")
    print(f"  搜索范围: [{args.min_tension}, {args.max_tension}] N")
    print(f"  优化方法: {args.optim_method}")
    
    if args.optim_method == 'differential_evolution':
        result = optimizer.optimize_differential_evolution(
            simulation_wrapper, objective_type='mse'
        )
    elif args.optim_method == 'grid_search':
        result = optimizer.optimize_grid_search(
            simulation_wrapper, objective_type='mse'
        )
    elif args.optim_method == 'random':
        result = optimizer.optimize_random_search(
            simulation_wrapper, objective_type='mse'
        )
    else:
        result = optimizer.optimize_gradient_based(
            simulation_wrapper, objective_type='mse'
        )
    
    print(f"\n优化结果:")
    print(f"  最佳基础张力: {result.best_params['base_tension']:.4f} N")
    print(f"  最佳适应度: {result.best_fitness:.6f}")
    print(f"  成功: {'是' if result.success else '否'}")
    print(f"  消息: {result.message}")
    
    validation = optimizer.validate_optimization_result(result, simulation_wrapper)
    print(f"\n验证结果:")
    print(f"  平均张力: {validation['mean_tension']:.4f} N")
    print(f"  稳定性: {validation['stability']}")
    
    return result


def run_stitch_comparison(args):
    """运行不同针法对比"""
    print("=" * 60)
    print("不同针法张力对比")
    print("=" * 60)
    
    simulator = TensionSimulator(sample_rate=args.sample_rate)
    stitch_types = ['satin', 'chain', 'fill', 'outline']
    
    tension_data = []
    labels = []
    
    for stitch_type in stitch_types:
        time, tension = simulator.simulate_stitch_tension(
            stitch_type=stitch_type,
            thread_type=args.thread_type,
            base_tension=args.base_tension,
            stitch_count=args.stitch_count
        )
        tension_data.append(tension)
        labels.append(stitch_type)
        
        mean_t = np.mean(tension)
        cv_t = np.std(tension) / mean_t
        print(f"  {stitch_type:10s}: 均值={mean_t:.4f} N, CV={cv_t:.4f}")
    
    if not args.no_plot:
        viz = Visualization(output_dir=args.output_dir)
        viz.plot_stitch_type_comparison(
            stitch_types, tension_data,
            title="Stitch Type Tension Comparison",
            filename="stitch_comparison.png"
        )
        print(f"\n对比图表已保存")
    
    return tension_data


def run_sensitivity_analysis(args):
    """运行灵敏度分析"""
    print("=" * 60)
    print("参数灵敏度分析")
    print("=" * 60)
    
    simulator = TensionSimulator(sample_rate=50)
    
    def simulation_wrapper(base_tension):
        return simulator.simulate_stitch_tension(
            stitch_type='fill',
            thread_type='silk_120D',
            base_tension=base_tension,
            stitch_count=30
        )
    
    optimizer = ParameterOptimization()
    optimizer.set_bounds('base_tension', 0.5, 3.0)
    
    base_params = {'base_tension': 1.5}
    sensitivity = optimizer.sensitivity_analysis(
        simulation_wrapper, base_params, param_range=0.5, n_points=30
    )
    
    print(f"\n参数: base_tension")
    print(f"  范围: [{sensitivity['base_tension']['values'][0]:.2f}, {sensitivity['base_tension']['values'][-1]:.2f}] N")
    print(f"  平均张力变化范围: [{np.min(sensitivity['base_tension']['mean_tension']):.4f}, {np.max(sensitivity['base_tension']['mean_tension']):.4f}] N")
    
    if not args.no_plot:
        import matplotlib.pyplot as plt
        viz = Visualization(output_dir=args.output_dir)
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))
        
        values = sensitivity['base_tension']['values']
        mean_t = sensitivity['base_tension']['mean_tension']
        cv = sensitivity['base_tension']['cv']
        
        ax1.plot(values, mean_t, 'b-', linewidth=2)
        ax1.set_ylabel('Mean Tension (N)')
        ax1.set_title('Sensitivity Analysis - Mean Tension')
        ax1.grid(True)
        
        ax2.plot(values, cv, 'r-', linewidth=2)
        ax2.set_xlabel('Base Tension (N)')
        ax2.set_ylabel('CV')
        ax2.set_title('Sensitivity Analysis - Coefficient of Variation')
        ax2.grid(True)
        
        plt.tight_layout()
        plt.savefig(f"{args.output_dir}/sensitivity_analysis.png", dpi=300)
        print(f"\n灵敏度分析图表已保存")
    
    return sensitivity


def list_datasets(args):
    """列出所有保存的数据集"""
    storage = DataStorage()
    datasets = storage.list_datasets()
    
    print("=" * 60)
    print("保存的数据集")
    print("=" * 60)
    
    if not datasets:
        print("  没有找到数据集")
        return
    
    for ds in datasets:
        info = storage.get_dataset_info(ds)
        print(f"\n  {ds}:")
        print(f"    采样点数: {info['n_samples']}")
        print(f"    时间范围: [{info['time_range'][0]:.2f}, {info['time_range'][1]:.2f}] s")
        print(f"    张力范围: [{info['tension_range'][0]:.4f}, {info['tension_range'][1]:.4f}] N")


def load_config(args):
    """从配置文件运行模拟"""
    print(f"加载配置文件: {args.config}")
    
    acquisition = StitchAcquisition()
    params = acquisition.load_from_json(args.config)
    
    print("配置参数:")
    for key, value in params.items():
        print(f"  {key}: {value}")
    
    return params


def create_template_config(args):
    """创建模板配置文件"""
    acquisition = StitchAcquisition()
    path = acquisition.create_template_config(args.output)
    print(f"模板配置文件已创建: {path}")


def main():
    parser = argparse.ArgumentParser(
        description='刺绣针法张力模拟系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  %(prog)s simulate                             # 运行基础模拟
  %(prog)s optimize --target-tension 1.5       # 运行参数优化
  %(prog)s compare                              # 运行针法对比
  %(prog)s sensitivity                          # 运行灵敏度分析
  %(prog)s list                                 # 列出保存的数据集
  %(prog)s template --output my_config.json     # 创建模板配置
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    sim_parser = subparsers.add_parser('simulate', help='运行基础模拟')
    sim_parser.add_argument('--stitch-type', default='fill',
                          choices=['satin', 'chain', 'fill', 'outline'],
                          help='针法类型')
    sim_parser.add_argument('--thread-type', default='silk_120D',
                          choices=['silk_120D', 'silk_240D', 'cotton_30s'],
                          help='丝线类型')
    sim_parser.add_argument('--base-tension', type=float, default=1.0,
                          help='基础张力 (N)')
    sim_parser.add_argument('--stitch-count', type=int, default=100,
                          help='针数')
    sim_parser.add_argument('--sample-rate', type=int, default=100,
                          help='采样率')
    sim_parser.add_argument('--output-dir', default='./output',
                          help='输出目录')
    sim_parser.add_argument('--no-plot', action='store_true',
                          help='不生成图表')
    
    opt_parser = subparsers.add_parser('optimize', help='参数优化')
    opt_parser.add_argument('--stitch-type', default='fill',
                          choices=['satin', 'chain', 'fill', 'outline'],
                          help='针法类型')
    opt_parser.add_argument('--thread-type', default='silk_120D',
                          choices=['silk_120D', 'silk_240D', 'cotton_30s'],
                          help='丝线类型')
    opt_parser.add_argument('--target-tension', type=float, default=1.5,
                          help='目标张力 (N)')
    opt_parser.add_argument('--min-tension', type=float, default=0.5,
                          help='最小搜索张力 (N)')
    opt_parser.add_argument('--max-tension', type=float, default=3.0,
                          help='最大搜索张力 (N)')
    opt_parser.add_argument('--optim-method', default='differential_evolution',
                          choices=['differential_evolution', 'gradient', 'grid_search', 'random'],
                          help='优化方法')
    opt_parser.add_argument('--sample-rate', type=int, default=50,
                          help='采样率')
    
    comp_parser = subparsers.add_parser('compare', help='针法对比')
    comp_parser.add_argument('--thread-type', default='silk_120D',
                           choices=['silk_120D', 'silk_240D', 'cotton_30s'],
                           help='丝线类型')
    comp_parser.add_argument('--base-tension', type=float, default=1.0,
                           help='基础张力 (N)')
    comp_parser.add_argument('--stitch-count', type=int, default=50,
                           help='针数')
    comp_parser.add_argument('--sample-rate', type=int, default=50,
                           help='采样率')
    comp_parser.add_argument('--output-dir', default='./output',
                           help='输出目录')
    comp_parser.add_argument('--no-plot', action='store_true',
                           help='不生成图表')
    
    sens_parser = subparsers.add_parser('sensitivity', help='灵敏度分析')
    sens_parser.add_argument('--sample-rate', type=int, default=50,
                           help='采样率')
    sens_parser.add_argument('--output-dir', default='./output',
                           help='输出目录')
    sens_parser.add_argument('--no-plot', action='store_true',
                           help='不生成图表')
    
    subparsers.add_parser('list', help='列出保存的数据集')
    
    config_parser = subparsers.add_parser('config', help='从配置文件运行')
    config_parser.add_argument('--config', required=True, help='配置文件路径')
    
    template_parser = subparsers.add_parser('template', help='创建模板配置')
    template_parser.add_argument('--output', default='./config_template.json',
                                help='输出文件路径')
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return
    
    import numpy as np
    
    commands = {
        'simulate': run_basic_simulation,
        'optimize': run_parameter_optimization,
        'compare': run_stitch_comparison,
        'sensitivity': run_sensitivity_analysis,
        'list': list_datasets,
        'config': load_config,
        'template': create_template_config
    }
    
    if args.command in commands:
        try:
            commands[args.command](args)
        except Exception as e:
            print(f"\n错误: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == '__main__':
    main()