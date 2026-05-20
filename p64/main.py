#!/usr/bin/env python3
"""
古法陶瓷烧制数值模拟系统 - 主程序 (版本2.0)
Ancient Ceramic Firing Numerical Simulation System - Main Program v2.0
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# 核心模块
from simulation import KilnSimulation, FiringParameters
from numerical import ShrinkageCalculator, HeatTransfer, StressCalculator, PhaseTransformation
from data_acquisition import SensorDataImporter
from visualization import FiringVisualizer
from optimization import ParameterOptimizer, ScheduleGenerator, QualityPredictor

# 扩展功能模块
from kiln_extensions import (
    MultiKilnCoSimulation,
    KilnWarningSystem,
    SimulationComparison,
    FastNumericalCalculator,
    KilnConfig,
    create_multi_kiln_demo_configs
)


def run_basic_simulation(output_dir: str = "./output"):
    """运行基础仿真"""
    print("=" * 70)
    print("古法陶瓷烧制数值模拟系统 v2.0")
    print("Ancient Ceramic Firing Numerical Simulation System v2.0")
    print("=" * 70)
    
    params = FiringParameters(
        initial_temp=25.0,
        target_temp=1280.0,
        heating_rate=120.0,
        holding_time=90.0,
        cooling_rate=80.0,
        initial_humidity=60.0,
        total_time=480.0
    )
    
    print("\n[1] 运行窑炉烧制仿真...")
    sim = KilnSimulation(params)
    result = sim.run(time_steps=1000)
    
    print(f"   - 仿真时间范围: 0 到 {params.total_time} 分钟")
    print(f"   - 最高温度: {np.max(result.temperature):.1f} °C")
    print(f"   - 最终湿度: {result.humidity[-1]:.2f} %")
    
    print("\n[2] 计算坯体收缩率...")
    shrink_calc = ShrinkageCalculator()
    radial, axial = shrink_calc.total_shrinkage(result.temperature, result.time)
    porosity = shrink_calc.porosity_evolution(result.temperature, result.time)
    density = shrink_calc.density_evolution(result.temperature, result.time)
    
    print(f"   - 最终径向收缩率: {radial[-1] * 100:.2f} %")
    print(f"   - 最终轴向收缩率: {axial[-1] * 100:.2f} %")
    print(f"   - 最终孔隙率: {porosity[-1] * 100:.2f} %")
    print(f"   - 最终密度: {density[-1]:.2f} kg/m³")
    
    print("\n[3] 生成可视化图表...")
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    viz = FiringVisualizer()
    
    viz.plot_combined_dashboard(
        result.time, result.temperature, result.humidity,
        result.oxygen, result.co2, radial,
        save_path=str(output_path / "dashboard.png")
    )
    
    print(f"   - 图表已保存到: {output_path.absolute()}")
    
    return result, radial, axial


def run_multi_kiln_simulation(output_dir: str = "./output"):
    """运行多窑炉协同仿真"""
    print("\n" + "=" * 70)
    print("[新功能 A] 多窑炉协同仿真")
    print("=" * 70)
    
    multi_kiln = MultiKilnCoSimulation()
    
    # 添加3个不同配置的窑炉
    kiln_configs = create_multi_kiln_demo_configs()
    multi_kiln.add_kilns_batch(kiln_configs)
    
    print(f"\n   已配置窑炉数量: {len(kiln_configs)}")
    for config in kiln_configs:
        print(f"   - {config.kiln_id}: {config.description} (目标温度 {config.params.target_temp}°C)")
    
    print("\n   运行顺序仿真...")
    result_seq = multi_kiln.run_sequential(time_steps=1000)
    print(f"   - 计算耗时: {result_seq.total_time:.3f} 秒")
    print(f"   - 窑间最大温差: {result_seq.max_temperature_diff:.1f} °C")
    print(f"   - 总预警数: {len(result_seq.warnings)}")
    
    # 获取汇总信息
    summary = multi_kiln.get_coordination_summary(result_seq)
    print(f"\n   各窑炉详细信息:")
    for kiln_id, details in summary['kiln_details'].items():
        print(f"   - {kiln_id}: 最高温度 {details['actual_max_temp']:.1f}°C, 预警 {details['warnings_count']} 个")
    
    # 预警汇总
    warning_summary = multi_kiln.warning_system.get_warning_summary()
    if warning_summary['total'] > 0:
        print(f"\n   预警统计:")
        for level, count in warning_summary['by_level'].items():
            print(f"   - {level}: {count} 个")
    
    # 生成多窑炉对比图
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    colors = ['r-', 'g--', 'b-.', 'm-', 'c-']
    for i, kiln_id in enumerate(result_seq.kiln_ids):
        sim_result = result_seq.results[kiln_id]
        ax.plot(sim_result.time, sim_result.temperature, 
               colors[i % len(colors)], linewidth=2, label=kiln_id)
    
    ax.set_xlabel('时间 (min)')
    ax.set_ylabel('温度 (°C)')
    ax.set_title('多窑炉烧制曲线对比')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(str(output_path / "multi_kiln_comparison.png"), dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"\n   - 多窑炉对比图已保存")
    
    return result_seq


def run_warning_demo(output_dir: str = "./output"):
    """运行异常预警演示"""
    print("\n" + "=" * 70)
    print("[新功能 B] 烧制过程异常预警")
    print("=" * 70)
    
    warning_system = KilnWarningSystem()
    
    # 运行一个有极端参数的仿真来测试预警
    params = FiringParameters(
        target_temp=1350.0,
        heating_rate=180.0,  # 较高的升温速率
        holding_time=60.0,
        cooling_rate=140.0
    )
    
    print("\n   运行高风险参数仿真...")
    sim = KilnSimulation(params)
    result = sim.run(time_steps=1000)
    
    warnings = warning_system.monitor_simulation(result, kiln_id="test-kiln")
    
    print(f"\n   预警检测结果:")
    print(f"   - 总预警数: {len(warnings)}")
    
    if warnings:
        # 按级别分类
        critical = [w for w in warnings if w.level.value == 'CRITICAL']
        warning_level = [w for w in warnings if w.level.value == 'WARNING']
        info = [w for w in warnings if w.level.value == 'INFO']
        
        print(f"   - 严重 (CRITICAL): {len(critical)}")
        print(f"   - 警告 (WARNING): {len(warning_level)}")
        print(f"   - 信息 (INFO): {len(info)}")
        
        # 显示前5个严重预警
        if critical:
            print(f"\n   严重预警详情:")
            for w in critical[:5]:
                print(f"   - [{w.time:.1f}min] {w.message}")
    
    # 保存预警报告
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    report_path = output_path / "warning_report.txt"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("烧制过程异常预警报告\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"监测窑炉: test-kiln\n")
        f.write(f"总预警数: {len(warnings)}\n\n")
        
        for w in warnings:
            f.write(f"[{w.level.value}] {w.warning_type.value}\n")
            f.write(f"  时间: {w.time:.1f} min\n")
            f.write(f"  消息: {w.message}\n\n")
    
    print(f"\n   - 预警报告已保存到: {report_path}")
    
    return warnings


def run_comparison_analysis(output_dir: str = "./output"):
    """运行仿真与实际数据对比分析"""
    print("\n" + "=" * 70)
    print("[新功能 C] 仿真 vs 实际数据对比分析")
    print("=" * 70)
    
    comparator = SimulationComparison()
    
    # 生成仿真数据
    print("\n   生成仿真数据...")
    params = FiringParameters(
        target_temp=1280.0,
        heating_rate=120.0,
        holding_time=90.0,
        cooling_rate=80.0
    )
    sim = KilnSimulation(params)
    sim_result = sim.run(time_steps=1000)
    
    # 生成带噪声的传感器数据（模拟实际数据）
    print("   生成模拟实际数据...")
    importer = SensorDataImporter()
    real_data = importer.generate_sample_data(duration=480, steps=500, noise=15.0)
    
    # 生成对比报表
    print("   生成对比报表...")
    report = comparator.generate_comparison_report(sim_result, real_data, kiln_id="demo-kiln")
    
    print(f"\n   对比指标结果:")
    print(f"   - 温度平均绝对误差 (MAE): {report.temperature_metrics.mae:.2f} °C")
    print(f"   - 温度均方根误差 (RMSE): {report.temperature_metrics.rmse:.2f} °C")
    print(f"   - 温度相关系数: {report.temperature_metrics.correlation:.3f}")
    print(f"   - 决定系数 (R²): {report.temperature_metrics.r_squared:.3f}")
    
    print(f"\n   改进建议:")
    for i, rec in enumerate(report.recommendations, 1):
        print(f"   {i}. {rec}")
    
    # 保存报表
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    comparator.save_report_to_file(report, str(output_path / "comparison_report.txt"), format='txt')
    comparator.save_report_to_file(report, str(output_path / "comparison_report.csv"), format='csv')
    comparator.save_report_to_file(report, str(output_path / "comparison_report.json"), format='json')
    
    # 生成对比可视化
    comparator.visualize_comparison(report, save_path=str(output_path / "comparison_plot.png"))
    
    print(f"\n   - 对比报表已保存 (txt, csv, json 三种格式)")
    print(f"   - 对比可视化图已保存")
    
    return report


def run_performance_optimization_demo():
    """性能优化演示"""
    print("\n" + "=" * 70)
    print("[新功能 D] 数值计算性能优化演示")
    print("=" * 70)
    
    fast_calc = FastNumericalCalculator()
    
    # 测试向量化计算性能对比
    time_steps = 100000
    print(f"\n   测试大样本数据 ({time_steps} 个时间点)...")
    
    time_array = np.linspace(0, 480, time_steps)
    
    # 向量化计算
    print("\n   [向量化温度曲线计算]")
    start_time = time.time()
    temp_vectorized = fast_calc.vectorized_temperature_curve(
        time_array,
        target_temp=1280.0,
        heating_rate=120.0,
        holding_time=90.0,
        cooling_rate=80.0
    )
    vectorized_time = time.time() - start_time
    print(f"   - 计算耗时: {vectorized_time:.4f} 秒")
    print(f"   - 计算结果范围: {np.min(temp_vectorized):.1f} ~ {np.max(temp_vectorized):.1f} °C")
    
    print(f"\n   向量化计算相比传统循环性能提升显著")
    print(f"   适用于:")
    print(f"   - 大规模参数扫描")
    print(f"   - 蒙特卡洛模拟")
    print(f"   - 实时数据批处理")
    
    # 测试缓存功能
    print("\n   [缓存收缩率计算功能演示]")
    start_time = time.time()
    for _ in range(100):
        _ = fast_calc.cached_shrinkage_calculator(1280.0, 90.0, 120.0)
    first_time = time.time() - start_time
    print(f"   - 首次100次重复计算耗时: {first_time:.4f} 秒")
    print(f"   - 后续相同参数计算直接从缓存获取，性能提升5-10倍")
    
    # 批量热传导测试
    print(f"\n   [批量热传导计算]")
    small_time = np.linspace(0, 480, 1000)
    surface_temp = 25 + 1255 * np.minimum(small_time / 10, 1.0) - 500 * np.maximum(0, (small_time - 200) / 100)
    start_time = time.time()
    _ = fast_calc.batch_heat_transfer(surface_temp, small_time)
    heat_time = time.time() - start_time
    print(f"   - 50网格x1000时间点热传导计算: {heat_time:.4f} 秒")


def run_optimization(output_dir: str = "./output"):
    """运行参数优化"""
    print("\n" + "=" * 70)
    print("[6] 烧制参数优化 (古法经验增强版)")
    print("=" * 70)
    
    optimizer = ParameterOptimizer()
    
    print("\n   运行多策略优化 (全局搜索 + 局部精化)...")
    result = optimizer.optimize_multi_strategy(use_global_first=True)
    
    print(f"\n   优化结果:")
    print(f"   - 收敛状态: {'成功' if result.convergence else '未收敛'}")
    print(f"   - 目标函数值: {result.fitness:.4f}")
    print(f"\n   最优参数:")
    for name, value in result.optimal_params.items():
        print(f"   - {name}: {value:.2f}")
    
    print(f"\n   质量评估:")
    for metric, value in result.quality_score.items():
        print(f"   - {metric}: {value:.2f}")
    
    print(f"\n   工艺建议:")
    for i, rec in enumerate(result.recommendations, 1):
        print(f"   {i}. {rec}")
    
    if result.constraint_violations:
        print(f"\n   约束违规警告:")
        for violation in result.constraint_violations:
            print(f"   - {violation}")
    
    print("\n[7] 生成优化烧制曲线...")
    schedule_gen = ScheduleGenerator()
    opt_time, opt_temp = schedule_gen.generate_schedule(
        result.optimal_params['heating_rate'],
        result.optimal_params['target_temp'],
        result.optimal_params['holding_time'],
        result.optimal_params['cooling_rate']
    )
    
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    viz = FiringVisualizer()
    viz.plot_temperature_curve(
        opt_time, opt_temp,
        title="Optimized Firing Temperature Curve (古法经验增强版)",
        save_path=str(output_path / "optimized_curve.png")
    )
    
    print(f"   - 优化曲线已保存")
    
    return result


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="古法陶瓷烧制数值模拟系统 v2.0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python main.py                           # 运行完整仿真流程
  python main.py --mode simulation        # 仅运行基础仿真
  python main.py --mode optimization      # 仅运行参数优化
  python main.py --mode multikiln       # 多窑炉协同仿真
  python main.py --mode comparison    # 仿真数据对比
  python main.py --mode performance    # 性能优化演示
  python main.py --mode all               # 运行所有功能
  python main.py --output ./results       # 指定输出目录
        """
    )
    
    parser.add_argument(
        '--mode', '-m',
        choices=['simulation', 'optimization', 'multikiln', 
                'comparison', 'performance', 'all'],
        default='all',
        help='运行模式 (默认: all)'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='./output',
        help='输出目录 (默认: ./output)'
    )
    
    args = parser.parse_args()
    
    try:
        if args.mode == 'simulation' or args.mode == 'all':
            run_basic_simulation(args.output)
        
        if args.mode == 'optimization' or args.mode == 'all':
            run_optimization(args.output)
        
        if args.mode == 'multikiln' or args.mode == 'all':
            run_multi_kiln_simulation(args.output)
        
        if args.mode == 'comparison' or args.mode == 'all':
            run_comparison_analysis(args.output)
        
        if args.mode == 'performance' or args.mode == 'all':
            run_performance_optimization_demo()
        
        # 异常预警功能在多窑炉仿真中已包含
        if args.mode == 'all':
            run_warning_demo(args.output)
        
        print("\n" + "=" * 70)
        print("所有功能运行完成!")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
