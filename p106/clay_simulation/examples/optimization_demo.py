#!/usr/bin/env python3
"""
传统泥塑工艺参数优化演示
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_acquisition import ParameterCollector
from force_simulation import ForceSimulator, SimulationConfig
from optimization import ParameterOptimizer, OptimizationConstraints
from visualization import ResultVisualizer
from data_storage import DataStorage


def optimization_demo():
    """参数优化演示"""
    print("=" * 60)
    print("传统泥塑工艺 - 参数优化演示")
    print("=" * 60)

    collector = ParameterCollector()
    optimizer = ParameterOptimizer(collector)
    visualizer = ResultVisualizer()
    storage = DataStorage()

    base_config = SimulationConfig(
        clay_type='kaolin',
        force_magnitude=1000.0,
        force_direction=(0, -1),
        grid_size=(20, 20),
        simulation_time=0,
        time_steps=0
    )

    constraints = OptimizationConstraints(
        target_safety_factor=1.5,
        max_allowable_stress=None,
        max_allowable_deformation=None,
        moisture_range=(0.15, 0.40),
        force_range=(500.0, 2000.0),
        clay_types=['kaolin', 'bentonite', 'red_clay']
    )

    weights = {
        'minimize_stress': 1.0,
        'minimize_deformation': 0.5,
        'maximize_safety_factor': 1.0,
        'maximize_force_magnitude': 0.0
    }

    print(f"\n优化配置:")
    print(f"  目标安全系数: {constraints.target_safety_factor}")
    print(f"  含水量范围: {constraints.moisture_range}")
    print(f"  力范围: {constraints.force_range}")
    print(f"  可选泥料: {constraints.clay_types}")
    print(f"\n开始网格搜索优化...")

    opt_result = optimizer.grid_search_optimization(
        base_config=base_config,
        constraints=constraints,
        weights=weights,
        resolution=8
    )

    print(f"\n优化结果:")
    print(f"  最优泥料: {opt_result.optimal_clay_type}")
    print(f"  最优含水量: {opt_result.optimal_parameters['moisture_content']:.3f}")
    print(f"  最优力大小: {opt_result.optimal_parameters['force_magnitude']:.1f} N")
    print(f"  预测最大应力: {opt_result.predicted_stress:.2e} Pa")
    print(f"  预测最大变形: {opt_result.predicted_deformation:.2e}")
    print(f"  安全系数: {opt_result.safety_factor:.2f}")
    print(f"  目标函数值: {opt_result.objective_value:.2e}")

    output_dir = "demo_output"
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n生成优化过程可视化...")
    visualizer.plot_optimization_history(
        opt_result,
        show=False,
        save_path=os.path.join(output_dir, 'optimization_history.png')
    )
    print("  优化历史图像已保存")

    opt_path = storage.save_optimization_results(
        opt_result,
        base_config,
        {
            'target_safety_factor': constraints.target_safety_factor,
            'moisture_range': list(constraints.moisture_range),
            'force_range': list(constraints.force_range),
            'clay_types': constraints.clay_types
        },
        weights
    )
    print(f"  优化结果已保存: {opt_path}")

    print(f"\n{'=' * 60}")
    print("参数优化演示完成!")
    print(f"{'=' * 60}\n")


def multi_objective_optimization_demo():
    """多目标优化演示"""
    print("\n" + "=" * 60)
    print("多目标优化演示 (Pareto前沿)")
    print("=" * 60)

    collector = ParameterCollector()
    optimizer = ParameterOptimizer(collector)
    visualizer = ResultVisualizer()

    base_config = SimulationConfig(
        clay_type='kaolin',
        force_magnitude=1000.0,
        force_direction=(0, -1),
        grid_size=(15, 15),
        simulation_time=0,
        time_steps=0
    )

    constraints = OptimizationConstraints(
        target_safety_factor=1.2,
        moisture_range=(0.18, 0.35),
        force_range=(800.0, 1500.0),
        clay_types=['kaolin', 'red_clay']
    )

    print(f"\n开始多目标优化...")
    pareto_front = optimizer.multi_objective_optimization(
        base_config=base_config,
        constraints=constraints,
        objectives=['minimize_stress', 'minimize_deformation', 'maximize_safety_factor'],
        n_samples=100
    )

    print(f"找到 {len(pareto_front)} 个Pareto最优解")

    output_dir = "demo_output"
    os.makedirs(output_dir, exist_ok=True)

    visualizer.plot_pareto_front(
        pareto_front,
        show=False,
        save_path=os.path.join(output_dir, 'pareto_front.png')
    )
    print("  Pareto前沿图像已保存")

    print(f"\nPareto前沿统计:")
    stresses = [r.predicted_stress for r in pareto_front]
    deformations = [r.predicted_deformation for r in pareto_front]
    safety_factors = [r.safety_factor for r in pareto_front]
    print(f"  应力范围: {min(stresses):.2e} - {max(stresses):.2e} Pa")
    print(f"  变形范围: {min(deformations):.2e} - {max(deformations):.2e}")
    print(f"  安全系数范围: {min(safety_factors):.2f} - {max(safety_factors):.2f}")

    print(f"\n{'=' * 60}")
    print("多目标优化演示完成!")
    print(f"{'=' * 60}\n")


def surrogate_model_demo():
    """代理模型演示"""
    print("\n" + "=" * 60)
    print("代理模型演示")
    print("=" * 60)

    collector = ParameterCollector()
    optimizer = ParameterOptimizer(collector)

    base_config = SimulationConfig(
        clay_type='kaolin',
        force_magnitude=1000.0,
        force_direction=(0, -1),
        grid_size=(15, 15),
        simulation_time=0,
        time_steps=0
    )

    print(f"\n构建代理模型 (基于随机森林)...")
    print("  (这可能需要一些时间...)")

    optimizer.build_surrogate_model(
        base_config=base_config,
        n_training_samples=50
    )

    print("  代理模型构建完成!")

    print(f"\n使用代理模型进行快速预测:")
    test_cases = [
        (0.20, 800.0, 'kaolin'),
        (0.25, 1000.0, 'kaolin'),
        (0.30, 1200.0, 'red_clay')
    ]

    for moisture, force, clay in test_cases:
        pred_stress, pred_deformation = optimizer.predict_with_surrogate(moisture, force, clay)
        print(f"  含水量={moisture:.2f}, 力={force:.1f}N, 泥料={clay}:")
        print(f"    预测应力: {pred_stress:.2e} Pa")
        print(f"    预测变形: {pred_deformation:.2e}")

    print(f"\n{'=' * 60}")
    print("代理模型演示完成!")
    print(f"{'=' * 60}\n")


if __name__ == '__main__':
    try:
        optimization_demo()
        multi_objective_optimization_demo()
        surrogate_model_demo()
        print("\n所有优化演示完成!")
        print("查看 demo_output/ 目录下的可视化结果")
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
