#!/usr/bin/env python3
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from material_collector import Material, MaterialCollector
from numerical_calculator import NumericalCalculator
from advanced_simulation import AdvancedDyeSimulation
from visualization import DyeVisualizer


def test_cooperative_mixture():
    print("=" * 70)
    print("测试1: 多染料协同配比模拟")
    print("=" * 70)
    
    collector = MaterialCollector()
    collector.add_material(Material("红色染料R", 1.0, 300.0, 0.8, [1.0, 0.1, 0.1]))
    collector.add_material(Material("黄色染料Y", 1.0, 280.0, 0.6, [1.0, 0.9, 0.1]))
    collector.add_material(Material("蓝色染料B", 1.0, 320.0, 0.9, [0.1, 0.3, 1.0]))
    collector.add_material(Material("绿色染料G", 1.0, 290.0, 0.7, [0.1, 0.9, 0.3]))
    
    sim = AdvancedDyeSimulation(collector, use_parallel=False)
    
    dye_groups = [['红色染料R', '黄色染料Y'], ['蓝色染料B', '绿色染料G']]
    group_ratios = [0.6, 0.4]
    
    result = sim.run_cooperative_mixture_simulation(
        dye_groups, group_ratios, temperature=70.0, 
        time_span=(0, 80), interaction_strength=0.15
    )
    
    print(f"\n模拟结果:")
    print(f"  - 反应产率: {result['reaction_yield']:.2f}%")
    print(f"  - 染料组: {result['dye_groups']}")
    print(f"  - 组配比: {result['group_ratios']}")
    print(f"  - 相互作用强度: {result['interaction_strength']}")
    print(f"  - 相互作用数量: {result['interaction_effects']['total_interactions']}")
    
    return result


def test_warning_system():
    print("\n" + "=" * 70)
    print("测试2: 配比过程异常预警功能")
    print("=" * 70)
    
    collector = MaterialCollector()
    collector.add_material(Material("红色染料R", 1.0, 300.0, 0.8, [1.0, 0.1, 0.1]))
    collector.add_material(Material("蓝色染料B", 1.0, 320.0, 0.9, [0.1, 0.3, 1.0]))
    
    sim = AdvancedDyeSimulation(collector, use_parallel=False)
    
    ratios = {'红色染料R': 0.7, '蓝色染料B': 0.4}
    
    result = sim.run_single_simulation_optimized(ratios, temperature=180.0, num_points=50)
    
    print(f"\n产生的警告数量: {len(sim.warnings)}")
    for w in sim.warnings:
        print(f"  - [{w['level'].upper()}] {w['code']}: {w['message']}")
    
    return result


def test_comparison_analysis():
    print("\n" + "=" * 70)
    print("测试3: 仿真结果与实际染色数据对比分析")
    print("=" * 70)
    
    collector = MaterialCollector()
    collector.add_material(Material("红色染料R", 1.0, 300.0, 0.8, [1.0, 0.1, 0.1]))
    collector.add_material(Material("蓝色染料B", 1.0, 320.0, 0.9, [0.1, 0.3, 1.0]))
    
    sim = AdvancedDyeSimulation(collector, use_parallel=False)
    
    ratios = {'红色染料R': 0.5, '蓝色染料B': 0.5}
    sim_result = sim.run_single_simulation_optimized(ratios, temperature=70.0, num_points=50)
    
    actual_data = {
        'reaction_yield': sim_result['reaction_yield'] * 0.95,
        'final_color': 0.6 * sim_result['final_color'] + 0.4 * np.array([0.9, 0.3, 0.5])
    }
    
    print(f"\n仿真结果:")
    print(f"  - 反应产率: {sim_result['reaction_yield']:.2f}%")
    print(f"  - 最终颜色: {sim_result['final_color'].round(3)}")
    
    print(f"\n实际数据:")
    print(f"  - 反应产率: {actual_data['reaction_yield']:.2f}%")
    print(f"  - 最终颜色: {actual_data['final_color'].round(3)}")
    
    comparison = sim.compare_with_actual_data(sim_result, actual_data)
    
    print(f"\n对比结果:")
    print(f"  - 总参数数量: {comparison['total_parameters']}")
    print(f"  - 通过数量: {comparison['passed_parameters']}")
    print(f"  - 整体通过率: {comparison['overall_pass_rate']:.2%}")
    print(f"  - 全部通过: {comparison['all_passed']}")
    
    for r in comparison['detailed_results']:
        status = "✓" if r['passed'] else "✗"
        print(f"  {status} {r['parameter_name']}: 相对误差={r['relative_error']:.4f}")
    
    return comparison


def test_grid_search():
    print("\n" + "=" * 70)
    print("测试4: 多染料网格搜索优化")
    print("=" * 70)
    
    collector = MaterialCollector()
    collector.add_material(Material("红色染料R", 1.0, 300.0, 0.8, [1.0, 0.1, 0.1]))
    collector.add_material(Material("黄色染料Y", 1.0, 280.0, 0.6, [1.0, 0.9, 0.1]))
    collector.add_material(Material("蓝色染料B", 1.0, 320.0, 0.9, [0.1, 0.3, 1.0]))
    
    sim = AdvancedDyeSimulation(collector, use_parallel=False)
    
    param_grid = {
        '红色染料R': [0.2, 0.4, 0.6, 0.8],
        '黄色染料Y': [0.2, 0.4, 0.6, 0.8],
        '蓝色染料B': [0.2, 0.4, 0.6, 0.8]
    }
    
    grid_result = sim.run_multi_dye_grid_search(
        param_grid, temperature=65.0, time_span=(0, 60),
        maximize=True
    )
    
    print(f"\n网格搜索结果:")
    print(f"  - 总组合数: {grid_result['total_combinations']}")
    print(f"  - 最优目标值: {grid_result['best_objective_value']:.4f}")
    print(f"  - 最优配比: {grid_result['best_result']['ratios']}")
    
    return grid_result


def test_vectorized_batch():
    print("\n" + "=" * 70)
    print("测试5: 向量化批量模拟（计算速度优化")
    print("=" * 70)
    
    collector = MaterialCollector()
    collector.add_material(Material("红色染料R", 1.0, 300.0, 0.8, [1.0, 0.1, 0.1]))
    collector.add_material(Material("黄色染料Y", 1.0, 280.0, 0.6, [1.0, 0.9, 0.1]))
    collector.add_material(Material("蓝色染料B", 1.0, 320.0, 0.9, [0.1, 0.3, 1.0]))
    
    sim = AdvancedDyeSimulation(collector, use_parallel=False)
    
    n_simulations = 10
    ratio_matrix = np.random.rand(n_simulations, 3)
    ratio_matrix = ratio_matrix / ratio_matrix.sum(axis=1, keepdims=True)
    temperature_vector = np.random.uniform(50, 90, n_simulations)
    
    print(f"\n执行 {n_simulations} 组批量模拟...")
    
    import time
    start_time = time.time()
    batch_result = sim.vectorized_batch_simulation(
        ratio_matrix, temperature_vector, time_span=(0, 50), num_points=30
    )
    elapsed_time = time.time() - start_time
    
    print(f"\n批量模拟完成:")
    print(f"  - 模拟数量: {batch_result['n_simulations']}组")
    print(f"  - 耗时: {elapsed_time:.3f}秒")
    print(f"  - 平均每组: {elapsed_time/n_simulations:.3f}秒")
    
    return batch_result


def test_visualization():
    print("\n" + "=" * 70)
    print("测试6: 高级可视化功能")
    print("=" * 70)
    
    collector = MaterialCollector()
    collector.add_material(Material("红色染料R", 1.0, 300.0, 0.8, [1.0, 0.1, 0.1]))
    collector.add_material(Material("黄色染料Y", 1.0, 280.0, 0.6, [1.0, 0.9, 0.1]))
    collector.add_material(Material("蓝色染料B", 1.0, 320.0, 0.9, [0.1, 0.3, 1.0]))
    
    sim = AdvancedDyeSimulation(collector, use_parallel=False)
    visualizer = DyeVisualizer()
    
    dye_groups = [['红色染料R', '黄色染料Y'], ['蓝色染料B']]
    group_ratios = [0.6, 0.4]
    coop_result = sim.run_cooperative_mixture_simulation(
        dye_groups, group_ratios, temperature=70.0, interaction_strength=0.1
    )
    
    actual_data = {
        'reaction_yield': coop_result['reaction_yield'] * 0.92,
        'final_color': coop_result['final_color'] * 0.95
    }
    comparison = sim.compare_with_actual_data(coop_result, actual_data)
    
    output_dir = 'test_advanced_output'
    os.makedirs(output_dir, exist_ok=True)
    
    visualizer.create_advanced_report(
        coop_result, comparison, output_dir=output_dir
    )
    
    print(f"\n可视化报告已生成到: {output_dir}/")
    print(f"  - concentration_curve.png")
    print(f"  - color_evolution.png")
    print(f"  - warnings_summary.png")
    print(f"  - sim_vs_actual.png")
    print(f"  - interaction_effects.png")


def main():
    print("\n" + "=" * 70)
    print("染料配比模拟系统 - 高级功能测试套件")
    print("=" * 70 + "\n")
    
    try:
        result1 = test_cooperative_mixture()
    except Exception as e:
        print(f"测试1失败: {e}")
        import traceback
        traceback.print_exc()
    
    try:
        result2 = test_warning_system()
    except Exception as e:
        print(f"测试2失败: {e}")
    
    try:
        result3 = test_comparison_analysis()
    except Exception as e:
        print(f"测试3失败: {e}")
    
    try:
        result4 = test_grid_search()
    except Exception as e:
        print(f"测试4失败: {e}")
    
    try:
        result5 = test_vectorized_batch()
    except Exception as e:
        print(f"测试5失败: {e}")
    
    try:
        test_visualization()
    except Exception as e:
        print(f"测试6失败: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("所有测试完成!")
    print("=" * 70)


if __name__ == "__main__":
    main()
