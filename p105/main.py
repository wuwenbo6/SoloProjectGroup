#!/usr/bin/env python3
import argparse
import json
import os
import sys

from material_params import MaterialParamsManager
from drying_simulation import DryingSimulation
from visualization import DryingVisualizer
from optimization import DryingOptimizer, ParameterSensitivityAnalysis


def run_basic_simulation(config_path=None, show_plots=False):
    print("=" * 60)
    print("漆器干燥过程数值模拟系统")
    print("=" * 60)

    sim = DryingSimulation(config_path)

    print("\n当前配置参数:")
    for key, value in sim.config.items():
        print(f"  {key}: {value}")

    material = sim.material_manager.get_material(sim.config['material'])
    print(f"\n漆料参数 - {material.name}:")
    print(f"  密度: {material.density} kg/m³")
    print(f"  厚度: {material.thickness * 1000:.2f} mm")
    print(f"  初始含水率: {material.initial_moisture_content * 100:.1f}%")

    print("\n开始仿真计算...")
    if sim.run_simulation():
        print("仿真完成!")

        results = sim.get_results()
        print(f"\n仿真结果摘要:")
        print(f"  有效扩散系数: {results['effective_diffusivity']:.2e} m²/s")
        print(f"  最终平均含水率: {results['moisture_history'][-1].mean() * 100:.2f}%")

        target_moisture = sim.config.get('target_moisture', 0.08)
        drying_time = sim.estimate_drying_time(target_moisture)
        if drying_time > 0:
            print(f"  达到目标含水率({target_moisture * 100:.1f}%)时间: {drying_time / 3600:.1f} 小时")

        print("\n保存结果到HDF5文件...")
        hdf5_path = sim.save_results_to_hdf5()
        print(f"  已保存: {hdf5_path}")

        print("\n生成可视化图表...")
        visualizer = DryingVisualizer(sim.config['output_dir'])
        plot_files = visualizer.generate_all_plots(results, prefix='sim_')
        print(f"  已生成 {len(plot_files)} 个图表文件:")
        for name, path in plot_files.items():
            print(f"    - {name}: {path}")

        return sim
    else:
        print("仿真失败!")
        return None


def run_optimization(config_path=None):
    print("=" * 60)
    print("干燥参数优化")
    print("=" * 60)

    sim = DryingSimulation(config_path)
    target_moisture = sim.config.get('target_moisture', 0.08)

    print(f"\n优化目标: 达到含水率 {target_moisture * 100:.1f}%")
    print("优化参数: 温度、相对湿度")
    print("优化目标函数: 最小化(干燥时间 + 能耗 + 质量偏差)")

    print("\n开始参数优化...")
    optimizer = DryingOptimizer(sim)

    result = optimizer.optimize(
        target_moisture=target_moisture,
        temp_range=(15, 45),
        humidity_range=(30, 80)
    )

    print("\n优化结果:")
    print(f"  最优温度: {result['optimal_temperature']:.1f} °C")
    print(f"  最优湿度: {result['optimal_humidity']:.1f} %")
    print(f"  干燥时间: {result['drying_time'] / 3600:.1f} 小时")
    print(f"  最终含水率: {result['final_moisture'] * 100:.2f} %")
    print(f"  迭代次数: {result['iterations']}")
    print(f"  优化成功: {result['success']}")

    print("\n生成优化结果可视化...")
    visualizer = DryingVisualizer(sim.config['output_dir'])
    results = sim.get_results()
    plot_files = visualizer.generate_all_plots(results, prefix='opt_')
    print(f"  已生成优化结果图表")

    return result


def run_sensitivity_analysis(config_path=None):
    print("=" * 60)
    print("参数敏感性分析")
    print("=" * 60)

    sim = DryingSimulation(config_path)
    analysis = ParameterSensitivityAnalysis(sim)

    print("\n分析温度敏感性...")
    temp_values = [20, 25, 30, 35, 40]
    temp_result = analysis.analyze_temperature_sensitivity(temp_values, humidity=60.0)

    print("\n分析湿度敏感性...")
    humidity_values = [40, 50, 60, 70, 80]
    humidity_result = analysis.analyze_humidity_sensitivity(humidity_values, temperature=25.0)

    print("\n" + analysis.generate_sensitivity_report())

    print("\n不同漆料对比:")
    materials = ['raw_lacquer', 'cinnabar_lacquer', 'black_lacquer']
    comparison = analysis.compare_materials(materials, temperature=25.0, humidity=60.0)
    for mat, data in comparison.items():
        print(f"  {mat}:")
        print(f"    干燥时间: {data['drying_time_hours']:.1f} h")
        print(f"    最终含水率: {data['final_moisture'] * 100:.2f} %")
        print(f"    有效扩散系数: {data['effective_diffusivity']:.2e} m²/s")

    return analysis


def list_materials():
    print("=" * 60)
    print("可用漆料类型")
    print("=" * 60)

    manager = MaterialParamsManager()
    materials = manager.get_available_materials()

    print(f"\n共 {len(materials)} 种漆料:\n")
    for name in materials:
        material = manager.get_material(name)
        print(f"{name}:")
        print(f"  密度: {material.density} kg/m³")
        print(f"  比热容: {material.specific_heat} J/(kg·K)")
        print(f"  热导率: {material.thermal_conductivity} W/(m·K)")
        print(f"  初始含水率: {material.initial_moisture_content * 100:.1f}%")
        print(f"  平衡含水率: {material.equilibrium_moisture * 100:.1f}%")
        print()


def main():
    parser = argparse.ArgumentParser(
        description='漆器干燥过程数值模拟系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python main.py simulate              # 运行基础仿真
  python main.py optimize              # 运行参数优化
  python main.py sensitivity           # 运行参数敏感性分析
  python main.py materials             # 列出所有漆料类型
  python main.py -c config.json        # 指定配置文件
        """
    )

    parser.add_argument('mode', nargs='?', default='simulate',
                       choices=['simulate', 'optimize', 'sensitivity', 'materials'],
                       help='运行模式')
    parser.add_argument('-c', '--config', type=str,
                       help='配置文件路径')
    parser.add_argument('--show', action='store_true',
                       help='显示图表(需要GUI环境)')

    args = parser.parse_args()

    config_path = args.config or os.path.join('config', 'default_config.json')
    if not os.path.exists(config_path):
        print(f"警告: 配置文件 {config_path} 不存在，使用默认配置")
        config_path = None

    if args.mode == 'simulate':
        run_basic_simulation(config_path, args.show)
    elif args.mode == 'optimize':
        run_optimization(config_path)
    elif args.mode == 'sensitivity':
        run_sensitivity_analysis(config_path)
    elif args.mode == 'materials':
        list_materials()

    print("\n" + "=" * 60)
    print("程序执行完成!")
    print("=" * 60)


if __name__ == '__main__':
    main()
