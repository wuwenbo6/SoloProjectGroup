#!/usr/bin/env python3
"""
传统陶瓷烧制过程数值模拟系统
=================================
基于 NumPy、SciPy 实现的陶瓷烧制仿真平台
"""

import os
import json
import argparse
import numpy as np

from src.simulation import KilnSimulation
from src.data_acquisition import SensorDataImporter, KilnDataProcessor
from src.visualization import ResultVisualizer
from src.optimization import ParameterOptimizer, ObjectiveFunction, QualityMetrics
from src.multi_kiln import MultiKilnCoordinator
from src.anomaly_detection import AnomalyDetector, RealTimeMonitor
from src.comparison import SimulationComparator
from src.fast_numerical import PerformanceProfiler, MemoryOptimizer


def run_simulation(config_path: str = None, output_dir: str = 'results'):
    """运行陶瓷烧制仿真"""
    print("=" * 60)
    print("开始运行陶瓷烧制仿真")
    print("=" * 60)

    sim = KilnSimulation()

    if config_path and os.path.exists(config_path):
        print(f"加载配置文件: {config_path}")
        sim.load_config(config_path)
    else:
        print("使用默认配置")

    print("\n运行仿真中...")
    results = sim.run()
    print("仿真完成!")

    os.makedirs(output_dir, exist_ok=True)

    results_path = os.path.join(output_dir, 'simulation_results.h5')
    sim.save_results(results_path)
    print(f"结果已保存: {results_path}")

    config_save_path = os.path.join(output_dir, 'used_config.json')
    sim.save_config(config_save_path)
    print(f"配置已保存: {config_save_path}")

    print("\n" + "=" * 60)
    print("生成可视化图表...")
    print("=" * 60)

    visualizer = ResultVisualizer(results)
    plot_paths = visualizer.generate_all_plots(output_dir)

    for name, path in plot_paths.items():
        print(f"  {name}: {path}")

    visualizer.close_all()

    print("\n" + "=" * 60)
    print("质量指标评估")
    print("=" * 60)

    metrics = QualityMetrics.summary(results)
    for key, value in metrics.items():
        print(f"  {key}: {value:.4f}")

    metrics_path = os.path.join(output_dir, 'quality_metrics.json')
    with open(metrics_path, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=4, ensure_ascii=False)
    print(f"质量指标已保存: {metrics_path}")

    print("\n仿真流程已完成!")
    return sim, results


def run_optimization(config_path: str = None, output_dir: str = 'results'):
    """运行参数优化"""
    print("=" * 60)
    print("开始烧制参数优化")
    print("=" * 60)

    base_sim = KilnSimulation()

    if config_path and os.path.exists(config_path):
        print(f"加载基准配置文件: {config_path}")
        base_sim.load_config(config_path)

    target_profile = base_sim.config['temperature_profile']
    objective = ObjectiveFunction(target_profile)

    optimizer = ParameterOptimizer(base_sim.config)
    optimizer.set_objective(objective)

    print("\n优化温度曲线参数...")
    best_config, best_score = optimizer.optimize_temperature_profile(n_iterations=30)

    print(f"\n优化完成，最佳得分: {best_score:.4f}")

    os.makedirs(output_dir, exist_ok=True)

    opt_results_path = os.path.join(output_dir, 'optimization_results.json')
    optimizer.save_optimization_results(opt_results_path)
    print(f"优化结果已保存: {opt_results_path}")

    best_config_path = os.path.join(output_dir, 'best_config.json')
    with open(best_config_path, 'w', encoding='utf-8') as f:
        json.dump(best_config, f, indent=4, ensure_ascii=False)
    print(f"最佳配置已保存: {best_config_path}")

    print("\n使用最佳配置运行验证仿真...")
    best_sim = KilnSimulation(best_config)
    best_results = best_sim.run()

    best_sim_path = os.path.join(output_dir, 'best_simulation.h5')
    best_sim.save_results(best_sim_path)
    print(f"最佳仿真结果已保存: {best_sim_path}")

    print("\n参数优化流程已完成!")
    return best_config, best_results


def import_sensor_data(sensor_path: str, output_dir: str = 'results'):
    """导入并处理传感器数据"""
    print("=" * 60)
    print("处理传感器数据")
    print("=" * 60)

    if not os.path.exists(sensor_path):
        raise FileNotFoundError(f"传感器数据文件不存在: {sensor_path}")

    print(f"加载传感器数据: {sensor_path}")

    processor = KilnDataProcessor()

    if sensor_path.endswith('.csv'):
        processed_data = processor.load_and_process(sensor_path, 'csv')
    elif sensor_path.endswith('.json'):
        processed_data = processor.load_and_process(sensor_path, 'json')
    else:
        raise ValueError("不支持的文件格式，请使用 .csv 或 .json")

    print(f"处理完成，可用参数: {list(processed_data.keys())}")

    os.makedirs(output_dir, exist_ok=True)

    processed_path = os.path.join(output_dir, 'processed_sensor_data.json')
    processor.save_processed_data(processed_path)
    print(f"处理后数据已保存: {processed_path}")

    extracted_profile = processor.extract_temperature_profile()
    profile_path = os.path.join(output_dir, 'extracted_temperature_profile.json')
    with open(profile_path, 'w', encoding='utf-8') as f:
        json.dump(extracted_profile, f, indent=4, ensure_ascii=False)
    print(f"提取的温度曲线已保存: {profile_path}")

    print("\n传感器数据处理完成!")
    return processed_data


def run_comparison(simulation_path: str, sensor_data_path: str,
                    output_dir: str = 'results'):
    """对比仿真结果与实测数据"""
    print("=" * 60)
    print("仿真与实测数据对比")
    print("=" * 60)

    sim = KilnSimulation()
    results = sim.load_results(simulation_path)
    print(f"加载仿真结果: {simulation_path}")

    processor = KilnDataProcessor()
    if sensor_data_path.endswith('.csv'):
        sensor_data = processor.load_and_process(sensor_data_path, 'csv')
    else:
        sensor_data = processor.load_and_process(sensor_data_path, 'json')
    print(f"加载传感器数据: {sensor_data_path}")

    visualizer = ResultVisualizer(results)
    os.makedirs(output_dir, exist_ok=True)
    comparison_path = os.path.join(output_dir, 'comparison.png')
    visualizer.plot_comparison(sensor_data, save_path=comparison_path)
    visualizer.close_all()

    print(f"对比图已保存: {comparison_path}")
    print("\n对比分析完成!")


def generate_sample_config(output_path: str = 'config/sample_config.json'):
    """生成示例配置文件"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    config = {
        'simulation': {
            'total_time': 86400,
            'time_step': 60,
            'geometry': {
                'thickness': 0.1,
                'num_nodes': 21
            }
        },
        'material': {
            'density': 2300.0,
            'specific_heat': 850.0,
            'thermal_conductivity': 1.5,
            'organic_content': 0.05,
            'water_content': 0.08
        },
        'kiln': {
            'heat_transfer_coeff': 25.0,
            'volume': 1.0
        },
        'temperature_profile': [
            [0, 293.15],
            [3600, 373.15],
            [7200, 473.15],
            [10800, 573.15],
            [14400, 673.15],
            [18000, 873.15],
            [21600, 1073.15],
            [25200, 1273.15],
            [28800, 1473.15],
            [32400, 1523.15],
            [39600, 1523.15],
            [43200, 1473.15],
            [50400, 1273.15],
            [57600, 873.15],
            [64800, 473.15],
            [72000, 298.15]
        ],
        'humidity_profile': [
            [0, 0.015],
            [3600, 0.012],
            [7200, 0.008],
            [10800, 0.005],
            [14400, 0.002],
            [21600, 0.001]
        ]
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=4, ensure_ascii=False)

    print(f"示例配置文件已生成: {output_path}")
    return config


def generate_sample_sensor_data(output_path: str = 'data/sample_sensor.csv'):
    """生成示例传感器数据"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    time = np.arange(0, 86401, 300)

    temp_profile = [
        (0, 293.15),
        (3600, 373.15),
        (10800, 573.15),
        (18000, 873.15),
        (28800, 1273.15),
        (36000, 1523.15),
        (43200, 1523.15),
        (50400, 1273.15),
        (64800, 298.15)
    ]

    from scipy.interpolate import interp1d
    t_points = [p[0] for p in temp_profile]
    temp_points = [p[1] for p in temp_profile]
    f_temp = interp1d(t_points, temp_points, kind='linear', fill_value='extrapolate')

    temperature = f_temp(time) + np.random.normal(0, 2, len(time))
    humidity = 50 * np.exp(-time / 10000) + np.random.normal(0, 1, len(time))

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('time,temperature,humidity\n')
        for t, temp, hum in zip(time, temperature, humidity):
            f.write(f'{t},{temp:.2f},{hum:.2f}\n')

    print(f"示例传感器数据已生成: {output_path}")


def run_multi_kiln_simulation(num_kilns: int = 3, output_dir: str = 'results'):
    """运行多窑炉协同仿真"""
    print("=" * 60)
    print("多窑炉协同模拟")
    print("=" * 60)

    coordinator = MultiKilnCoordinator(total_power=2000.0, exhaust_capacity=150.0)

    base_config = KilnSimulation().config

    for i in range(num_kilns):
        kiln_config = base_config.copy()
        kiln_config['kiln_id'] = f'kiln_{i + 1}'
        start_time = i * 18000
        coordinator.add_kiln(f'kiln_{i + 1}', kiln_config, start_time=start_time)
        print(f"添加窑炉 {i + 1}: 启动时间 {start_time / 3600:.1f} 小时")

    print("\n运行协同仿真...")
    total_time = num_kilns * 18000 + 86400
    results = coordinator.run_coordinated_simulation(total_time=total_time)

    os.makedirs(output_dir, exist_ok=True)

    results_path = os.path.join(output_dir, 'multi_kiln_results.json')
    coordinator.save_results(results_path)
    print(f"多窑炉结果已保存: {results_path}")

    report = coordinator.generate_schedule_report()
    report_path = os.path.join(output_dir, 'schedule_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"调度报告已保存: {report_path}")

    print(f"\n能耗统计: 峰值 {report['energy_efficiency']['peak_power_kw']:.1f} kW")
    print(f"总能耗: {report['energy_efficiency']['average_power_kw']:.1f} kWh")

    return results


def run_anomaly_detection(simulation_path: str, output_dir: str = 'results'):
    """运行异常检测"""
    print("=" * 60)
    print("烧制过程异常预警检测")
    print("=" * 60)

    sim = KilnSimulation()
    results = sim.load_results(simulation_path)
    print(f"加载仿真结果: {simulation_path}")

    detector = AnomalyDetector()
    anomalies = detector.detect_from_results(results)

    print(f"\n发现异常事件: {len(anomalies)} 个")

    by_level = {}
    for anomaly in anomalies:
        level = anomaly.level.name
        by_level[level] = by_level.get(level, 0) + 1

    for level, count in by_level.items():
        print(f"  {level}: {count} 个")

    os.makedirs(output_dir, exist_ok=True)

    anomalies_path = os.path.join(output_dir, 'anomalies.json')
    detector.export_anomalies(anomalies_path)
    print(f"异常报告已保存: {anomalies_path}")

    summary = detector.get_anomaly_summary()
    summary_path = os.path.join(output_dir, 'anomaly_summary.json')
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"异常摘要已保存: {summary_path}")

    if anomalies:
        print("\n最近5个异常事件:")
        for a in anomalies[-5:]:
            print(f"  {a.time / 3600:.1f}h - {a.level.name}: {a.message}")

    return anomalies


def run_comparison_analysis(simulation_path: str, sensor_path: str,
                             output_dir: str = 'results'):
    """运行仿真与实测数据对比分析"""
    print("=" * 60)
    print("仿真结果与实测数据对比分析")
    print("=" * 60)

    sim = KilnSimulation()
    sim_results = sim.load_results(simulation_path)
    print(f"加载仿真结果: {simulation_path}")

    processor = KilnDataProcessor()
    if sensor_path.endswith('.csv'):
        sensor_data = processor.load_and_process(sensor_path, 'csv')
    else:
        sensor_data = processor.load_and_process(sensor_path, 'json')
    print(f"加载传感器数据: {sensor_path}")

    comparator = SimulationComparator()
    report = comparator.generate_comparison_report(sim_results, sensor_data)

    os.makedirs(output_dir, exist_ok=True)

    report_path = os.path.join(output_dir, 'comparison_report.json')
    comparator.export_report(report, report_path)
    print(f"对比分析报告已保存: {report_path}")

    quality = report['overall_quality']
    print(f"\n整体仿真质量: {quality['quality_level']}")
    print(f"质量评分: {quality['score']:.1f} / 100")

    metrics = report['temperature_comparison']['overall_metrics']
    print(f"\n温度拟合指标:")
    print(f"  RMSE: {metrics['rmse']:.2f} K")
    print(f"  R²: {metrics['r2']:.4f}")
    print(f"  偏差: {metrics['bias']:.2f} K")

    print(f"\n改进建议:")
    for rec in report['recommendations']:
        print(f"  - {rec}")

    visualizer = ResultVisualizer(sim_results)
    comparison_fig = os.path.join(output_dir, 'comparison_plot.png')
    visualizer.plot_comparison(sensor_data, save_path=comparison_fig)
    visualizer.close_all()
    print(f"对比图已保存: {comparison_fig}")

    return report


def run_benchmark(output_dir: str = 'results'):
    """运行性能基准测试"""
    print("=" * 60)
    print("性能基准测试")
    print("=" * 60)

    profiler = PerformanceProfiler()

    print("\n1. 测试仿真性能...")
    profiler.start('simulation')
    sim = KilnSimulation()
    results = sim.run()
    profiler.stop('simulation')

    print("2. 测试异常检测性能...")
    profiler.start('anomaly_detection')
    detector = AnomalyDetector()
    detector.detect_from_results(results)
    profiler.stop('anomaly_detection')

    print("3. 测试可视化性能...")
    profiler.start('visualization')
    visualizer = ResultVisualizer(results)
    visualizer.plot_temperature()
    visualizer.close_all()
    profiler.stop('visualization')

    print("\n" + "=" * 60)
    profiler.print_summary()

    os.makedirs(output_dir, exist_ok=True)

    summary = profiler.get_summary()
    summary_path = os.path.join(output_dir, 'performance_profile.json')
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"性能分析结果已保存: {summary_path}")

    print("\n内存使用分析:")
    memory_usage = MemoryOptimizer.estimate_memory_usage(results)
    for key, usage in memory_usage.items():
        print(f"  {key}: {usage}")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description='传统陶瓷烧制过程数值模拟系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  基础功能:
    python main.py simulate                      # 使用默认配置运行仿真
    python main.py simulate -c config.json       # 使用指定配置运行仿真
    python main.py optimize                      # 运行参数优化
    python main.py import -s sensor_data.csv     # 导入传感器数据

  新增功能:
    python main.py multi-kiln                    # 多窑炉协同模拟
    python main.py multi-kiln -n 5               # 指定窑炉数量
    python main.py anomaly -sim results.h5       # 异常预警检测
    python main.py analysis -sim sim.h5 -s sensor.csv  # 仿真与实测对比分析
    python main.py benchmark                     # 性能基准测试

  数据生成:
    python main.py generate-config               # 生成示例配置文件
    python main.py generate-sensor               # 生成示例传感器数据
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    simulate_parser = subparsers.add_parser('simulate', help='运行陶瓷烧制仿真')
    simulate_parser.add_argument('-c', '--config', help='配置文件路径')
    simulate_parser.add_argument('-o', '--output', default='results', help='输出目录')

    optimize_parser = subparsers.add_parser('optimize', help='运行参数优化')
    optimize_parser.add_argument('-c', '--config', help='基准配置文件路径')
    optimize_parser.add_argument('-o', '--output', default='results', help='输出目录')

    import_parser = subparsers.add_parser('import', help='导入传感器数据')
    import_parser.add_argument('-s', '--sensor', required=True, help='传感器数据文件路径')
    import_parser.add_argument('-o', '--output', default='results', help='输出目录')

    compare_parser = subparsers.add_parser('compare', help='对比仿真与实测数据（简单）')
    compare_parser.add_argument('-sim', '--simulation', required=True, help='仿真结果文件路径')
    compare_parser.add_argument('-s', '--sensor', required=True, help='传感器数据文件路径')
    compare_parser.add_argument('-o', '--output', default='results', help='输出目录')

    multi_kiln_parser = subparsers.add_parser('multi-kiln', help='多窑炉协同模拟')
    multi_kiln_parser.add_argument('-n', '--num-kilns', type=int, default=3, help='窑炉数量')
    multi_kiln_parser.add_argument('-o', '--output', default='results', help='输出目录')

    anomaly_parser = subparsers.add_parser('anomaly', help='烧制过程异常预警检测')
    anomaly_parser.add_argument('-sim', '--simulation', required=True, help='仿真结果文件路径')
    anomaly_parser.add_argument('-o', '--output', default='results', help='输出目录')

    analysis_parser = subparsers.add_parser('analysis', help='仿真与实测数据对比分析')
    analysis_parser.add_argument('-sim', '--simulation', required=True, help='仿真结果文件路径')
    analysis_parser.add_argument('-s', '--sensor', required=True, help='传感器数据文件路径')
    analysis_parser.add_argument('-o', '--output', default='results', help='输出目录')

    benchmark_parser = subparsers.add_parser('benchmark', help='性能基准测试')
    benchmark_parser.add_argument('-o', '--output', default='results', help='输出目录')

    gen_config_parser = subparsers.add_parser('generate-config', help='生成示例配置文件')
    gen_config_parser.add_argument('-o', '--output', default='config/sample_config.json', help='输出路径')

    gen_sensor_parser = subparsers.add_parser('generate-sensor', help='生成示例传感器数据')
    gen_sensor_parser.add_argument('-o', '--output', default='data/sample_sensor.csv', help='输出路径')

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    if args.command == 'simulate':
        run_simulation(args.config, args.output)
    elif args.command == 'optimize':
        run_optimization(args.config, args.output)
    elif args.command == 'import':
        import_sensor_data(args.sensor, args.output)
    elif args.command == 'compare':
        run_comparison(args.simulation, args.sensor, args.output)
    elif args.command == 'multi-kiln':
        run_multi_kiln_simulation(args.num_kilns, args.output)
    elif args.command == 'anomaly':
        run_anomaly_detection(args.simulation, args.output)
    elif args.command == 'analysis':
        run_comparison_analysis(args.simulation, args.sensor, args.output)
    elif args.command == 'benchmark':
        run_benchmark(args.output)
    elif args.command == 'generate-config':
        generate_sample_config(args.output)
    elif args.command == 'generate-sensor':
        generate_sample_sensor_data(args.output)


if __name__ == '__main__':
    main()
