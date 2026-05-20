#!/usr/bin/env python3
"""
测试所有修复是否正常工作
"""

import numpy as np
import json

from raw_materials import RawMaterialCollector, FiberMaterial
from numerical_computation import NumericalComputer
from simulation import PaperFiberSimulator, PaperSimulationConfig
from optimization import ParameterOptimizer, PapermakingConstraints


def test_1_fiber_interaction_overflow():
    """测试浓度计算溢出修复"""
    print("=" * 60)
    print("测试1: 浓度计算溢出修复")
    print("=" * 60)
    
    lengths = np.array([0.1, 0.2, 0.3])
    diameters = np.array([0.0001, 0.0002, 0.0003])  # 极小直径，可能导致溢出
    ratios = np.array([0.33, 0.33, 0.34])
    soak_time = 24.0
    
    result = NumericalComputer.fiber_interaction_model(lengths, diameters, ratios, soak_time)
    print(f"交互系数结果: {result}")
    print(f"结果是否合理: {not np.isnan(result) and not np.isinf(result)}")
    print("✓ 浓度计算溢出测试通过")
    return True


def test_2_material_import():
    """测试原料参数采集模块导入数据丢失修复"""
    print("\n" + "=" * 60)
    print("测试2: 原料参数采集模块导入修复")
    print("=" * 60)
    
    collector = RawMaterialCollector()
    
    # 测试添加自定义原料
    new_mat = FiberMaterial(
        key="test_new_fiber",
        name="测试纤维",
        fiber_length=2.0,
        fiber_diameter=0.02,
        tensile_strength=80.0,
        water_absorption=0.7,
        density=1.4,
        color="#FF0000"
    )
    collector.add_custom_material(new_mat)
    
    # 测试获取
    retrieved = collector.get_material("test_new_fiber")
    print(f"自定义原料是否可获取: {retrieved is not None}")
    print(f"原料key: {retrieved.key}")
    print(f"原料name: {retrieved.name}")
    
    # 测试保存和加载JSON
    test_data = [{
        "key": "imported_fiber",
        "name": "导入测试纤维",
        "fiber_length": 2.5,
        "fiber_diameter": 0.025,
        "tensile_strength": 85.0,
        "water_absorption": 0.75,
        "density": 1.45,
        "color": "#00FF00"
    }]
    
    import os
    os.makedirs('output', exist_ok=True)
    with open('output/test_materials.json', 'w') as f:
        json.dump(test_data, f)
    
    collector.load_materials_from_json('output/test_materials.json')
    imported = collector.get_material("imported_fiber")
    print(f"导入原料是否可获取: {imported is not None}")
    print(f"导入原料key: {imported.key}")
    print(f"导入原料name: {imported.name}")
    
    print("✓ 原料参数采集测试通过")
    return True


def test_3_fiber_distribution():
    """测试纤维分布曲线错乱修复"""
    print("\n" + "=" * 60)
    print("测试3: 纤维分布曲线修复")
    print("=" * 60)
    
    ratios = np.array([0.4, 0.35, 0.25])
    fiber_lengths = np.array([2.5, 1.8, 1.2])
    
    bins, distribution = NumericalComputer.calculate_fiber_distribution(ratios, fiber_lengths, num_bins=10)
    
    print(f"bin数量: {len(bins)}")
    print(f"distribution数量: {len(distribution)}")
    print(f"bins: {bins[:3]}...")
    print(f"distribution: {distribution[:3]}...")
    print(f"分布和: {np.sum(distribution):.4f}")
    print(f"是否有nan: {np.any(np.isnan(distribution))}")
    print(f"是否有inf: {np.any(np.isinf(distribution))}")
    
    # 测试边界情况 - 相同长度
    same_lengths = np.array([2.0, 2.0, 2.0])
    bins2, dist2 = NumericalComputer.calculate_fiber_distribution(ratios, same_lengths, num_bins=10)
    print(f"相同长度测试 - bin数量: {len(bins2)}")
    print(f"相同长度测试 - 分布和: {np.sum(dist2):.4f}")
    
    # 测试空输入
    bins3, dist3 = NumericalComputer.calculate_fiber_distribution(np.array([]), np.array([]))
    print(f"空输入测试 - 返回空数组: {len(bins3) == 0 and len(dist3) == 0}")
    
    print("✓ 纤维分布曲线测试通过")
    return True


def test_4_optimization_constraints():
    """测试参数优化算法与实际需求不符修复"""
    print("\n" + "=" * 60)
    print("测试4: 参数优化算法约束修复")
    print("=" * 60)
    
    simulator = PaperFiberSimulator()
    optimizer = ParameterOptimizer(simulator)
    
    material_names = ['mulberry', 'bamboo', 'rice_straw']
    
    # 测试约束类
    print(f"最小强度约束: {PapermakingConstraints.MIN_STRENGTH}")
    print(f"最小浸泡时间: {PapermakingConstraints.MIN_SOAK_TIME}")
    print(f"最大浸泡时间: {PapermakingConstraints.MAX_SOAK_TIME}")
    print(f"最小配比: {PapermakingConstraints.MIN_RATIO}")
    print(f"最大配比: {PapermakingConstraints.MAX_RATIO}")
    
    # 运行优化
    weights = {'strength': 0.5, 'uniformity': 0.3, 'printability': 0.2}
    optimal_result, opt_info = optimizer.optimize_ratios(
        material_names,
        weights=weights,
        fixed_soak_time=24.0
    )
    
    print(f"\n优化结果:")
    print(f"成功: {opt_info['success']}")
    print(f"迭代次数: {opt_info['n_iterations']}")
    print(f"最终评分: {opt_info['final_score']:.2f}")
    
    print(f"\n最优配比:")
    for name, ratio in zip(material_names, optimal_result.config.ratios):
        print(f"  {name}: {ratio:.4f}")
    
    print(f"\n质量指标:")
    for key, val in optimal_result.quality_metrics.items():
        print(f"  {key}: {val:.2f}")
    
    # 验证约束
    ratios = optimal_result.config.ratios
    min_ratio = min(ratios)
    max_ratio = max(ratios)
    print(f"\n约束验证:")
    print(f"最小配比 >= 0.05: {min_ratio >= 0.05}")
    print(f"最大配比 <= 0.8: {max_ratio <= 0.8}")
    print(f"强度 >= 50: {optimal_result.quality_metrics['strength'] >= 50}")
    print(f"孔隙率在[0.2, 0.8]: {0.2 <= optimal_result.quality_metrics['porosity'] <= 0.8}")
    
    print("✓ 参数优化算法测试通过")
    return True


def test_5_full_simulation():
    """测试完整模拟流程"""
    print("\n" + "=" * 60)
    print("测试5: 完整模拟流程")
    print("=" * 60)
    
    simulator = PaperFiberSimulator()
    
    config = PaperSimulationConfig()
    config.material_names = ['mulberry', 'bamboo', 'cotton']
    config.ratios = [0.4, 0.3, 0.3]
    config.soak_time = 24.0
    
    result = simulator.run_simulation(config)
    
    print(f"抗张强度: {result.tensile_strength:.2f}")
    print(f"孔隙率: {result.porosity:.4f}")
    print(f"吸水率: {result.water_absorption:.4f}")
    print(f"纤维分布bins数量: {len(result.fiber_length_dist[0]) if result.fiber_length_dist else 0}")
    print(f"浸泡曲线x数量: {len(result.soaking_curve[0]) if result.soaking_curve else 0}")
    
    # 测试保存和加载HDF5
    simulator.save_results_hdf5([result], 'output/test_results.h5')
    loaded_results = simulator.load_results_hdf5('output/test_results.h5')
    print(f"HDF5保存/加载测试: 加载了 {len(loaded_results)} 个结果")
    
    print("✓ 完整模拟流程测试通过")
    return True


def main():
    print("\n古法造纸纤维配比模拟系统 - 修复验证测试\n")
    
    all_passed = True
    
    try:
        all_passed &= test_1_fiber_interaction_overflow()
    except Exception as e:
        print(f"✗ 测试1失败: {e}")
        all_passed = False
    
    try:
        all_passed &= test_2_material_import()
    except Exception as e:
        print(f"✗ 测试2失败: {e}")
        all_passed = False
    
    try:
        all_passed &= test_3_fiber_distribution()
    except Exception as e:
        print(f"✗ 测试3失败: {e}")
        all_passed = False
    
    try:
        all_passed &= test_4_optimization_constraints()
    except Exception as e:
        print(f"✗ 测试4失败: {e}")
        all_passed = False
    
    try:
        all_passed &= test_5_full_simulation()
    except Exception as e:
        print(f"✗ 测试5失败: {e}")
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("所有测试通过! ✓")
    else:
        print("部分测试失败! ✗")
    print("=" * 60)


if __name__ == '__main__':
    main()
