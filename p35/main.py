#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古法酿造发酵过程数值仿真系统 - 主程序入口
"""

import json
import os
import sys
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    FermentationSimulator,
    FermentationVisualizer,
    FermentationOptimizer,
    HistoryBasedOptimizer,
    DataManager,
    SensorDataCollector
)


def run_rice_wine_simulation(config_path: str = "configs/rice_wine_default.json"):
    """运行黄酒发酵仿真"""
    print("=" * 60)
    print("开始古法黄酒发酵过程仿真...")
    print("=" * 60)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    simulator = FermentationSimulator(config_dict=config)
    results = simulator.run_simulation()

    print("\n发酵过程仿真完成!")
    print(f"仿真ID: {results['simulation_id']}")
    print(f"发酵类型: {results['config']['type']}")
    print(f"总时长: {results['time'][-1]:.1f} 小时")

    quality_score = simulator.calculate_quality_score()
    print(f"最终质量评分: {quality_score:.4f}")

    summary = simulator.get_summary_statistics()
    print("\n关键状态变量最终值:")
    for name, value in summary["final_states"].items():
        print(f"  {name}: {value:.4f}")

    return simulator, results, summary


def run_soy_sauce_simulation(config_path: str = "configs/soy_sauce_default.json"):
    """运行酱油发酵仿真"""
    print("=" * 60)
    print("开始古法酱油发酵过程仿真...")
    print("=" * 60)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    simulator = FermentationSimulator(config_dict=config)
    results = simulator.run_simulation()

    print("\n发酵过程仿真完成!")
    print(f"仿真ID: {results['simulation_id']}")
    print(f"发酵类型: {results['config']['type']}")
    print(f"总时长: {results['time'][-1]:.1f} 小时")

    quality_score = simulator.calculate_quality_score()
    print(f"最终质量评分: {quality_score:.4f}")

    summary = simulator.get_summary_statistics()
    print("\n关键状态变量最终值:")
    for name, value in summary["final_states"].items():
        print(f"  {name}: {value:.4f}")

    return simulator, results, summary


def visualize_results(results, output_dir: str = "output"):
    """可视化仿真结果"""
    print("\n" + "=" * 60)
    print("生成可视化图表...")
    print("=" * 60)

    os.makedirs(output_dir, exist_ok=True)

    visualizer = FermentationVisualizer(results)

    visualizer.plot_microbes_growth(
        save_path=os.path.join(output_dir, "microbes_growth.png")
    )
    print("  ✓ 微生物生长曲线图表已保存")

    visualizer.plot_substrate_conversion(
        save_path=os.path.join(output_dir, "substrate_conversion.png")
    )
    print("  ✓ 底物消耗与产物生成图表已保存")

    visualizer.plot_ph_temperature(
        save_path=os.path.join(output_dir, "ph_temperature.png")
    )
    print("  ✓ pH与温度变化图表已保存")

    visualizer.plot_combined_dashboard(
        save_path=os.path.join(output_dir, "combined_dashboard.png")
    )
    print("  ✓ 综合监控仪表盘图表已保存")


def run_parameter_optimization(config_path: str, output_dir: str = "output"):
    """运行参数优化"""
    print("\n" + "=" * 60)
    print("开始发酵参数优化...")
    print("=" * 60)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    optimizer = FermentationOptimizer(config)
    opt_results = optimizer.optimize_local()

    print("\n参数优化结果:")
    print(f"  最优温度: {opt_results['best_parameters']['temperature']:.2f} ℃")
    print(f"  最优发酵时间: {opt_results['best_parameters']['fermentation_time']:.2f} 小时")
    print(f"  最优质量评分: {opt_results['best_quality_score']:.4f}")
    print(f"  迭代次数: {opt_results['iterations']}")
    print(f"  优化成功: {opt_results['success']}")

    visualizer = FermentationVisualizer()
    visualizer.plot_optimization_results(
        optimizer.get_optimization_history(),
        save_path=os.path.join(output_dir, "optimization_results.png")
    )
    print("  ✓ 优化结果图表已保存")

    return opt_results


def save_simulation_data(config, results, summary, data_dir: str = "data"):
    """保存仿真数据"""
    print("\n" + "=" * 60)
    print("保存仿真数据...")
    print("=" * 60)

    data_manager = DataManager(data_dir)
    paths = data_manager.save_full_simulation(config, results, summary)

    print(f"  配置文件: {paths['config_path']}")
    print(f"  仿真结果: {paths['results_path']}")
    print(f"  摘要数据: {paths['summary_path']}")


def simulate_sensor_data():
    """模拟传感器数据采集"""
    print("\n" + "=" * 60)
    print("模拟发酵过程传感器数据采集...")
    print("=" * 60)

    collector = SensorDataCollector(sampling_interval=0.5)
    sensor_data = collector.simulate_sensor_data(duration_hours=168, noise_level=0.3)

    print(f"采集数据点数: {len(sensor_data['timestamp'])}")
    print(f"温度范围: {min(sensor_data['temperature']):.2f} - {max(sensor_data['temperature']):.2f} ℃")
    print(f"pH范围: {min(sensor_data['ph']):.2f} - {max(sensor_data['ph']):.2f}")

    visualizer = FermentationVisualizer()
    os.makedirs("output", exist_ok=True)
    visualizer.plot_sensor_data(
        sensor_data,
        save_path="output/sensor_data.png"
    )
    print("  ✓ 传感器数据图表已保存")

    return sensor_data


def batch_comparison():
    """多批次仿真对比"""
    print("\n" + "=" * 60)
    print("多批次发酵参数对比仿真...")
    print("=" * 60)

    with open("configs/rice_wine_default.json", 'r', encoding='utf-8') as f:
        base_config = json.load(f)

    temperatures = [25, 30, 35]
    results_list = []
    labels = []

    for temp in temperatures:
        config = base_config.copy()
        config["fermentation"]["target_temperature"] = temp

        simulator = FermentationSimulator(config_dict=config)
        results = simulator.run_simulation()
        results_list.append(results)
        labels.append(f"温度={temp}℃")

        quality = simulator.calculate_quality_score()
        print(f"  温度={temp}℃: 质量评分={quality:.4f}")

    visualizer = FermentationVisualizer()
    os.makedirs("output", exist_ok=True)
    visualizer.plot_comparison(
        results_list,
        labels,
        save_path="output/batch_comparison.png"
    )
    print("  ✓ 批次对比图表已保存")


def main():
    parser = argparse.ArgumentParser(
        description="古法酿造发酵过程数值仿真系统",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--mode",
        type=str,
        default="demo",
        choices=["demo", "rice_wine", "soy_sauce", "optimize", "sensor", "batch", "full"],
        help="运行模式"
    )

    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="配置文件路径"
    )

    parser.add_argument(
        "--output",
        type=str,
        default="output",
        help="输出目录"
    )

    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("古法酿造发酵过程数值仿真系统 v1.0")
    print("=" * 60)
    print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"运行模式: {args.mode}")

    os.makedirs(args.output, exist_ok=True)

    if args.mode == "demo" or args.mode == "rice_wine":
        config_path = args.config if args.config else "configs/rice_wine_default.json"
        simulator, results, summary = run_rice_wine_simulation(config_path)
        visualize_results(results, args.output)
        save_simulation_data(simulator.config, results, summary)

    elif args.mode == "soy_sauce":
        config_path = args.config if args.config else "configs/soy_sauce_default.json"
        simulator, results, summary = run_soy_sauce_simulation(config_path)
        visualize_results(results, args.output)
        save_simulation_data(simulator.config, results, summary)

    elif args.mode == "optimize":
        config_path = args.config if args.config else "configs/rice_wine_default.json"
        run_parameter_optimization(config_path, args.output)

    elif args.mode == "sensor":
        simulate_sensor_data()

    elif args.mode == "batch":
        batch_comparison()

    elif args.mode == "full":
        config_path = args.config if args.config else "configs/rice_wine_default.json"
        simulator, results, summary = run_rice_wine_simulation(config_path)
        visualize_results(results, args.output)
        save_simulation_data(simulator.config, results, summary)
        simulate_sensor_data()
        batch_comparison()

    print("\n" + "=" * 60)
    print("程序执行完成!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
