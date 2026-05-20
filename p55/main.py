#!/usr/bin/env python3
import argparse
import sys
import time
import numpy as np
from simulation import CeramicFiringSimulation, FiringConfig
from visualization import FiringVisualization
from storage import StorageManager
from optimization import FiringOptimizer, FiringObjective
from data_acquisition import SensorSimulator
from advanced_features import (
    KilnCoordinator, AnomalyDetector, SimulationComparator,
    FastNumericalCalculator
)
from ceramic_data_analysis import (
    HistoricalDataInterface, ProcessSchemeGenerator, MultiBatchAnalyzer
)


def run_simulation(args):
    print("=== 陶艺烧制过程仿真 ===")

    config = FiringConfig(
        initial_temp=args.initial_temp,
        target_temp=args.target_temp,
        heating_rate=args.heating_rate,
        holding_time=args.holding_time,
        cooling_rate=args.cooling_rate,
        total_time=args.total_time,
        clay_type=args.clay_type,
        atmosphere=args.atmosphere
    )

    print(f"\n配置参数:")
    print(f"  黏土类型: {config.clay_type}")
    print(f"  气氛: {config.atmosphere}")
    print(f"  目标温度: {config.target_temp}°C")
    print(f"  升温速率: {config.heating_rate}°C/h")
    print(f"  保温时间: {config.holding_time}min")
    print(f"  降温速率: {config.cooling_rate}°C/h")
    print(f"  总时间: {config.total_time}min")

    simulation = CeramicFiringSimulation(config)
    results = simulation.run_simulation()

    print(f"\n仿真完成!")
    print(f"  最终收缩率: {results['shrinkage'][-1]:.2f}%")
    print(f"  最终湿度: {results['humidity'][-1]:.2f}%")
    print(f"  最终氧气浓度: {results['oxygen'][-1]:.2f}%")

    if args.save:
        storage = StorageManager()
        run_name = storage.save_full_run(config, results, args.name)
        print(f"\n结果已保存: {run_name}")

    if args.plot:
        visual = FiringVisualization()
        fig, axes = visual.plot_all_parameters(results)
        print(f"\n绘图完成!")

        if args.save_plot:
            visual.save(args.save_plot, dpi=150)
            print(f"图表已保存: {args.save_plot}")
        else:
            visual.show()

    return results


def run_optimization(args):
    print("=== 烧制参数优化 ===")

    base_config = FiringConfig(
        initial_temp=25.0,
        target_temp=1280.0,
        heating_rate=150.0,
        holding_time=120.0,
        cooling_rate=100.0,
        total_time=600.0,
        clay_type="porcelain",
        atmosphere="oxidation"
    )

    optimizer = FiringOptimizer(base_config)

    initial_guess = {
        'heating_rate': 150.0,
        'holding_time': 120.0,
        'cooling_rate': 100.0,
        'target_temp': 1280.0
    }

    bounds = {
        'heating_rate': (80.0, 250.0),
        'holding_time': (60.0, 180.0),
        'cooling_rate': (50.0, 150.0),
        'target_temp': (1200.0, 1350.0)
    }

    print(f"\n优化参数范围:")
    for name, (low, high) in bounds.items():
        print(f"  {name}: [{low}, {high}]")

    if args.method == 'global':
        print("\n使用全局优化算法 (differential_evolution)...")
        result = optimizer.optimize_global(bounds, max_iter=args.iterations)
    else:
        print("\n使用局部优化算法 (L-BFGS-B)...")
        result = optimizer.optimize_local(initial_guess, bounds, max_iter=args.iterations)

    print(f"\n优化结果:")
    print(f"  成功: {result.success}")
    print(f"  迭代次数: {result.iterations}")
    print(f"  最优评分: {result.best_score:.4f}")
    print(f"\n最优参数:")
    for name, value in result.best_params.items():
        print(f"  {name}: {value:.2f}")

    return result


def run_visualization(args):
    print("=== 结果可视化 ===")

    if args.load:
        storage = StorageManager()
        results = storage.load_full_run(args.load)
        print(f"已加载数据: {args.load}")
    else:
        config = FiringConfig()
        simulation = CeramicFiringSimulation(config)
        results = simulation.run_simulation()

    visual = FiringVisualization()

    if args.type == 'all':
        fig, axes = visual.plot_all_parameters(results)
    elif args.type == 'temperature':
        ax = visual.plot_temperature_curve(results['time'], results['temperature'])
    elif args.type == 'shrinkage':
        ax = visual.plot_shrinkage_curve(results['time'], results['shrinkage'],
                                           results['temperature'])
    elif args.type == 'shrinkage_temp':
        ax = visual.plot_temperature_shrinkage_relation(results['temperature'],
                                                          results['shrinkage'])

    if args.save:
        visual.save(args.save, dpi=150)
        print(f"图表已保存: {args.save}")
    else:
        visual.show()


def run_storage(args):
    storage = StorageManager()

    if args.action == 'list':
        runs = storage.hdf5.list_runs()
        configs = storage.json_configs.list_configs()
        print(f"\n存储的仿真运行 ({len(runs)}):")
        for run in runs:
            print(f"  - {run}")
        print(f"\n存储的配置文件 ({len(configs)}):")
        for cfg in configs:
            print(f"  - {cfg}")

    elif args.action == 'stats':
        stats = storage.get_statistics()
        print(f"\n存储统计信息:")
        print(f"  总运行次数: {stats['total_runs']}")
        print(f"  总配置数: {stats['total_configs']}")
        if 'avg_final_shrinkage' in stats:
            print(f"  平均最终收缩率: {stats['avg_final_shrinkage']:.2f}%")
            print(f"  最小最终收缩率: {stats['min_final_shrinkage']:.2f}%")
            print(f"  最大最终收缩率: {stats['max_final_shrinkage']:.2f}%")

    elif args.action == 'delete':
        if args.name:
            storage.hdf5.delete_run(args.name)
            print(f"已删除运行: {args.name}")
        else:
            print("请指定要删除的运行名称")

    elif args.action == 'export':
        if args.name:
            csv_file = storage.export_to_csv(args.name)
            print(f"已导出到: {csv_file}")
        else:
            print("请指定要导出的运行名称")


def run_demo(args):
    print("=== 陶艺烧制仿真系统演示 ===")
    print("\n本演示将展示完整的仿真、可视化和存储流程\n")

    config_porcelain = FiringConfig(
        target_temp=1280.0,
        heating_rate=150.0,
        holding_time=120.0,
        cooling_rate=100.0,
        total_time=600.0,
        clay_type="porcelain",
        atmosphere="oxidation"
    )

    config_stoneware = FiringConfig(
        target_temp=1250.0,
        heating_rate=120.0,
        holding_time=90.0,
        cooling_rate=80.0,
        total_time=550.0,
        clay_type="stoneware",
        atmosphere="reduction"
    )

    print("1. 运行瓷器氧化烧仿真...")
    sim1 = CeramicFiringSimulation(config_porcelain)
    results_porcelain = sim1.run_simulation()
    print(f"   瓷器最终收缩率: {results_porcelain['shrinkage'][-1]:.2f}%")

    print("2. 运行炻器还原烧仿真...")
    sim2 = CeramicFiringSimulation(config_stoneware)
    results_stoneware = sim2.run_simulation()
    print(f"   炻器最终收缩率: {results_stoneware['shrinkage'][-1]:.2f}%")

    print("3. 保存仿真结果...")
    storage = StorageManager()
    name1 = storage.save_full_run(config_porcelain, results_porcelain, "porcelain_demo")
    name2 = storage.save_full_run(config_stoneware, results_stoneware, "stoneware_demo")
    print(f"   已保存: {name1}, {name2}")

    print("4. 生成可视化对比图...")
    visual = FiringVisualization()
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    axes[0, 0].plot(results_porcelain['time'] / 60,
                    results_porcelain['temperature'], label='瓷器')
    axes[0, 0].plot(results_stoneware['time'] / 60,
                    results_stoneware['temperature'], label='炻器')
    axes[0, 0].set_title('温度曲线对比')
    axes[0, 0].set_xlabel('时间 (min)')
    axes[0, 0].set_ylabel('温度 (°C)')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)

    axes[0, 1].plot(results_porcelain['time'] / 60,
                    results_porcelain['shrinkage'], label='瓷器')
    axes[0, 1].plot(results_stoneware['time'] / 60,
                    results_stoneware['shrinkage'], label='炻器')
    axes[0, 1].set_title('收缩率对比')
    axes[0, 1].set_xlabel('时间 (min)')
    axes[0, 1].set_ylabel('收缩率 (%)')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)

    axes[1, 0].plot(results_porcelain['time'] / 60,
                    results_porcelain['oxygen'], label='瓷器(氧化)')
    axes[1, 0].plot(results_stoneware['time'] / 60,
                    results_stoneware['oxygen'], label='炻器(还原)')
    axes[1, 0].set_title('氧气浓度对比')
    axes[1, 0].set_xlabel('时间 (min)')
    axes[1, 0].set_ylabel('氧气浓度 (%)')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)

    axes[1, 1].plot(results_porcelain['time'] / 60,
                    results_porcelain['humidity'], label='瓷器')
    axes[1, 1].plot(results_stoneware['time'] / 60,
                    results_stoneware['humidity'], label='炻器')
    axes[1, 1].set_title('湿度对比')
    axes[1, 1].set_xlabel('时间 (min)')
    axes[1, 1].set_ylabel('相对湿度 (%)')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)

    plt.tight_layout()

    if args.save:
        plt.savefig(args.save, dpi=150)
        print(f"   图表已保存: {args.save}")
    else:
        print("   显示图表...")
        plt.show()

    print("\n演示完成!")


def run_multi_kiln_simulation(args):
    print("=== 多窑炉协同仿真 ===")

    coordinator = KilnCoordinator(total_power_capacity=args.total_power)

    configs = [
        FiringConfig(target_temp=1280, heating_rate=150, holding_time=120, clay_type='porcelain'),
        FiringConfig(target_temp=1250, heating_rate=120, holding_time=90, clay_type='stoneware'),
        FiringConfig(target_temp=1100, heating_rate=100, holding_time=60, clay_type='earthenware'),
    ]

    for i, config in enumerate(configs[:args.n_kilns]):
        kiln_id = f'窑炉{i + 1}'
        coordinator.add_kiln(kiln_id, config, max_power=50.0)
        print(f"  {kiln_id}: 目标温度{config.target_temp}°C, {config.clay_type}")

    print(f"\n总功率容量: {args.total_power}kW")
    print(f"\n运行协同仿真...")
    results = coordinator.run_coordinated_simulation()

    energy_info = coordinator.get_total_energy_consumption()
    print(f"\n能源消耗统计:")
    print(f"  总能耗: {energy_info['total_kwh']:.2f} kWh")
    for kid, kwh in energy_info['breakdown_kwh'].items():
        print(f"  {kid}: {kwh:.2f} kWh")

    power_alloc = coordinator.optimize_power_allocation()
    print(f"\n优化功率分配:")
    for kid, power in power_alloc.items():
        print(f"  {kid}: {power:.1f}kW")

    if args.plot:
        time, load_info = coordinator.get_load_profile()
        visual = FiringVisualization()
        fig = visual.plot_multi_kiln_comparison(
            time, {kid: results[kid]['temperature'] for kid in results.keys()},
            show_load=True, load_profiles=load_info['individual']
        )
        print("\n已生成多窑炉对比图表")
        if args.save_plot:
            visual.save(args.save_plot, dpi=150)
            print(f"图表已保存到: {args.save_plot}")
        else:
            visual.show()

    print("\n多窑炉协同仿真完成!")


def run_anomaly_detection(args):
    print("=== 烧制过程异常检测 ===")

    config = FiringConfig(target_temp=args.target_temp, heating_rate=args.heating_rate)
    simulation = CeramicFiringSimulation(config)
    results = simulation.run_simulation()

    if args.inject_anomaly:
        print("  注入模拟异常...")
        anomaly_start = len(results['temperature']) // 3
        anomaly_end = anomaly_start + 50
        for i in range(anomaly_start, anomaly_end):
            results['temperature'][i] += 80.0 * np.sin((i - anomaly_start) * np.pi / 50)

    detector = AnomalyDetector()
    alerts = detector.detect_all_anomalies(results)
    summary = detector.get_alert_summary()

    print(f"\n检测结果:")
    print(f"  总预警数: {summary['total']}")
    print(f"  高风险: {summary['by_severity'].get('HIGH', 0)}个")
    print(f"  中风险: {summary['by_severity'].get('MEDIUM', 0)}个")
    print(f"  低风险: {summary['by_severity'].get('LOW', 0)}个")

    if alerts:
        print(f"\n预警详情:")
        for alert in alerts[:10]:
            severity_mark = "🔴" if alert.severity == "HIGH" else "🟡" if alert.severity == "MEDIUM" else "🟢"
            print(f"  {severity_mark} [{alert.timestamp/60:.1f}分钟] {alert.alert_type}: {alert.message}")

    if args.plot:
        visual = FiringVisualization()
        fig, ax = plt.subplots(figsize=(14, 8))
        visual.plot_anomaly_markers(results['time'], results['temperature'],
                                   [a for a in alerts if 'TEMP' in a.alert_type],
                                   ax=ax, ylabel='温度')
        print("\n已生成异常标记图表")
        if args.save_plot:
            visual.save(args.save_plot, dpi=150)
            print(f"图表已保存到: {args.save_plot}")
        else:
            visual.show()

    print("\n异常检测完成!")


def run_comparison(args):
    print("=== 仿真与实际数据对比分析 ===")

    config = FiringConfig(target_temp=1280, heating_rate=150)
    sim = CeramicFiringSimulation(config)
    sim_results = sim.run_simulation()

    print("生成模拟的实际数据（添加噪声和偏差）...")
    np.random.seed(42)
    real_results = {}
    for key, data in sim_results.items():
        if key == 'time':
            real_results[key] = data
        else:
            noise = np.random.normal(0, 0.05 * np.std(data), len(data))
            bias = 0.02 * np.mean(data) * np.sin(np.linspace(0, 4 * np.pi, len(data)))
            real_results[key] = data + noise + bias

    comparator = SimulationComparator(time_interpolation=True)
    metrics = comparator.compare_profiles(sim_results, real_results)

    print("\n" + comparator.generate_comparison_report())

    suggestions = comparator.suggest_corrections()
    print("\n改进建议:")
    for i, s in enumerate(suggestions, 1):
        print(f"  {i}. {s}")

    if args.plot:
        visual = FiringVisualization()
        fig, axes = visual.plot_simulation_vs_real(
            sim_results['time'], sim_results['temperature'],
            real_results['time'], real_results['temperature'],
            '温度', '°C'
        )
        print("\n已生成对比图表")
        if args.save_plot:
            visual.save(args.save_plot, dpi=150)
            print(f"图表已保存到: {args.save_plot}")
        else:
            visual.show()

    print("\n对比分析完成!")


def run_benchmark(args):
    print("=== 数值计算性能基准测试 ===")

    n_runs = args.n_runs
    configs = [
        FiringConfig(target_temp=1200 + i * 20, heating_rate=120 + i * 10)
        for i in range(n_runs)
    ]

    print(f"\n测试 {n_runs} 次仿真运行性能...")

    calculator = FastNumericalCalculator(use_cache=False)
    start = time.time()
    results_no_cache = calculator.batch_simulation_evaluate(configs, parallel=False)
    time_no_cache = time.time() - start
    print(f"  无缓存模式: {time_no_cache:.3f}秒 ({n_runs/time_no_cache:.1f}次/秒)")

    print("\n测试缓存加速效果（重复运行相同参数）...")
    calculator_cached = FastNumericalCalculator(use_cache=True, max_cache_size=100)
    calculator_cached.batch_simulation_evaluate(configs[:10], parallel=False)
    start = time.time()
    calculator_cached.batch_simulation_evaluate(configs[:10], parallel=False)
    time_cached = time.time() - start
    stats = calculator_cached.get_cache_stats()
    print(f"  有缓存模式: {time_cached:.3f}秒")
    print(f"  缓存命中率: {stats['hit_rate']*100:.1f}%")
    print(f"  加速比: {time_no_cache/(n_runs/10)/time_cached:.1f}x")

    if args.plot:
        print("\n基准测试完成!")
        print("性能提示:")
        print("  - 使用 FastNumericalCalculator 的缓存机制可显著提升重复计算速度")
        print("  - 对大批量仿真可启用并行计算 (parallel=True)")
        print("  - 向量化计算已自动优化 NumPy 运算")


def run_historical_data(args):
    print("=== 历史数据管理 ===")

    data_interface = HistoricalDataInterface()
    print(f"当前数据目录: {data_interface.data_dir}")

    if args.generate_demo:
        print(f"\n生成 {args.n_batches} 条演示数据...")
        imported = data_interface.generate_demo_data(n_batches=args.n_batches)
        print(f"成功导入 {imported} 条记录")

    if args.import_csv:
        print(f"\n从 CSV 导入数据: {args.import_csv}")
        try:
            imported = data_interface.import_from_csv(args.import_csv)
            print(f"成功导入 {imported} 条记录")
        except Exception as e:
            print(f"导入失败: {e}")
            return

    stats = data_interface.get_statistics_summary()
    if stats['total_records'] == 0:
        print("\n当前无数据记录")
        return

    print(f"\n数据统计摘要:")
    print(f"  总记录数: {stats['total_records']}")
    print(f"  时间范围: {stats['date_range']['earliest']} ~ {stats['date_range']['latest']}")
    print(f"  平均成功率: {stats['quality_metrics']['avg_success_rate']:.1f}%")
    print(f"  平均品质分数: {stats['quality_metrics']['avg_quality_score']:.2f}")

    print(f"\n按黏土类型统计:")
    for clay, s in stats['by_clay_type'].items():
        print(f"  {clay}: {s['count']}条, 平均品质 {s['avg_quality']:.2f}, 平均温度 {s['avg_temp']:.0f}°C")

    print(f"\n按气氛类型统计:")
    for atm, s in stats['by_atmosphere'].items():
        print(f"  {atm}: {s['count']}条, 平均品质 {s['avg_quality']:.2f}")

    if stats['common_defects']:
        print(f"\n常见缺陷统计:")
        for defect, count in list(stats['common_defects'].items())[:5]:
            print(f"  {defect}: {count}次")

    print("\n历史数据管理完成!")


def run_scheme_generation(args):
    print("=== 工艺方案自动生成 ===")

    data_interface = HistoricalDataInterface()

    if data_interface.get_statistics_summary()['total_records'] == 0:
        print("暂无历史数据，正在生成演示数据...")
        data_interface.generate_demo_data(n_batches=50)

    generator = ProcessSchemeGenerator(data_interface)

    target_clay = args.clay_type
    print(f"\n针对 {target_clay} 生成工艺方案...")

    if args.compare:
        schemes = generator.generate_multiple_schemes(target_clay, n_schemes=3)
        print(f"\n已生成 {len(schemes)} 个优化方案:")
        for i, scheme in enumerate(schemes, 1):
            eval_result = generator.evaluate_scheme(scheme)
            print(f"\n方案 {i}: {scheme.scheme_name}")
            print(f"  烧成温度: {scheme.config.target_temp:.1f}°C")
            print(f"  升温速率: {scheme.config.heating_rate:.1f}°C/h")
            print(f"  保温时间: {scheme.config.holding_time:.1f}min")
            print(f"  降温速率: {scheme.config.cooling_rate:.1f}°C/h")
            print(f"  气氛类型: {scheme.config.atmosphere}")
            print(f"  预期品质: {scheme.expected_quality:.2f}")
            print(f"  置信度: {scheme.confidence_level:.2%}")
            print(f"  风险等级: {eval_result['risk_level']:.2f}")
    else:
        scheme = generator.generate_scheme(target_clay, optimization_goal=args.goal)
        eval_result = generator.evaluate_scheme(scheme)

        print(f"\n方案名称: {scheme.scheme_name}")
        print(f"烧成温度: {scheme.config.target_temp:.1f}°C")
        print(f"升温速率: {scheme.config.heating_rate:.1f}°C/h")
        print(f"保温时间: {scheme.config.holding_time:.1f}min")
        print(f"降温速率: {scheme.config.cooling_rate:.1f}°C/h")
        print(f"气氛类型: {scheme.config.atmosphere}")
        print(f"\n预期成功率: {eval_result['expected_success_rate']:.1f}%")
        print(f"预期品质分数: {eval_result['expected_quality']:.2f}")
        print(f"风险等级: {eval_result['risk_level']:.2f}")
        print(f"置信度: {scheme.confidence_level:.2%}")
        print(f"基于历史批次: {len(scheme.basis_batches)}个")

        if args.export:
            filepath = generator.export_scheme_to_json(scheme)
            print(f"\n方案已导出: {filepath}")

    print("\n工艺方案生成完成!")


def run_batch_analysis(args):
    print("=== 多批次对比分析 ===")

    data_interface = HistoricalDataInterface()

    if data_interface.get_statistics_summary()['total_records'] == 0:
        print("暂无历史数据，正在生成演示数据...")
        data_interface.generate_demo_data(n_batches=50)

    analyzer = MultiBatchAnalyzer(data_interface)

    all_batches = list(data_interface.records.keys())
    print(f"\n总批次数量: {len(all_batches)}")

    if args.mode == 'compare':
        selected_batches = all_batches[:min(10, len(all_batches))] if not args.batches else args.batches.split(',')
        print(f"对比批次: {', '.join(selected_batches)}")

        report = analyzer.generate_comparison_report(selected_batches)
        print("\n" + report)

    elif args.mode == 'trend':
        print("执行趋势分析...")
        trend_result = analyzer.trend_analysis()

        if 'error' in trend_result:
            print(f"警告: {trend_result['error']}")
            return

        print(f"\n分析时间范围: {trend_result['time_period']['start']} ~ {trend_result['time_period']['end']}")
        print(f"分析批次数量: {trend_result['time_period']['n_batches']}")

        if trend_result['quality_trend']:
            qt = trend_result['quality_trend']
            print(f"\n品质趋势: {qt['direction'].upper()}")
            print(f"  趋势斜率: {qt['slope']:.4f}")
            print(f"  拟合度 R²: {qt['r_squared']:.2%}")

        if trend_result['success_rate_trend']:
            st = trend_result['success_rate_trend']
            print(f"\n成功率趋势: {st['direction'].upper()}")
            print(f"  趋势斜率: {st['slope']:.4f}")

        print(f"\n整体改善率: {trend_result['improvement_rate']:.2f}%")

    elif args.mode == 'anova':
        print(f"执行方差分析: {args.group_by} vs {args.metric}")
        anova_result = analyzer.anova_test(group_by=args.group_by, metric=args.metric)

        if 'error' in anova_result:
            print(f"警告: {anova_result['error']}")
            return

        print(f"\nF统计量: {anova_result['f_statistic']:.4f}")
        print(f"P值: {anova_result['p_value']:.6f}")
        print(f"显著性: {'是 (p<0.05)' if anova_result['significant'] else '否 (p>=0.05)'}")
        print(f"\n解读: {anova_result['interpretation']}")

        print(f"\n各组统计:")
        for group, stats in anova_result['group_stats'].items():
            print(f"  {group}: N={stats['count']}, 均值={stats['mean']:.2f}, 标准差={stats['std']:.2f}")

    elif args.mode == 'defect':
        print(f"缺陷根因分析: {args.defect_type}")
        analysis = analyzer.defect_root_cause_analysis(args.defect_type)

        if 'error' in analysis:
            print(f"警告: {analysis['error']}")
            return

        print(f"\n缺陷发生率: {analysis['occurrence_rate']:.2%}")
        print("\n参数影响分析:")

        for param, result in analysis['parameter_analysis'].items():
            sig = "显著" if result['significant'] else "不显著"
            print(f"  {param}:")
            print(f"    有缺陷组均值: {result['mean_with_defect']:.2f}")
            print(f"    无缺陷组均值: {result['mean_without_defect']:.2f}")
            print(f"    P值: {result['p_value']:.4f} ({sig})")

        if analysis['significant_factors']:
            print("\n显著性影响因素:")
            for factor in analysis['significant_factors']:
                print(f"  {factor['parameter']}: {factor['effect']}")
        else:
            print("\n未发现显著影响因素")

    print("\n多批次对比分析完成!")


def main():
    parser = argparse.ArgumentParser(
        description='传统陶艺烧制过程数值模拟系统 - 深度扩展版',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
基础功能:
  python main.py simulation --plot                  # 运行仿真并绘图
  python main.py simulation --save --name my_run    # 运行仿真并保存结果
  python main.py optimization --method global       # 运行参数优化
  python main.py visualization --type all           # 可视化所有参数
  python main.py storage --action list              # 列出存储的结果

高级功能:
  python main.py multi-kiln --n-kilns 3 --plot     # 多窑炉协同仿真
  python main.py anomaly --inject-anomaly --plot   # 异常检测预警
  python main.py compare --plot                     # 仿真与实际数据对比
  python main.py benchmark --n-runs 20              # 性能基准测试

深度扩展功能:
  python main.py historical --generate-demo         # 历史数据管理
  python main.py scheme --clay-type porcelain --compare  # 工艺方案生成
  python main.py analysis --mode compare           # 多批次对比分析
  python main.py analysis --mode trend              # 趋势分析
  python main.py analysis --mode anova              # 方差分析
  python main.py analysis --mode defect             # 缺陷根因分析

  python main.py demo                               # 运行完整演示
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    sim_parser = subparsers.add_parser('simulation', help='运行烧制仿真')
    sim_parser.add_argument('--initial-temp', type=float, default=25.0, help='初始温度')
    sim_parser.add_argument('--target-temp', type=float, default=1280.0, help='目标温度')
    sim_parser.add_argument('--heating-rate', type=float, default=150.0, help='升温速率')
    sim_parser.add_argument('--holding-time', type=float, default=120.0, help='保温时间')
    sim_parser.add_argument('--cooling-rate', type=float, default=100.0, help='降温速率')
    sim_parser.add_argument('--total-time', type=float, default=600.0, help='总时间')
    sim_parser.add_argument('--clay-type', type=str, default='porcelain', help='黏土类型')
    sim_parser.add_argument('--atmosphere', type=str, default='oxidation', help='气氛')
    sim_parser.add_argument('--plot', action='store_true', help='绘图显示')
    sim_parser.add_argument('--save', action='store_true', help='保存结果')
    sim_parser.add_argument('--save-plot', type=str, help='保存图表到文件')
    sim_parser.add_argument('--name', type=str, help='运行名称')

    opt_parser = subparsers.add_parser('optimization', help='参数优化')
    opt_parser.add_argument('--method', type=str, default='local',
                           choices=['local', 'global'], help='优化方法')
    opt_parser.add_argument('--iterations', type=int, default=50, help='迭代次数')

    vis_parser = subparsers.add_parser('visualization', help='可视化')
    vis_parser.add_argument('--type', type=str, default='all',
                           choices=['all', 'temperature', 'shrinkage', 'shrinkage_temp'],
                           help='可视化类型')
    vis_parser.add_argument('--load', type=str, help='加载的运行名称')
    vis_parser.add_argument('--save', type=str, help='保存图表到文件')

    storage_parser = subparsers.add_parser('storage', help='存储管理')
    storage_parser.add_argument('--action', type=str, required=True,
                               choices=['list', 'stats', 'delete', 'export'],
                               help='操作类型')
    storage_parser.add_argument('--name', type=str, help='运行名称')

    demo_parser = subparsers.add_parser('demo', help='运行演示')
    demo_parser.add_argument('--save', type=str, help='保存演示图表')

    multi_kiln_parser = subparsers.add_parser('multi-kiln', help='多窑炉协同仿真')
    multi_kiln_parser.add_argument('--n-kilns', type=int, default=3, choices=[1, 2, 3],
                                  help='窑炉数量')
    multi_kiln_parser.add_argument('--total-power', type=float, default=120.0,
                                  help='总功率容量(kW)')
    multi_kiln_parser.add_argument('--plot', action='store_true', help='绘图显示')
    multi_kiln_parser.add_argument('--save-plot', type=str, help='保存图表到文件')

    anomaly_parser = subparsers.add_parser('anomaly', help='烧制过程异常检测预警')
    anomaly_parser.add_argument('--target-temp', type=float, default=1280.0, help='目标温度')
    anomaly_parser.add_argument('--heating-rate', type=float, default=150.0, help='升温速率')
    anomaly_parser.add_argument('--inject-anomaly', action='store_true', help='注入模拟异常')
    anomaly_parser.add_argument('--plot', action='store_true', help='绘图显示')
    anomaly_parser.add_argument('--save-plot', type=str, help='保存图表到文件')

    compare_parser = subparsers.add_parser('compare', help='仿真与实际数据对比分析')
    compare_parser.add_argument('--plot', action='store_true', help='绘图显示')
    compare_parser.add_argument('--save-plot', type=str, help='保存图表到文件')

    benchmark_parser = subparsers.add_parser('benchmark', help='数值计算性能基准测试')
    benchmark_parser.add_argument('--n-runs', type=int, default=20, help='测试运行次数')
    benchmark_parser.add_argument('--plot', action='store_true', help='显示性能提示')

    historical_parser = subparsers.add_parser('historical', help='历史数据管理')
    historical_parser.add_argument('--generate-demo', action='store_true', help='生成演示数据')
    historical_parser.add_argument('--n-batches', type=int, default=50, help='演示数据数量')
    historical_parser.add_argument('--import-csv', type=str, help='从CSV文件导入数据')

    scheme_parser = subparsers.add_parser('scheme', help='工艺方案自动生成')
    scheme_parser.add_argument('--clay-type', type=str, default='porcelain',
                          choices=['porcelain', 'stoneware', 'earthenware', 'bone_china'],
                          help='目标黏土类型')
    scheme_parser.add_argument('--goal', type=str, default='quality',
                          choices=['quality', 'success_rate', 'energy', 'speed'],
                          help='优化目标')
    scheme_parser.add_argument('--compare', action='store_true', help='生成多种方案对比')
    scheme_parser.add_argument('--export', action='store_true', help='导出方案到JSON')

    analysis_parser = subparsers.add_parser('analysis', help='多批次对比分析')
    analysis_parser.add_argument('--mode', type=str, default='compare',
                              choices=['compare', 'trend', 'anova', 'defect'],
                              help='分析模式')
    analysis_parser.add_argument('--batches', type=str, help='指定批次ID，逗号分隔')
    analysis_parser.add_argument('--group-by', type=str, default='clay_type',
                              help='ANOVA分组字段')
    analysis_parser.add_argument('--metric', type=str, default='quality_score',
                              help='ANOVA分析指标')
    analysis_parser.add_argument('--defect-type', type=str, default='cracking',
                              help='缺陷类型')

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    if args.command == 'simulation':
        run_simulation(args)
    elif args.command == 'optimization':
        run_optimization(args)
    elif args.command == 'visualization':
        run_visualization(args)
    elif args.command == 'storage':
        run_storage(args)
    elif args.command == 'demo':
        run_demo(args)
    elif args.command == 'multi-kiln':
        run_multi_kiln_simulation(args)
    elif args.command == 'anomaly':
        run_anomaly_detection(args)
    elif args.command == 'compare':
        run_comparison(args)
    elif args.command == 'benchmark':
        run_benchmark(args)
    elif args.command == 'historical':
        run_historical_data(args)
    elif args.command == 'scheme':
        run_scheme_generation(args)
    elif args.command == 'analysis':
        run_batch_analysis(args)


if __name__ == '__main__':
    import matplotlib.pyplot as plt
    main()
