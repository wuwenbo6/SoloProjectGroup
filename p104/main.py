import json
import numpy as np
import time
import matplotlib
matplotlib.use('Agg')

from bamboo_data import BambooDataCollector
from tension_simulation import BambooWeaveSimulator, WeaveConfig
from visualization import TensionVisualizer
from optimization import TensionOptimizer, OptimizationConfig
from advanced_simulation import (
    MultiPatternSimulator, PatternConfig,
    TensionComparator, OptimizedNumericalSolver
)


def run_basic_simulation():
    print("=" * 60)
    print("运行基本张力模拟")
    print("=" * 60)
    
    data_collector = BambooDataCollector()
    
    data_collector.create_strip(
        species_name='Phyllostachys pubescens',
        length=1.0,
        width=0.005,
        thickness=0.001,
        moisture_content=12.0
    )
    
    print(f"已创建竹丝: {len(data_collector.strips)} 根")
    props = data_collector.get_strip_properties(0)
    print(f"竹丝属性: 截面积={props['cross_section_area']:.6f} m², "
          f"轴向刚度={props['axial_stiffness']:.2f} N")
    
    simulator = BambooWeaveSimulator(data_collector)
    simulator.set_config(
        pattern='plain',
        warp_count=20,
        weft_count=20,
        base_tension=100.0,
        simulation_time=1.0,
        time_steps=100
    )
    
    result = simulator.simulate_static_tension()
    
    print(f"\n模拟结果:")
    print(f"  平均总张力: {np.mean(result.total_tension):.2f} N")
    print(f"  最大总张力: {np.max(result.total_tension):.2f} N")
    print(f"  张力标准差: {np.std(result.total_tension):.2f} N")
    print(f"  时间步数: {len(result.time)}")
    
    simulator.save_result_to_hdf5(result, 'output/simulation_result.h5')
    print(f"\n结果已保存到: output/simulation_result.h5")
    
    return data_collector, simulator, result


def run_visualization(result):
    print("\n" + "=" * 60)
    print("生成可视化报告")
    print("=" * 60)
    
    visualizer = TensionVisualizer()
    visualizer.generate_report(result, show=False)
    
    print("可视化报告已生成到 output 目录")


def run_optimization(data_collector, simulator):
    print("\n" + "=" * 60)
    print("运行张力参数优化")
    print("=" * 60)
    
    opt_config = OptimizationConfig(
        target_tension=120.0,
        tension_weight=1.0,
        uniformity_weight=2.0,
        max_tension_constraint=200.0,
        min_tension_constraint=50.0
    )
    
    optimizer = TensionOptimizer(data_collector, simulator, opt_config)
    
    print("运行网格搜索优化...")
    opt_result = optimizer.grid_search(num_points=4)
    
    print(f"\n优化结果:")
    print(f"  成功: {opt_result.success}")
    print(f"  最优张力: {opt_result.optimal_tension:.2f} N")
    print(f"  最大张力: {opt_result.max_tension:.2f} N")
    print(f"  最小张力: {opt_result.min_tension:.2f} N")
    print(f"  张力均匀性(标准差): {opt_result.tension_uniformity:.2f} N")
    print(f"  张力变异系数: {opt_result.tension_uniformity/opt_result.optimal_tension*100:.1f}%")
    print(f"  目标函数值: {opt_result.objective_value:.4f}")
    print(f"  最优参数:")
    for key, value in opt_result.optimal_params.items():
        print(f"    {key}: {value}")
    
    return optimizer, opt_result


def compare_weave_patterns(data_collector, simulator):
    print("\n" + "=" * 60)
    print("比较不同编织方式")
    print("=" * 60)
    
    patterns = ['plain', 'twill', 'satin', 'lattice']
    results = {}
    
    for pattern in patterns:
        simulator.set_config(pattern=pattern)
        result = simulator.simulate_static_tension()
        results[pattern] = result
        
        mean_tension = np.mean(result.total_tension)
        std_tension = np.std(result.total_tension)
        print(f"  {pattern}: 平均张力={mean_tension:.2f} N, 标准差={std_tension:.2f} N")
    
    visualizer = TensionVisualizer()
    visualizer.plot_weave_pattern_comparison(
        results,
        save_path='output/pattern_comparison.png',
        show=False
    )
    print("编织方式对比图已保存到 output/pattern_comparison.png")


def run_dynamic_simulation(data_collector, simulator):
    print("\n" + "=" * 60)
    print("运行动态张力模拟")
    print("=" * 60)
    
    simulator.set_config(
        pattern='plain',
        warp_count=20,
        weft_count=20,
        base_tension=100.0,
        simulation_time=2.0,
        time_steps=200
    )
    
    result = simulator.simulate_dynamic_tension(
        initial_velocity=0.5,
        damping_ratio=0.1
    )
    
    print(f"动态模拟结果:")
    print(f"  平均总张力: {np.mean(result.total_tension):.2f} N")
    print(f"  最大总张力: {np.max(result.total_tension):.2f} N")
    
    visualizer = TensionVisualizer()
    visualizer.plot_tension_time_series(
        result,
        save_path='output/dynamic_tension.png',
        show=False
    )
    print("动态张力图已保存到 output/dynamic_tension.png")
    
    return result


def run_multi_pattern_simulation(data_collector):
    print("\n" + "=" * 60)
    print("运行多编织方式协同张力模拟")
    print("=" * 60)
    
    simulator = MultiPatternSimulator(data_collector)
    simulator.set_global_config(
        simulation_time=2.0,
        time_steps=200
    )
    
    simulator.add_pattern(PatternConfig(
        pattern_type='plain',
        warp_start=0, warp_end=10,
        weft_start=0, weft_end=10,
        base_tension=100.0,
        friction_coefficient=0.3
    ))
    
    simulator.add_pattern(PatternConfig(
        pattern_type='twill',
        warp_start=10, warp_end=20,
        weft_start=10, weft_end=20,
        base_tension=120.0,
        friction_coefficient=0.25
    ))
    
    simulator.add_pattern(PatternConfig(
        pattern_type='satin',
        warp_start=20, warp_end=30,
        weft_start=20, weft_end=30,
        base_tension=90.0,
        friction_coefficient=0.35
    ))
    
    print("已添加3种编织方式: plain, twill, satin")
    
    result = simulator.simulate_multi_pattern(num_nodes=30)
    
    print(f"多编织方式模拟结果:")
    print(f"  平均总张力: {np.mean(result.total_tension):.2f} N")
    print(f"  最大总张力: {np.max(result.total_tension):.2f} N")
    print(f"  最小总张力: {np.min(result.total_tension):.2f} N")
    
    anomaly_summary = simulator.get_anomaly_summary()
    print(f"  检测到异常数量: {anomaly_summary['total_anomalies']}")
    if anomaly_summary['total_anomalies'] > 0:
        for anomaly_type, count in anomaly_summary['by_type'].items():
            print(f"    {anomaly_type}: {count}")
    
    visualizer = TensionVisualizer()
    visualizer.plot_multi_pattern_tension(
        result,
        pattern_names=['plain', 'twill', 'satin'],
        save_path='output/multi_pattern_tension.png',
        show=False
    )
    print("多编织方式张力图已保存到 output/multi_pattern_tension.png")
    
    visualizer.plot_anomaly_detection(
        result,
        anomaly_summary,
        save_path='output/anomaly_detection.png',
        show=False
    )
    print("异常检测图已保存到 output/anomaly_detection.png")
    
    simulator.export_anomalies_to_json('output/anomaly_report.json')
    print("异常报告已保存到 output/anomaly_report.json")
    
    return result, simulator


def run_simulation_vs_test_comparison(simulation_result):
    print("\n" + "=" * 60)
    print("仿真结果与实测数据对比分析")
    print("=" * 60)
    
    comparator = TensionComparator()
    comparator.generate_sample_test_data(simulation_result, noise_level=8.0)
    
    print(f"测试数据点数量: {len(comparator.test_data)}")
    
    metrics = comparator.compare()
    
    print(f"\n对比分析指标:")
    print(f"  平均绝对误差 (MAE): {metrics.mae:.2f} N")
    print(f"  均方根误差 (RMSE): {metrics.rmse:.2f} N")
    print(f"  相关系数: {metrics.correlation:.4f}")
    print(f"  最大误差: {metrics.max_error:.2f} N")
    print(f"  平均误差率: {metrics.mean_error_ratio:.2f}%")
    
    quality = 'EXCELLENT' if metrics.rmse < 10 else 'GOOD' if metrics.rmse < 20 else 'FAIR'
    print(f"  仿真质量评估: {quality}")
    
    visualizer = TensionVisualizer()
    times, measured, simulated = comparator.get_comparison_data()
    visualizer.plot_simulation_vs_test(
        times, measured, simulated,
        save_path='output/simulation_vs_test.png',
        show=False
    )
    print("仿真-实测对比图已保存到 output/simulation_vs_test.png")
    
    report = comparator.export_comparison_report('output/comparison_report.json')
    print("对比分析报告已保存到 output/comparison_report.json")
    
    return metrics


def run_optimized_numerical_computation():
    print("\n" + "=" * 60)
    print("优化数值计算 - 大样本性能测试")
    print("=" * 60)
    
    solver = OptimizedNumericalSolver(use_cache=True)
    
    num_samples = 1000
    num_nodes = 50
    num_time_steps = 200
    
    print(f"测试配置: {num_samples}样本 × {num_nodes}节点 × {num_time_steps}时间步")
    
    start_time = time.time()
    result = solver.memory_efficient_simulation(
        num_samples=num_samples,
        num_nodes=num_nodes,
        num_time_steps=num_time_steps,
        batch_size=100
    )
    elapsed_time = time.time() - start_time
    
    print(f"批量计算完成，耗时: {elapsed_time:.2f} 秒")
    print(f"处理速度: {num_samples / elapsed_time:.1f} 样本/秒")
    print(f"结果数组形状: {result.shape}")
    
    stats = solver.parallel_tension_analysis(result)
    print(f"\n统计分析结果:")
    print(f"  平均张力范围: [{np.min(stats['mean']):.2f}, {np.max(stats['mean']):.2f}] N")
    print(f"  最大张力范围: [{np.min(stats['max']):.2f}, {np.max(stats['max']):.2f}] N")
    print(f"  张力标准差范围: [{np.min(stats['std']):.2f}, {np.max(stats['std']):.2f}] N")
    
    base_tensions = np.linspace(50, 200, 100)
    start_time = time.time()
    batch_result = solver.batch_tension_simulation(base_tensions, num_nodes=20, num_time_steps=100)
    elapsed_time = time.time() - start_time
    
    print(f"\n向量化批量计算: {len(base_tensions)}个基础张力值")
    print(f"计算耗时: {elapsed_time:.3f} 秒")
    print(f"输出形状: {batch_result.shape}")
    
    return batch_result


def save_config_files():
    print("\n" + "=" * 60)
    print("保存配置文件")
    print("=" * 60)
    
    config = {
        "pattern": "plain",
        "warp_count": 20,
        "weft_count": 20,
        "base_tension": 100.0,
        "friction_coefficient": 0.3,
        "simulation_time": 1.0,
        "time_steps": 100
    }
    
    with open('config/weave_config.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    bamboo_config = {
        "species": [
            {
                "name": "Phyllostachys pubescens",
                "youngs_modulus": 1.2e10,
                "shear_modulus": 5.0e9,
                "density": 780.0,
                "tensile_strength": 120e6,
                "poisson_ratio": 0.3
            },
            {
                "name": "Phyllostachys bambusoides",
                "youngs_modulus": 1.5e10,
                "shear_modulus": 6.0e9,
                "density": 820.0,
                "tensile_strength": 150e6,
                "poisson_ratio": 0.28
            }
        ],
        "strips": [
            {
                "species_name": "Phyllostachys pubescens",
                "length": 1.0,
                "width": 0.005,
                "thickness": 0.001,
                "moisture_content": 12.0
            }
        ]
    }
    
    with open('config/bamboo_config.json', 'w', encoding='utf-8') as f:
        json.dump(bamboo_config, f, indent=2, ensure_ascii=False)
    
    print("配置文件已保存到 config 目录")


def main():
    import os
    os.makedirs('output', exist_ok=True)
    os.makedirs('config', exist_ok=True)
    
    print("\n古法竹编工艺张力数值模拟系统")
    print("=" * 60)
    
    data_collector, simulator, static_result = run_basic_simulation()
    run_visualization(static_result)
    run_optimization(data_collector, simulator)
    compare_weave_patterns(data_collector, simulator)
    run_dynamic_simulation(data_collector, simulator)
    
    multi_result, multi_simulator = run_multi_pattern_simulation(data_collector)
    
    run_simulation_vs_test_comparison(static_result)
    
    run_optimized_numerical_computation()
    
    save_config_files()
    
    print("\n" + "=" * 60)
    print("所有任务完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
