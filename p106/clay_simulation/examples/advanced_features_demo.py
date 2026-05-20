#!/usr/bin/env python3
"""
传统泥塑工艺 - 高级功能演示
多泥料协同模拟、异常预警、实测对比、性能优化
"""

import sys
import os
import json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_acquisition import ParameterCollector
from force_simulation import (
    MultiClaySimulator, ClayRegion, ContactCondition,
    AnomalyDetector, DetectionThresholds
)
from numerical_computation import SolverOptimizer, FastParameterSweep
from validation import TestDataComparator, generate_sample_test_data


def multi_clay_simulation_demo():
    """多泥料协同受力模拟演示"""
    print("\n" + "=" * 70)
    print("1. 多泥料协同受力模拟演示")
    print("=" * 70)

    collector = ParameterCollector()
    multi_sim = MultiClaySimulator(collector)

    region1 = ClayRegion(
        clay_type='kaolin',
        x_range=(0.0, 0.5),
        y_range=(0.0, 1.0),
        thickness=1.0
    )

    region2 = ClayRegion(
        clay_type='bentonite',
        x_range=(0.5, 1.0),
        y_range=(0.0, 1.0),
        thickness=1.0
    )

    multi_sim.add_clay_region(region1)
    multi_sim.add_clay_region(region2)

    contact = ContactCondition(
        region1='region_1',
        region2='region_2',
        contact_type='bonded',
        friction_coefficient=0.3,
        bond_strength=50000.0
    )
    multi_sim.add_contact_condition(contact)

    print("  网格大小: 20x20")
    print("  泥料区域: 2个 (高岭土, 膨润土)")
    print("  施力点: (0.5, 1.0) - 顶部中央")
    print("  力大小: 1500 N")

    result = multi_sim.run_multi_clay_simulation(
        force_magnitude=1500.0,
        force_direction=(0, -1),
        force_position=(0.5, 1.0),
        grid_size=(20, 20)
    )

    max_stress = np.max(result.von_mises_stress)
    max_disp = np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2))

    print(f"\n  模拟结果:")
    print(f"    最大应力: {max_stress:.2e} Pa")
    print(f"    最大位移: {max_disp:.2e} m")

    stats = multi_sim.get_region_statistics(result)
    print(f"\n  各区域统计:")
    for region_id, data in stats.items():
        print(f"    {region_id}:")
        print(f"      最大应力: {data['max_stress']:.2e} Pa")
        print(f"      最大位移: {data['max_displacement']:.2e} m")

    print("  ✓ 多泥料模拟完成!")
    return result


def anomaly_detection_demo():
    """受力过程异常预警演示"""
    print("\n" + "=" * 70)
    print("2. 受力过程异常预警演示")
    print("=" * 70)

    detector = AnomalyDetector(
        thresholds=DetectionThresholds(
            max_stress=60000.0,
            max_deformation=0.01,
            min_safety_factor=1.2
        )
    )

    print("  阈值设置:")
    print(f"    最大应力: {60000.0} Pa")
    print(f"    最大变形: {0.01} m")
    print(f"    最小安全系数: {1.2}")

    collector = ParameterCollector()
    clay = collector.get_clay_parameter('kaolin')

    nx, ny = 15, 15
    x = np.linspace(0, 1, nx)
    y = np.linspace(0, 1, ny)
    X, Y = np.meshgrid(x, y)

    stress_field = 50000 * (1 - Y) + 30000 * np.exp(-((X - 0.5) ** 2 + (Y - 0.8) ** 2) / 0.01)
    u = 0.005 * (1 - Y) * X
    v = 0.01 * (1 - Y) * (1 - X)
    displacement = np.array([u, v])

    print(f"\n  生成模拟应力场...")
    print(f"  应力范围: {np.min(stress_field):.2e} - {np.max(stress_field):.2e} Pa")

    anomalies = detector.detect_static_anomalies(
        stress=stress_field,
        displacement=displacement,
        yield_strength=clay.yield_strength
    )

    print(f"\n  检测到 {len(anomalies)} 个异常:")
    for anomaly in anomalies:
        loc_str = f" (位置: {anomaly.location})" if anomaly.location else ""
        print(f"    [{anomaly.severity.name}] {anomaly.type.value}:")
        print(f"      {anomaly.message}")

    summary = detector.get_anomaly_summary()
    print(f"\n  异常统计:")
    print(f"    总异常数: {summary['total_anomalies']}")
    print(f"    有严重问题: {summary['has_critical_issues']}")
    print(f"    总体风险等级: {summary['overall_risk']}")

    report = detector.generate_warning_report()
    print("\n" + report[:500] + "...")

    print("  ✓ 异常检测完成!")
    return detector


def performance_optimization_demo():
    """性能优化演示"""
    print("\n" + "=" * 70)
    print("3. 数值计算性能优化演示")
    print("=" * 70)

    solver = SolverOptimizer(use_sparse=True)

    grid_sizes = [(10, 10), (20, 20)]
    E = 5.0e6
    nu = 0.35
    force_magnitude = 1000.0
    force_direction = (0, -1)

    print(f"  杨氏模量: {E:.2e} Pa")
    print(f"  泊松比: {nu:.2f}")
    print(f"  力大小: {force_magnitude} N")

    results = {}
    for nx, ny in grid_sizes:
        print(f"\n  求解网格 {nx}x{ny} ({nx * ny} 节点)...")
        displacement, metrics = solver.solve_elasticity_optimized(
            nx, ny, E, nu, force_magnitude, force_direction, method='auto'
        )

        max_disp = np.max(np.sqrt(displacement[0] ** 2 + displacement[1] ** 2))
        results[(nx, ny)] = {
            'max_displacement': max_disp,
            'metrics': metrics
        }

        print(f"    使用方法: {metrics.method_used}")
        print(f"    组装时间: {metrics.setup_time:.4f} 秒")
        print(f"    求解时间: {metrics.solve_time:.4f} 秒")
        print(f"    总时间: {metrics.total_time:.4f} 秒")
        print(f"    内存使用: {metrics.memory_usage_mb:.2f} MB")
        print(f"    最大位移: {max_disp:.2e} m")

    print(f"\n  快速参数扫描演示:")
    sweep = FastParameterSweep()
    print(f"    含水量范围: 0.18 - 0.32")
    print(f"    扫描点数: 10")

    sweep_results = sweep.sweep_moisture_content(
        moisture_range=(0.18, 0.32),
        n_points=10,
        base_E=5.0e6,
        base_nu=0.35,
        nx=15,
        ny=15,
        force_magnitude=1000.0
    )

    print(f"    最大应力变化: {np.min(sweep_results['max_stresses']):.2e} - {np.max(sweep_results['max_stresses']):.2e} Pa")

    performance_report = solver.get_performance_report()
    print("\n" + performance_report)

    print("  ✓ 性能优化演示完成!")
    return solver


def test_comparison_demo():
    """仿真与实测对比演示"""
    print("\n" + "=" * 70)
    print("4. 仿真与实测对比分析演示")
    print("=" * 70)

    comparator = TestDataComparator(tolerance_threshold=0.15)

    test_data_file = "demo_test_data.json"
    generate_sample_test_data(test_data_file)
    print(f"  生成示例测试数据: {test_data_file}")

    comparator.load_test_data_from_json(test_data_file)
    print(f"  加载 {len(comparator.test_measurements)} 个测试数据集")

    for test in comparator.test_measurements:
        print(f"    - {test.test_id}: {test.measurement_type} ({len(test.values)} 个测点)")

    nx, ny = 20, 20
    x_coords = np.linspace(0, 1, nx)
    y_coords = np.linspace(0, 1, ny)
    X, Y = np.meshgrid(x_coords, y_coords)

    stress_field = 25000 + 10000 * (1 - Y) + 5000 * np.exp(-((X - 0.5) ** 2 + (Y - 0.7) ** 2) / 0.02)
    disp_field = 0.001 + 0.002 * (1 - Y)

    simulation_results = {
        'stress': stress_field,
        'displacement': disp_field
    }

    print(f"\n  执行对比分析...")
    compare_results = comparator.batch_compare(simulation_results)

    print(f"\n  对比结果:")
    for test_id, result in compare_results.items():
        status = "✓ 通过" if result.passed_threshold else "✗ 未通过"
        print(f"    {test_id}: {status}")
        print(f"      RMSE: {result.rmse:.4e}")
        print(f"      相对误差: {result.relative_error:.1%}")
        print(f"      R²: {result.r_squared:.3f}")
        print(f"      相关系数: {result.correlation:.3f}")
        print(f"      偏差: {result.bias:.4e}")

    summary = comparator.get_validation_summary()
    print(f"\n  总体验证结果:")
    print(f"    通过率: {summary.get('overall_pass_rate', 0):.1%}")
    print(f"    总比较数: {summary.get('total_comparisons', 0)}")

    validation_report = comparator.generate_validation_report()
    print("\n" + validation_report[:800] + "...")

    results_file = "validation_results.json"
    comparator.export_validation_results(results_file)
    print(f"\n  验证结果已导出到: {results_file}")

    print("  ✓ 仿真对比完成!")
    return comparator


def main():
    """主函数 - 运行所有演示"""
    print("\n" + "=" * 70)
    print("   传统泥塑工艺受力数值模拟 - 高级功能演示")
    print("=" * 70)

    try:
        multi_clay_simulation_demo()
        anomaly_detection_demo()
        performance_optimization_demo()
        test_comparison_demo()

        print("\n" + "=" * 70)
        print("   所有演示功能已成功运行!")
        print("=" * 70)
        print("\n  主要功能总结:")
        print("  1. ✓ 多泥料协同受力模拟 (支持多区域、接触条件)")
        print("  2. ✓ 受力过程异常预警 (应力、变形、安全系数检测)")
        print("  3. ✓ 数值计算性能优化 (稀疏矩阵、自动方法选择)")
        print("  4. ✓ 仿真与实测对比分析 (RMSE、R²、相关性分析)")
        print("\n  生成的文件:")
        print("  - demo_test_data.json: 示例测试数据")
        print("  - validation_results.json: 验证结果报告")
        print("\n" + "=" * 70)

    except Exception as e:
        print(f"\n  错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
