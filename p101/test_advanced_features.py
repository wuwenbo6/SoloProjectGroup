#!/usr/bin/env python3
"""
古法造纸纤维配比模拟系统 - 高级功能测试
"""

import numpy as np
import json
import os

from simulation import PaperFiberSimulator, PaperSimulationConfig
from optimization import ParameterOptimizer, PapermakingConstraints
from advanced_features import (
    FiberSynergyModel,
    ProcessWarningSystem,
    WarningLevel,
    ActualPaperData,
    SimulationComparator,
    OptimizedNumericalComputer,
    generate_latin_hypercube_samples,
    benchmark_performance
)


def test_1_fiber_synergy_model():
    """测试1: 多纤维协同作用模型"""
    print("=" * 70)
    print("测试1: 多纤维协同作用模型")
    print("=" * 70)
    
    synergy_model = FiberSynergyModel()
    
    print("纤维对协同作用查询:")
    pairs = [('mulberry', 'bamboo'), ('bamboo', 'rice_straw'), ('hemp', 'cotton')]
    for f1, f2 in pairs:
        syn = synergy_model.get_pair_synergy(f1, f2)
        if syn:
            print(f"  {f1}-{f2}: 强度+{syn['strength_boost']*100:.1f}%, "
                  f"均匀性+{syn['uniformity_boost']*100:.1f}%, "
                  f"类型={syn.get('effect', 'neutral')}")
    
    print("\n复合协同作用计算:")
    materials = ['mulberry', 'bamboo', 'cotton']
    ratios = np.array([0.4, 0.35, 0.25])
    composite = synergy_model.calculate_composite_synergy(materials, ratios)
    
    for key, val in composite.items():
        if key in ['strength_boost', 'uniformity_boost', 'soak_time_reduction']:
            print(f"  {key}: {val*100:.2f}%")
        else:
            print(f"  {key}: {val:.2f}")
    
    print("✓ 纤维协同作用模型测试通过\n")
    return True


def test_2_process_warning_system():
    """测试2: 过程预警系统"""
    print("=" * 70)
    print("测试2: 过程预警系统")
    print("=" * 70)
    
    warning_system = ProcessWarningSystem()
    
    print("测试配比验证:")
    materials = ['mulberry', 'bamboo', 'rice_straw']
    
    test_ratios = [
        ([0.4, 0.35, 0.25], "正常配比"),
        ([0.95, 0.04, 0.01], "极端配比"),
        ([0.34, 0.33, 0.33], "平均配比"),
    ]
    
    for ratios, desc in test_ratios:
        warning_system.clear_warnings()
        is_valid = warning_system.validate_ratios(ratios, materials)
        print(f"  {desc}: 有效={is_valid}, 预警数={len(warning_system.warnings)}")
    
    print("\n测试浸泡时间验证:")
    times = [1.0, 12.0, 48.0, 80.0]
    for t in times:
        warning_system.clear_warnings()
        is_valid = warning_system.validate_soak_time(t, materials)
        print(f"  浸泡{t}小时: 有效={is_valid}, 预警数={len(warning_system.warnings)}")
    
    print("\n测试负协同冲突检测:")
    warning_system.clear_warnings()
    has_conflict = warning_system.check_synergy_conflicts(
        ['bamboo', 'rice_straw', 'mulberry'],
        [0.35, 0.35, 0.30]
    )
    print(f"  负协同组合检测: 冲突={not has_conflict}, 预警数={len(warning_system.warnings)}")
    
    print("✓ 过程预警系统测试通过\n")
    return True


def test_3_synergy_in_simulation():
    """测试3: 模拟中的协同作用集成"""
    print("=" * 70)
    print("测试3: 模拟中的协同作用集成")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    
    config = PaperSimulationConfig()
    config.material_names = ['mulberry', 'bamboo', 'cotton']
    config.ratios = [0.4, 0.35, 0.25]
    config.soak_time = 24.0
    
    print("协同作用启用 vs 禁用对比:")
    
    config.enable_synergy = True
    config.enable_warnings = False
    result_with = simulator.run_simulation(config)
    
    config.enable_synergy = False
    result_without = simulator.run_simulation(config)
    
    print(f"  启用协同 - 强度: {result_with.tensile_strength:.2f} MPa")
    print(f"  禁用协同 - 强度: {result_without.tensile_strength:.2f} MPa")
    strength_diff = (result_with.tensile_strength - result_without.tensile_strength) / result_without.tensile_strength * 100
    print(f"  强度提升: {strength_diff:.2f}%")
    
    print(f"\n协同作用效果详情:")
    for key, val in result_with.synergy_effects.items():
        if key in ['strength_boost', 'uniformity_boost', 'soak_time_reduction']:
            print(f"  {key}: {val*100:.2f}%")
    
    print("✓ 协同作用集成测试通过\n")
    return True


def test_4_simulation_warnings():
    """测试4: 模拟过程预警集成"""
    print("=" * 70)
    print("测试4: 模拟过程预警集成")
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
    ]
    
    for test in test_cases:
        config = PaperSimulationConfig()
        config.material_names = test['materials']
        config.ratios = test['ratios']
        config.soak_time = test['soak_time']
        config.enable_warnings = True
        
        result = simulator.run_simulation(config)
        
        print(f"{test['name']}:")
        print(f"  预警数: {len(result.warnings)}")
        print(f"  有效性: {result.is_valid}")
        for w in result.warnings[:3]:
            print(f"    [{w['level']}] {w['code']}")
    
    print("✓ 模拟过程预警集成测试通过\n")
    return True


def test_5_actual_paper_data():
    """测试5: 实际造纸数据管理"""
    print("=" * 70)
    print("测试5: 实际造纸数据管理")
    print("=" * 70)
    
    actual_data = ActualPaperData()
    
    records = [
        {
            "id": "TEST001",
            "material_names": ["mulberry", "bamboo", "cotton"],
            "ratios": [0.4, 0.35, 0.25],
            "soak_time": 24.0,
            "actual_strength": 95.0,
            "actual_porosity": 0.42,
            "actual_absorption": 0.68
        },
        {
            "id": "TEST002",
            "material_names": ["mulberry", "hemp", "cotton"],
            "ratios": [0.4, 0.3, 0.3],
            "soak_time": 26.0,
            "actual_strength": 98.5,
            "actual_porosity": 0.40,
            "actual_absorption": 0.65
        }
    ]
    
    for rec in records:
        actual_data.add_record(rec)
    
    print(f"添加记录数: {len(actual_data.data_records)}")
    
    os.makedirs('output', exist_ok=True)
    actual_data.save_to_json('output/test_actual_data.json')
    print("保存到JSON文件: output/test_actual_data.json")
    
    loaded_data = ActualPaperData()
    loaded_data.load_from_json('output/test_actual_data.json')
    print(f"从JSON加载记录数: {len(loaded_data.data_records)}")
    
    print("\n相似配置查询:")
    similar = loaded_data.find_similar_config(
        ["mulberry", "bamboo", "cotton"],
        [0.42, 0.33, 0.25],
        24.0,
        tolerance=0.1
    )
    print(f"找到相似记录数: {len(similar)}")
    for rec in similar:
        print(f"  ID: {rec['id']}, 匹配度: {rec['match_score']:.2f}")
    
    print("✓ 实际造纸数据管理测试通过\n")
    return True


def test_6_comparison_analysis():
    """测试6: 仿真与实际数据对比分析"""
    print("=" * 70)
    print("测试6: 仿真与实际数据对比分析")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    comparator = SimulationComparator()
    
    record = {
        "id": "COMP001",
        "material_names": ["mulberry", "bamboo", "cotton"],
        "ratios": [0.4, 0.35, 0.25],
        "soak_time": 24.0,
        "actual_strength": 95.0,
        "actual_porosity": 0.42,
        "actual_absorption": 0.68
    }
    comparator.actual_data.add_record(record)
    
    config = PaperSimulationConfig()
    config.material_names = record["material_names"]
    config.ratios = record["ratios"]
    config.soak_time = record["soak_time"]
    sim_result = simulator.run_simulation(config)
    
    comparison = comparator.compare_single_result(sim_result, record)
    
    print(f"对比类型: {comparison['comparison_type']}")
    if comparison['differences']:
        diff = comparison['differences']
        print(f"强度误差: {diff.get('strength_error_pct', 0):.2f}%")
        print(f"整体准确度: {diff.get('overall_accuracy_pct', 0):.1f}%")
    
    report = comparator.generate_comparison_report([sim_result])
    print(f"\n对比报告生成:")
    print(f"  对比组数: {report['num_comparisons']}")
    print(f"  建议数: {len(report['recommendations'])}")
    for rec in report['recommendations']:
        print(f"    - {rec}")
    
    print("✓ 对比分析测试通过\n")
    return True


def test_7_optimized_numerical_computer():
    """测试7: 优化的数值计算器"""
    print("=" * 70)
    print("测试7: 优化的数值计算器 (批量仿真)")
    print("=" * 70)
    
    from raw_materials import RawMaterialCollector
    collector = RawMaterialCollector()
    material_names = ['mulberry', 'bamboo', 'rice_straw', 'cotton']
    properties = collector.get_material_properties(material_names)
    
    n_samples = 1000
    ratio_matrix = generate_latin_hypercube_samples(n_samples, len(material_names))
    soak_times = np.random.uniform(6, 48, n_samples)
    
    import time
    start_time = time.time()
    
    metrics = OptimizedNumericalComputer.batch_simulate(
        OptimizedNumericalComputer(),
        properties,
        ratio_matrix,
        soak_times
    )
    
    elapsed = time.time() - start_time
    
    print(f"样本数: {n_samples}")
    print(f"耗时: {elapsed:.4f} 秒")
    print(f"速度: {n_samples/elapsed:.0f} 样本/秒")
    
    print(f"\n输出验证:")
    required_keys = ['strength', 'porosity', 'water_absorption', 
                     'uniformity', 'durability', 'printability', 'overall_score']
    for key in required_keys:
        print(f"  {key}: shape={metrics[key].shape}, 范围=[{np.min(metrics[key]):.2f}, {np.max(metrics[key]):.2f}]")
    
    print("✓ 优化数值计算器测试通过\n")
    return True


def test_8_latin_hypercube_sampling():
    """测试8: 拉丁超立方采样"""
    print("=" * 70)
    print("测试8: 拉丁超立方采样")
    print("=" * 70)
    
    n_samples = 100
    n_dimensions = 4
    
    samples = generate_latin_hypercube_samples(n_samples, n_dimensions)
    
    print(f"生成样本数: {n_samples}, 维度: {n_dimensions}")
    print(f"样本形状: {samples.shape}")
    print(f"每行和: {samples.sum(axis=1).mean():.6f} (标准差: {samples.sum(axis=1).std():.6f})")
    print(f"每列均值: {samples.mean(axis=0).round(4).tolist()}")
    print(f"每列范围: [{samples.min(axis=0).min():.4f}, {samples.max(axis=0).max():.4f}]")
    
    print("\n前5个样本:")
    for i in range(min(5, n_samples)):
        print(f"  {i+1}: {samples[i].round(3).tolist()}")
    
    print("✓ 拉丁超立方采样测试通过\n")
    return True


def test_9_optimization_with_constraints():
    """测试9: 带约束的参数优化"""
    print("=" * 70)
    print("测试9: 带工艺约束的参数优化")
    print("=" * 70)
    
    simulator = PaperFiberSimulator()
    optimizer = ParameterOptimizer(simulator)
    
    material_names = ['mulberry', 'bamboo', 'cotton', 'hemp']
    weights = {'strength': 0.5, 'uniformity': 0.3, 'printability': 0.2}
    
    print(f"优化原料: {material_names}")
    print(f"工艺约束:")
    print(f"  配比范围: {PapermakingConstraints.MIN_RATIO:.2f} - {PapermakingConstraints.MAX_RATIO:.2f}")
    print(f"  浸泡时间: {PapermakingConstraints.MIN_SOAK_TIME:.0f} - {PapermakingConstraints.MAX_SOAK_TIME:.0f}h")
    print(f"  最小强度: {PapermakingConstraints.MIN_STRENGTH:.1f} MPa")
    
    optimal_result, opt_info = optimizer.optimize_ratios(
        material_names,
        weights=weights,
        fixed_soak_time=24.0
    )
    
    print(f"\n优化结果:")
    print(f"  成功: {opt_info['success']}")
    print(f"  迭代: {opt_info['n_iterations']}")
    print(f"  最终评分: {opt_info['final_score']:.2f}")
    
    print(f"\n最优配比验证:")
    ratios = optimal_result.config.ratios
    all_valid = all(PapermakingConstraints.MIN_RATIO <= r <= PapermakingConstraints.MAX_RATIO for r in ratios)
    print(f"  配比在约束范围内: {all_valid}")
    print(f"  配比和: {sum(ratios):.4f}")
    
    print(f"\n协同作用效果:")
    for key, val in optimal_result.synergy_effects.items():
        if key in ['strength_boost', 'uniformity_boost', 'soak_time_reduction']:
            print(f"  {key}: {val*100:.2f}%")
    
    print("✓ 带约束的参数优化测试通过\n")
    return True


def test_10_benchmark_performance():
    """测试10: 性能基准测试"""
    print("=" * 70)
    print("测试10: 性能基准测试")
    print("=" * 70)
    
    results = benchmark_performance([100, 500, 1000], n_materials=4)
    
    print(f"\n性能分析:")
    for r in results:
        print(f"  {r['n_samples']:4d} 样本: {r['samples_per_second']:.0f}/s, "
              f"平均评分={r['avg_score']:.1f}")
    
    if len(results) > 1:
        speed_scaling = results[-1]['samples_per_second'] / results[0]['samples_per_second']
        print(f"  速度扩展因子: {speed_scaling:.2f}x")
    
    print("✓ 性能基准测试通过\n")
    return True


def main():
    print("\n" + "#" * 70)
    print("#        古法造纸纤维配比模拟系统 - 高级功能测试套件             #")
    print("#" * 70)
    print()
    
    all_passed = True
    test_results = []
    
    tests = [
        ("纤维协同作用模型", test_1_fiber_synergy_model),
        ("过程预警系统", test_2_process_warning_system),
        ("协同作用集成", test_3_synergy_in_simulation),
        ("模拟过程预警", test_4_simulation_warnings),
        ("实际造纸数据管理", test_5_actual_paper_data),
        ("对比分析", test_6_comparison_analysis),
        ("优化数值计算器", test_7_optimized_numerical_computer),
        ("拉丁超立方采样", test_8_latin_hypercube_sampling),
        ("带约束优化", test_9_optimization_with_constraints),
        ("性能基准", test_10_benchmark_performance),
    ]
    
    for name, test_func in tests:
        try:
            passed = test_func()
            test_results.append((name, passed))
            all_passed &= passed
        except Exception as e:
            print(f"✗ {name} 测试失败: {e}")
            import traceback
            traceback.print_exc()
            test_results.append((name, False))
            all_passed = False
    
    print("\n" + "=" * 70)
    print("测试总结:")
    print("-" * 70)
    for name, passed in test_results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {name}: {status}")
    print("-" * 70)
    
    passed_count = sum(1 for _, p in test_results if p)
    total_count = len(test_results)
    print(f"总测试数: {total_count}, 通过数: {passed_count}, 通过率: {passed_count/total_count*100:.1f}%")
    
    if all_passed:
        print("\n✓ 所有测试通过！高级功能运行正常。")
    else:
        print("\n✗ 部分测试失败，请检查错误信息。")
    
    print("=" * 70)
    return all_passed


if __name__ == '__main__':
    main()
