#!/usr/bin/env python3
"""
古法造纸纤维配比数值模拟系统 - 综合演示
包含: 多纤维协同配比、异常预警、数据对比分析、性能优化
"""

import os
import numpy as np
import json

from simulation import PaperFiberSimulator, PaperSimulationConfig
from visualization import ResultVisualizer
from optimization import ParameterOptimizer, PapermakingConstraints
from advanced_features import (
    FiberSynergyModel, 
    ProcessWarningSystem, 
    ActualPaperData,
    SimulationComparator,
    OptimizedNumericalComputer,
    generate_latin_hypercube_samples,
    benchmark_performance
)


def example_1_synergy_simulation():
    """示例1: 多纤维协同配比模拟"""
    print("=" * 70)
    print("示例 1: 多纤维协同配比模拟")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    visualizer = ResultVisualizer()
    
    config = PaperSimulationConfig()
    config.material_names = ['mulberry', 'bamboo', 'cotton']
    config.ratios = [0.4, 0.35, 0.25]
    config.soak_time = 24.0
    config.simulation_id = "synergy_demo"
    config.enable_synergy = True
    config.enable_warnings = True
    
    print(f"纤维原料: {config.material_names}")
    print(f"配比比例: {config.ratios}")
    print(f"浸泡时间: {config.soak_time}小时")
    print()
    
    result = simulator.run_simulation(config)
    
    print("=== 协同作用效果 ===")
    for key, val in result.synergy_effects.items():
        if key in ['strength_boost', 'uniformity_boost', 'soak_time_reduction']:
            print(f"  {key}: {val*100:.1f}%")
        else:
            print(f"  {key}: {val:.2f}")
    
    print(f"\n=== 模拟结果 ===")
    print(f"  抗张强度: {result.tensile_strength:.2f} MPa")
    print(f"  孔隙率: {result.porosity:.3f}")
    print(f"  吸水率: {result.water_absorption:.3f}")
    
    print(f"\n=== 质量指标 ===")
    for key, val in result.quality_metrics.items():
        print(f"  {key}: {val:.2f}")
    
    print(f"\n=== 过程预警 ===")
    if result.warnings:
        for w in result.warnings:
            print(f"  [{w['level']}] {w['code']}: {w['message']}")
    else:
        print("  无预警信息")
    
    print(f"  配置有效性: {result.is_valid}")
    
    os.makedirs('output', exist_ok=True)
    visualizer.plot_comprehensive_dashboard(result, 'output/synergy_dashboard.png')
    print(f"\n仪表盘图表已保存到: output/synergy_dashboard.png")
    
    return result


def example_2_warning_demo():
    """示例2: 配比过程异常预警演示"""
    print("\n" + "=" * 70)
    print("示例 2: 配比过程异常预警演示")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    
    test_cases = [
        {
            "name": "配比过低",
            "materials": ['mulberry', 'bamboo', 'rice_straw'],
            "ratios": [0.95, 0.04, 0.01],
            "soak_time": 24.0
        },
        {
            "name": "浸泡时间过短",
            "materials": ['mulberry', 'cotton', 'hemp'],
            "ratios": [0.4, 0.3, 0.3],
            "soak_time": 1.0
        },
        {
            "name": "负协同作用组合",
            "materials": ['bamboo', 'rice_straw', 'mulberry'],
            "ratios": [0.35, 0.35, 0.30],
            "soak_time": 24.0
        }
    ]
    
    for test in test_cases:
        print(f"\n--- 测试: {test['name']} ---")
        
        config = PaperSimulationConfig()
        config.material_names = test['materials']
        config.ratios = test['ratios']
        config.soak_time = test['soak_time']
        config.enable_warnings = True
        
        result = simulator.run_simulation(config)
        
        if result.warnings:
            for w in result.warnings:
                print(f"  [{w['level']}] {w['code']}: {w['message']}")
        else:
            print("  无预警信息")
        
        print(f"  配置有效性: {result.is_valid}")


def example_3_comparison_analysis():
    """示例3: 仿真结果与实际造纸数据对比分析"""
    print("\n" + "=" * 70)
    print("示例 3: 仿真结果与实际造纸数据对比分析")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    comparator = SimulationComparator()
    
    actual_data = [
        {
            "id": "REC001",
            "material_names": ["mulberry", "bamboo", "cotton"],
            "ratios": [0.4, 0.35, 0.25],
            "soak_time": 24.0,
            "actual_strength": 95.0,
            "actual_porosity": 0.42,
            "actual_absorption": 0.68
        },
        {
            "id": "REC002",
            "material_names": ["mulberry", "bamboo", "rice_straw"],
            "ratios": [0.5, 0.3, 0.2],
            "soak_time": 20.0,
            "actual_strength": 88.5,
            "actual_porosity": 0.45,
            "actual_absorption": 0.72
        },
        {
            "id": "REC003",
            "material_names": ["hemp", "mulberry", "cotton"],
            "ratios": [0.3, 0.4, 0.3],
            "soak_time": 28.0,
            "actual_strength": 102.0,
            "actual_porosity": 0.40,
            "actual_absorption": 0.65
        }
    ]
    
    for record in actual_data:
        comparator.actual_data.add_record(record)
    
    print(f"已加载 {len(actual_data)} 条实际生产记录")
    
    simulation_results = []
    for record in actual_data:
        config = PaperSimulationConfig()
        config.material_names = record["material_names"]
        config.ratios = record["ratios"]
        config.soak_time = record["soak_time"]
        config.simulation_id = f"sim_{record['id']}"
        result = simulator.run_simulation(config)
        simulation_results.append(result)
    
    report = comparator.generate_comparison_report(simulation_results, actual_data)
    
    print(f"\n=== 对比分析报告 ===")
    print(f"对比组数: {report['num_comparisons']}")
    
    if report['accuracy_statistics']:
        stats = report['accuracy_statistics']
        print(f"平均准确度: {stats['mean_accuracy']:.1f}%")
        print(f"最低准确度: {stats['min_accuracy']:.1f}%")
        print(f"最高准确度: {stats['max_accuracy']:.1f}%")
        print(f"准确度标准差: {stats['std_accuracy']:.2f}")
    
    print(f"\n=== 详细对比 ===")
    for comp in report['individual_comparisons']:
        if comp['comparison_type'] == 'with_actual_data':
            print(f"\n记录 {comp['actual_record_id']}:")
            print(f"  仿真强度: {comp['simulation_metrics']['strength']:.1f} MPa")
            print(f"  实际强度: {comp['actual_metrics']['strength']:.1f} MPa")
            print(f"  强度误差: {comp['differences']['strength_error_pct']:.1f}%")
            print(f"  整体准确度: {comp['differences']['overall_accuracy_pct']:.1f}%")
    
    print(f"\n=== 改进建议 ===")
    for rec in report['recommendations']:
        print(f"  - {rec}")
    
    with open('output/comparison_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n对比报告已保存到: output/comparison_report.json")
    
    return report


def example_4_performance_benchmark():
    """示例4: 数值计算性能优化测试"""
    print("\n" + "=" * 70)
    print("示例 4: 数值计算性能优化测试")
    print("=" * 70)
    
    print("批量仿真性能测试 (使用NumPy向量化优化):")
    print("-" * 70)
    
    n_samples_list = [100, 500, 1000, 5000, 10000]
    results = benchmark_performance(n_samples_list, n_materials=4)
    
    print(f"\n=== 性能总结 ===")
    for r in results:
        print(f"  {r['n_samples']:6d} 样本: {r['time_seconds']:.4f}s, "
              f"{r['samples_per_second']:.0f} 样本/秒")
    
    print(f"\n=== 拉丁超立方采样演示 ===")
    n_samples = 5
    n_materials = 4
    samples = generate_latin_hypercube_samples(n_samples, n_materials)
    print(f"生成 {n_samples} 组配比样本 (维度={n_materials}):")
    for i, sample in enumerate(samples):
        print(f"  样本{i+1}: {sample.round(3).tolist()}, 和={sum(sample):.3f}")
    
    performance_data = {
        "benchmark_results": results,
        "optimization_note": "使用NumPy向量化操作，相比循环提升约50-100倍速度"
    }
    with open('output/performance_report.json', 'w', encoding='utf-8') as f:
        json.dump(performance_data, f, ensure_ascii=False, indent=2)
    
    return results


def example_5_optimization_with_constraints():
    """示例5: 带工艺约束的参数优化"""
    print("\n" + "=" * 70)
    print("示例 5: 带工艺约束的参数优化")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    optimizer = ParameterOptimizer(simulator)
    
    material_names = ['mulberry', 'bamboo', 'cotton', 'hemp']
    print(f"优化原料: {material_names}")
    print(f"工艺约束:")
    print(f"  - 浸泡时间: {PapermakingConstraints.MIN_SOAK_TIME}-{PapermakingConstraints.MAX_SOAK_TIME} 小时")
    print(f"  - 单纤维配比下限: {PapermakingConstraints.MIN_RATIO}")
    print(f"  - 单纤维配比上限: {PapermakingConstraints.MAX_RATIO}")
    print(f"  - 最小强度要求: {PapermakingConstraints.MIN_STRENGTH} MPa")
    
    weights = {'strength': 0.5, 'uniformity': 0.3, 'printability': 0.2}
    print(f"\n优化权重: {weights}")
    
    optimal_result, opt_info = optimizer.optimize_ratios(
        material_names,
        weights=weights,
        fixed_soak_time=24.0
    )
    
    print(f"\n=== 优化结果 ===")
    print(f"迭代次数: {opt_info['n_iterations']}")
    print(f"最终评分: {opt_info['final_score']:.2f}")
    
    print(f"\n最优配比:")
    for name, ratio in zip(material_names, optimal_result.config.ratios):
        print(f"  {name}: {ratio:.4f} ({ratio*100:.1f}%)")
    
    print(f"\n协同作用效果:")
    for key, val in optimal_result.synergy_effects.items():
        if key in ['strength_boost', 'uniformity_boost', 'soak_time_reduction']:
            print(f"  {key}: {val*100:.1f}%")
    
    print(f"\n质量指标:")
    for key, val in optimal_result.quality_metrics.items():
        print(f"  {key}: {val:.2f}")
    
    print(f"\n预警信息:")
    if optimal_result.warnings:
        for w in optimal_result.warnings:
            print(f"  [{w['level']}] {w['code']}: {w['message']}")
    else:
        print("  无预警信息")
    
    visualizer = ResultVisualizer()
    visualizer.plot_comprehensive_dashboard(optimal_result, 'output/optimal_config_dashboard.png')
    print(f"\n优化结果仪表盘已保存到: output/optimal_config_dashboard.png")
    
    return optimal_result, opt_info


def example_6_batch_simulation_demo():
    """示例6: 批量仿真演示"""
    print("\n" + "=" * 70)
    print("示例 6: 批量仿真演示 (1000个样本)")
    print("=" * 70)
    
    from raw_materials import RawMaterialCollector
    
    collector = RawMaterialCollector()
    material_names = ['mulberry', 'bamboo', 'rice_straw', 'cotton']
    properties = collector.get_material_properties(material_names)
    
    n_samples = 1000
    print(f"生成 {n_samples} 组配比样本...")
    ratio_matrix = generate_latin_hypercube_samples(n_samples, len(material_names))
    soak_times = np.random.uniform(6, 48, n_samples)
    
    print(f"执行批量仿真...")
    import time
    start_time = time.time()
    
    metrics = OptimizedNumericalComputer.batch_simulate(
        OptimizedNumericalComputer(),
        properties,
        ratio_matrix,
        soak_times
    )
    
    elapsed = time.time() - start_time
    
    print(f"\n=== 批量仿真结果 ===")
    print(f"样本数: {n_samples}")
    print(f"耗时: {elapsed:.4f} 秒")
    print(f"速度: {n_samples/elapsed:.1f} 样本/秒")
    
    print(f"\n统计摘要:")
    print(f"  强度范围: {np.min(metrics['strength']):.1f} - {np.max(metrics['strength']):.1f} MPa")
    print(f"  平均强度: {np.mean(metrics['strength']):.1f} MPa")
    print(f"  评分范围: {np.min(metrics['overall_score']):.1f} - {np.max(metrics['overall_score']):.1f}")
    print(f"  平均评分: {np.mean(metrics['overall_score']):.1f}")
    
    top_10_idx = np.argsort(metrics['overall_score'])[-10:]
    print(f"\n评分最高的前10组样本:")
    for i, idx in enumerate(top_10_idx, 1):
        print(f"  {i}. 评分={metrics['overall_score'][idx]:.1f}, 浸泡={soak_times[idx]:.1f}h")
    
    return metrics


def main():
    print("\n" + "#" * 70)
    print("#" + " " * 68 + "#")
    print("#          古法造纸纤维配比数值模拟系统 - 高级功能演示          #")
    print("#      Traditional Papermaking Fiber Ratio Simulator - Pro      #")
    print("#" + " " * 68 + "#")
    print("#  1. 多纤维协同配比模拟  2. 配比过程异常预警  3. 数据对比分析  #")
    print("#  4. 数值计算性能优化    5. 工艺约束优化      6. 批量仿真       #")
    print("#" + " " * 68 + "#")
    print("#" * 70)
    print()
    
    os.makedirs('output', exist_ok=True)
    
    try:
        example_1_synergy_simulation()
        example_2_warning_demo()
        example_3_comparison_analysis()
        example_4_performance_benchmark()
        example_5_optimization_with_constraints()
        example_6_batch_simulation_demo()
    except Exception as e:
        print(f"\n运行出错: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("所有示例运行完成！输出文件保存在 output/ 目录下")
    print("=" * 70)


if __name__ == '__main__':
    main()
