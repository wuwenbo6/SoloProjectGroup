#!/usr/bin/env python3
"""漆器干燥模拟系统高级功能演示
演示新增功能：
1. 多漆料协同干燥模拟
2. 干燥过程异常预警
3. 仿真与实际测试数据对比分析
4. 优化数值计算速度
"""

import numpy as np
import time
import os

from numerical_solver import DryingSolver
from multi_layer_drying import MultiLayerDryingSimulator
from drying_monitor import DryingMonitor, DryingThresholds, AlertLevel
from validation_analysis import ValidationAnalyzer


def demo_1_optimized_speed():
    print("\n" + "="*60)
    print("演示1: 优化数值计算速度")
    print("="*60)

    solver = DryingSolver(nx=50)

    nx_values = [20, 50, 100]
    time_steps_list = [100, 500, 1000]

    print("\n不同网格和时间步长下的计算性能:")
    print("-"*60)

    for nx in nx_values:
        for n_steps in time_steps_list:
            solver.nx = nx
            dx = 0.001 / (nx - 1)
            solver.dx = dx

            start_time = time.time()

            initial_moisture = np.ones(nx) * 0.35
            initial_temp = np.ones(nx) * 25.0

            solver.solve_coupled_drying(
                initial_moisture,
                initial_temp,
                {
                    'density': 950.0,
                    'specific_heat': 2000.0,
                    'thermal_conductivity': 0.15,
                    'pre_exponential_factor': 0.001,
                    'activation_energy': 35000.0,
                    'equilibrium_moisture': 0.05
                },
                ambient_temp=25.0,
                humidity=60.0,
                dt=60.0,
                num_steps=n_steps
            )

            elapsed = time.time() - start_time
            print(f"nx={nx:3d}, 步数={n_steps:4d}, 耗时={elapsed:.4f}s")

    print("\n批量计算演示:")
    print("-"*60)

    params_list = []
    for temp in [20, 25, 30, 35, 40]:
        for hum in [50, 60, 70]:
            params_list.append({
                'material_params': {
                    'density': 950.0,
                    'specific_heat': 2000.0,
                    'thermal_conductivity': 0.15,
                    'pre_exponential_factor': 0.001,
                    'activation_energy': 35000.0,
                    'equilibrium_moisture': 0.05
                },
                'ambient_temp': temp,
                'humidity': hum,
                'dt': 60.0,
                'num_steps': 200,
                'save_interval': 10
            })

    solver.nx = 50
    solver.dx = 0.001 / 49

    batch_start = time.time()
    results = solver.batch_solve_drying(params_list)
    batch_elapsed = time.time() - batch_start

    print(f"批量计算完成:")
    print(f"  计算参数组合: {len(params_list)}")
    print(f"  总耗时: {batch_elapsed:.4f}s")
    print(f"  平均每组合: {batch_elapsed/len(params_list):.4f}s")

    print("\n速度优化说明:")
    print("  ✓ 使用Thomas算法替代通用稀疏矩阵求解器")
    print("  ✓ 支持save_interval参数减少内存和计算量")
    print("  ✓ 批量计算接口支持大规模参数扫描")

    return True


def demo_2_multi_layer_drying():
    print("\n" + "="*60)
    print("演示2: 多漆料协同干燥模拟")
    print("="*60)

    simulator = MultiLayerDryingSimulator(nx_per_layer=30)

    print("\n添加多层漆料:")
    simulator.add_layer("raw_lacquer", 0.001)
    simulator.add_layer("cinnabar_lacquer", 0.0008)
    simulator.add_layer("black_lacquer", 0.0006)

    for i, layer in enumerate(simulator.layers):
        print(f"  层{i}: {layer.material.name}, 厚度={layer.thickness*1000:.2f}mm")

    print(f"\n总厚度: {sum(l.thickness for l in simulator.layers)*1000:.2f}mm")

    print("\n运行多层干燥模拟...")
    results = simulator.run_simulation(
        ambient_temp=25.0,
        humidity=60.0,
        simulation_time=72*3600,
        dt=300.0,
        initial_temp=20.0,
        save_interval=5
    )

    print(f"模拟完成:")
    print(f"  时间步数: {len(results['time'])}")
    print(f"  总网格点数: {len(results['x_global'])}")
    print(f"  层数: {len(results['layer_info'])}")

    print("\n各层信息:")
    for layer_info in results['layer_info']:
        print(f"  层{layer_info['layer_id']}: "
              f"{layer_info['material']}, "
              f"厚度: {layer_info['thickness']*1000:.2f}mm")

    drying_times = simulator.get_drying_time_by_layer(target_moisture=0.08)
    print("\n各层达到8%含水率所需时间:")
    for layer_id, dt in drying_times.items():
        if dt > 0:
            print(f"  层{layer_id}: {dt/3600:.1f}小时")
        else:
            print(f"  层{layer_id}: 模拟时间内未达到目标")

    gradients = simulator.get_layer_interface_gradient(step=-1)
    print("\n层间梯度分析:")
    for grad in gradients:
        print(f"  层{grad['between_layers'][0]}<->层{grad['between_layers'][1]}:")
        print(f"    含水率梯度: {grad['moisture_gradient']:.6f}")
        print(f"    温度梯度: {grad['temperature_gradient']:.4f}°C")

    return simulator


def demo_3_drying_monitor():
    print("\n" + "="*60)
    print("演示3: 干燥过程异常预警")
    print("="*60)

    thresholds = DryingThresholds()
    thresholds.temp_max = 40.0
    thresholds.temp_min = 15.0
    thresholds.max_moisture_gradient = 0.03

    monitor = DryingMonitor(thresholds)

    print("\n正常干燥过程监控 (正常情况)...")

    nx = 50
    x_coords = np.linspace(0, 0.001, nx)

    time_points = [0, 3600, 7200, 10800, 14400]
    moisture_profiles = []
    temp_profiles = []

    for i, t in enumerate(time_points):
        moisture = 0.05 + (0.35 - 0.05) * np.exp(-t / (20 * 3600)) + np.linspace(-0.02, 0.02, nx)
        temp = np.ones(nx) * 25.0 + 2.0 * np.sin(t / 3600)

        moisture_profiles.append(moisture)
        temp_profiles.append(temp)

        prev_moisture = moisture_profiles[i-1] if i > 0 else None
        dt = time_points[i] - time_points[i-1] if i > 0 else None

        monitor.monitor_single_layer(
            t, moisture, temp, x_coords, prev_moisture, dt
        )

        monitor.monitor_environment(t, humidity=50.0, ambient_temp=25.0)

    report = monitor.generate_report()

    print("\n监控报告:")
    print("-"*60)
    print(f"  总预警数: {report['summary']['total_alerts']}")
    print(f"  严重警告: {report['summary']['critical_count']}")
    print(f"  警告: {report['summary']['warning_count']}")

    if report['alerts_by_type']:
        print("\n预警类型统计:")
        for alert_type, count in report['alerts_by_type'].items():
            print(f"  {alert_type}: {count}")

    print("\n建议措施:")
    for rec in report['recommendations']:
        print(f"  {rec}")

    print("\n模拟异常情况 (高温快速干燥)...")
    monitor2 = DryingMonitor()
    monitor2.reset()

    for i, t in enumerate(time_points):
        moisture = 0.05 + (0.35 - 0.05) * np.exp(-t / (5 * 3600))
        moisture += np.linspace(-0.08, 0.08, nx)
        temp = np.ones(nx) * 45.0

        prev_moisture = moisture_profiles[i-1] if i > 0 else None
        dt = time_points[i] - time_points[i-1] if i > 0 else None

        monitor2.monitor_single_layer(
            t, moisture, temp, x_coords, prev_moisture, dt
        )

        monitor2.monitor_environment(t, humidity=25.0, ambient_temp=45.0)

    report2 = monitor2.generate_report()

    print("\n异常干燥过程监控结果:")
    print(f"  总预警数: {report2['summary']['total_alerts']}")
    print(f"  严重警告: {report2['summary']['critical_count']}")
    print(f"  警告: {report2['summary']['warning_count']}")

    critical_alerts = [a for a in monitor2.alerts if a.alert_level == AlertLevel.CRITICAL]
    for alert in critical_alerts[:3]:
        print(f"  [{alert.alert_type.value}] {alert.message}")

    os.makedirs('results', exist_ok=True)
    monitor2.save_report('results/monitor_report.json')

    return monitor


def demo_4_validation_analysis():
    print("\n" + "="*60)
    print("演示4: 仿真与实际测试数据对比分析")
    print("="*60)

    analyzer = ValidationAnalyzer()

    print("\n创建示例测试数据...")
    test_data = analyzer.create_sample_test_data("laboratory_test_001")
    print(f"  测试ID: {test_data.test_id}")
    print(f"  材料: {test_data.material}")
    print(f"  数据点数: {len(test_data.time_points)}")
    print(f"  温度: {test_data.ambient_temp}°C, 湿度: {test_data.humidity}%")

    analyzer.save_test_data(test_data, 'results/sample_test_data.json')

    print("\n运行仿真计算...")
    solver = DryingSolver(nx=50)
    solver.set_geometry(0.001)

    initial_moisture = np.ones(50) * 0.35
    initial_temp = np.ones(50) * 25.0

    sim_time, moisture_history, temp_history = solver.solve_coupled_drying(
        initial_moisture,
        initial_temp,
        {
            'density': 950.0,
            'specific_heat': 2000.0,
            'thermal_conductivity': 0.15,
            'pre_exponential_factor': 0.0015,
            'activation_energy': 35000.0,
            'equilibrium_moisture': 0.05
        },
        ambient_temp=test_data.ambient_temp,
        humidity=test_data.humidity,
        dt=600.0,
        num_steps=500
    )

    avg_moisture = np.mean(moisture_history, axis=1)

    analyzer.register_simulation_result(
        "simulation_001",
        sim_time,
        avg_moisture,
        np.mean(temp_history, axis=1)
    )

    print("\n执行仿真与测试数据对比...")
    comparison = analyzer.compare_simulation_test(
        "laboratory_test_001",
        "simulation_001",
        moisture_tolerance=0.02
    )

    print("\n对比指标:")
    metrics = comparison['comparison_metrics']
    print(f"  平均绝对误差 (MAE): {metrics['mae_percent']:.2f}%")
    print(f"  均方根误差 (RMSE): {metrics['rmse_percent']:.2f}%")
    print(f"  最大绝对误差: {metrics['max_absolute_error_percent']:.2f}%")
    print(f"  平均相对误差: {metrics['mean_relative_error']*100:.2f}%")
    print(f"  拟合优度 (R²): {metrics['r_squared']:.4f}")
    print(f"  合格率: {metrics['pass_rate_percent']:.1f}%")

    print(f"\n验证等级: {comparison['validation_level']}")

    print("\n干燥时间对比:")
    dt = comparison['drying_time_comparison']
    if dt['test_drying_time'] > 0:
        print(f"  实验干燥时间: {dt['test_drying_time_hours']:.1f}小时")
        print(f"  仿真干燥时间: {dt['sim_drying_time_hours']:.1f}小时")
        if dt['drying_time_error_percent'] is not None:
            print(f"  相对误差: {dt['drying_time_error_percent']:.1f}%")

    print("\n改进建议:")
    for rec in comparison['recommendations']:
        print(f"  {rec}")

    print("\n参数校正建议:")
    calibration = analyzer.generate_calibration_suggestions(
        "laboratory_test_001",
        "simulation_001"
    )
    for key, value in calibration.items():
        if value and key != 'calibration_priority':
            print(f"  {key}: {value}")
    if calibration['calibration_priority']:
        print("  校正优先级:")
        for param, priority in calibration['calibration_priority']:
            print(f"    - {param}: {priority}")

    analyzer.save_comparison_report(
        "laboratory_test_001_vs_simulation_001",
        "results/validation_report.json"
    )

    return analyzer


def main():
    print("\n" + "="*60)
    print("漆器干燥过程数值模拟系统 - 高级功能演示")
    print("="*60)
    print("\n本演示将展示以下新增功能:")
    print("  1. ✓ 优化数值计算速度")
    print("  2. ✓ 多漆料协同干燥模拟")
    print("  3. ✓ 干燥过程异常预警")
    print("  4. ✓ 仿真与实际测试数据对比分析")

    demo_1_optimized_speed()
    demo_2_multi_layer_drying()
    demo_3_drying_monitor()
    demo_4_validation_analysis()

    print("\n" + "="*60)
    print("所有演示完成!")
    print("="*60)
    print("\n生成的结果文件:")
    print("  results/monitor_report.json       - 监控报告")
    print("  results/sample_test_data.json   - 测试数据")
    print("  results/validation_report.json   - 验证分析报告")


if __name__ == "__main__":
    main()
