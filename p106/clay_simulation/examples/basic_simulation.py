#!/usr/bin/env python3
"""
传统泥塑工艺受力数值模拟 - 基础使用示例
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_acquisition import ParameterCollector, ClayParameter
from force_simulation import ForceSimulator, SimulationConfig
from visualization import ResultVisualizer
from data_storage import DataStorage


def basic_simulation_demo():
    """基础模拟演示"""
    print("=" * 60)
    print("传统泥塑工艺受力数值模拟 - 基础演示")
    print("=" * 60)

    collector = ParameterCollector()
    simulator = ForceSimulator(collector)
    visualizer = ResultVisualizer()
    storage = DataStorage()

    available_clays = collector.list_available_clays()
    print(f"\n可用泥料类型: {available_clays}")

    clay_type = 'kaolin'
    clay_param = collector.get_clay_parameter(clay_type)
    print(f"\n选中泥料: {clay_param.name}")
    print(f"  含水量: {clay_param.moisture_content:.2f}")
    print(f"  杨氏模量: {clay_param.youngs_modulus:.2e} Pa")
    print(f"  屈服强度: {clay_param.yield_strength:.2e} Pa")

    config = SimulationConfig(
        clay_type=clay_type,
        force_magnitude=1000.0,
        force_direction=(0, -1),
        grid_size=(30, 30),
        simulation_time=0.5,
        time_steps=50
    )

    print(f"\n开始模拟...")
    print(f"  力大小: {config.force_magnitude} N")
    print(f"  网格大小: {config.grid_size}")
    print(f"  模拟时间: {config.simulation_time} s")

    result = simulator.run_simulation(config)
    print("模拟完成!")

    stats = simulator.get_summary_statistics()
    print(f"\n统计结果:")
    print(f"  最大Von Mises应力: {stats['max_von_mises_stress']:.2e} Pa")
    print(f"  最小Von Mises应力: {stats['min_von_mises_stress']:.2e} Pa")
    print(f"  平均Von Mises应力: {stats['mean_von_mises_stress']:.2e} Pa")
    print(f"  最大位移: {stats['max_displacement']:.2e}")
    print(f"  安全系数: {stats['safety_factor']:.2f}")

    print(f"\n生成可视化结果...")
    output_dir = "demo_output"
    os.makedirs(output_dir, exist_ok=True)

    visualizer.plot_stress_distribution(
        result, config,
        show=False,
        save_path=os.path.join(output_dir, 'stress_distribution.png')
    )
    print("  应力分布图像已保存")

    visualizer.plot_displacement_field(
        result, config,
        show=False,
        save_path=os.path.join(output_dir, 'displacement_field.png')
    )
    print("  位移场图像已保存")

    visualizer.plot_stress_profile(
        result,
        axis='y',
        position=0.5,
        show=False,
        save_path=os.path.join(output_dir, 'stress_profile.png')
    )
    print("  应力剖面图已保存")

    print(f"\n保存数据...")
    h5_path = storage.save_simulation_results(result, config, clay_param)
    print(f"  HDF5数据已保存: {h5_path}")

    config_path = storage.save_configuration(config, clay_param)
    print(f"  配置文件已保存: {config_path}")

    print(f"\n{'=' * 60}")
    print("基础演示完成!")
    print(f"可视化结果保存在: {output_dir}/")
    print(f"数据文件保存在: {storage.base_dir}/")
    print(f"{'=' * 60}\n")


def moisture_effect_demo():
    """含水量影响分析演示"""
    print("\n" + "=" * 60)
    print("含水量影响分析演示")
    print("=" * 60)

    collector = ParameterCollector()
    simulator = ForceSimulator(collector)
    visualizer = ResultVisualizer()

    clay_type = 'kaolin'

    config = SimulationConfig(
        clay_type=clay_type,
        force_magnitude=1000.0,
        force_direction=(0, -1),
        grid_size=(20, 20),
        simulation_time=0,
        time_steps=0
    )

    print(f"\n分析含水量对结果的影响...")
    moisture_data = simulator.analyze_moisture_effect(
        config,
        moisture_range=(0.15, 0.40),
        n_points=15
    )

    output_dir = "demo_output"
    os.makedirs(output_dir, exist_ok=True)

    visualizer.plot_moisture_effect(
        moisture_data,
        show=False,
        save_path=os.path.join(output_dir, 'moisture_effect.png')
    )
    print("  含水量影响图像已保存")

    print(f"\n统计结果:")
    print(f"  含水量范围: {moisture_data['moistures'][0]:.2f} - {moisture_data['moistures'][-1]:.2f}")
    print(f"  杨氏模量变化: {moisture_data['youngs_modulus'][0]:.2e} - {moisture_data['youngs_modulus'][-1]:.2e} Pa")
    print(f"  屈服强度变化: {moisture_data['yield_strength'][0]:.2e} - {moisture_data['yield_strength'][-1]:.2e} Pa")
    print(f"  最大应力变化: {moisture_data['max_stress'][0]:.2e} - {moisture_data['max_stress'][-1]:.2e} Pa")

    print(f"\n{'=' * 60}")
    print("含水量分析演示完成!")
    print(f"{'=' * 60}\n")


def force_direction_demo():
    """力方向影响分析演示"""
    print("\n" + "=" * 60)
    print("力方向影响分析演示")
    print("=" * 60)

    collector = ParameterCollector()
    simulator = ForceSimulator(collector)
    visualizer = ResultVisualizer()

    config = SimulationConfig(
        clay_type='red_clay',
        force_magnitude=1500.0,
        force_direction=(0, -1),
        grid_size=(20, 20),
        simulation_time=0,
        time_steps=0
    )

    print(f"\n分析力方向对结果的影响...")
    direction_data = simulator.analyze_force_direction(
        config,
        angle_range=(0, 90),
        n_points=15
    )

    output_dir = "demo_output"
    os.makedirs(output_dir, exist_ok=True)

    visualizer.plot_force_direction_effect(
        direction_data,
        show=False,
        save_path=os.path.join(output_dir, 'force_direction_effect.png')
    )
    print("  力方向影响图像已保存")

    print(f"\n统计结果:")
    print(f"  角度范围: {direction_data['angles'][0]:.1f} - {direction_data['angles'][-1]:.1f} 度")
    print(f"  最大应力变化: {min(direction_data['max_stress']):.2e} - {max(direction_data['max_stress']):.2e} Pa")
    print(f"  最大变形变化: {min(direction_data['max_deformation']):.2e} - {max(direction_data['max_deformation']):.2e}")

    print(f"\n{'=' * 60}")
    print("力方向分析演示完成!")
    print(f"{'=' * 60}\n")


if __name__ == '__main__':
    try:
        basic_simulation_demo()
        moisture_effect_demo()
        force_direction_demo()
        print("\n所有演示完成!")
        print("查看 demo_output/ 目录下的可视化结果")
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
