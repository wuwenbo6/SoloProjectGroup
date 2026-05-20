#!/usr/bin/env python3
import os
import json
import numpy as np
from .material_collector import Material, MaterialCollector
from .numerical_calculator import NumericalCalculator
from .simulation import DyeSimulation
from .visualization import DyeVisualizer
from .color_predictor import ColorPredictor


def main():
    print("=" * 60)
    print("染料配比模拟系统 (Dye Mixing Simulation System)")
    print("=" * 60)
    
    material_collector = MaterialCollector()
    
    material_collector.add_material(Material(
        name="红色染料R",
        concentration=1.0,
        molar_mass=300.0,
        absorption_coefficient=0.8,
        color=[1.0, 0.1, 0.1]
    ))
    material_collector.add_material(Material(
        name="黄色染料Y",
        concentration=1.0,
        molar_mass=280.0,
        absorption_coefficient=0.6,
        color=[1.0, 0.9, 0.1]
    ))
    material_collector.add_material(Material(
        name="蓝色染料B",
        concentration=1.0,
        molar_mass=320.0,
        absorption_coefficient=0.9,
        color=[0.1, 0.3, 1.0]
    ))
    
    print(f"\n已添加 {len(material_collector.materials)} 种染料原料:")
    for name, mat in material_collector.materials.items():
        print(f"  - {name}: 浓度={mat.concentration}mol/L, RGB={mat.color}")
    
    errors = material_collector.validate_materials()
    if errors:
        print("\n参数验证错误:")
        for err in errors:
            print(f"  - {err}")
    else:
        print("\n参数验证通过!")
    
    calculator = NumericalCalculator()
    simulation = DyeSimulation(material_collector, calculator, config_file='config.json')
    visualizer = DyeVisualizer()
    color_predictor = ColorPredictor()
    
    print("\n" + "=" * 60)
    print("1. 单次配比模拟")
    print("=" * 60)
    
    ratios = {"红色染料R": 0.4, "黄色染料Y": 0.3, "蓝色染料B": 0.3}
    temperature = 60.0
    time_span = (0, 100)
    
    print(f"\n配比: {ratios}")
    print(f"反应温度: {temperature}°C")
    print(f"时间范围: {time_span}s")
    
    sim_result = simulation.run_single_simulation(ratios, temperature, time_span)
    
    print(f"\n模拟结果:")
    print(f"  - 最终反应产率: {sim_result['reaction_yield']:.2f}%")
    print(f"  - 初始总浓度: {np.sum(sim_result['initial_concentrations']):.4f} mol/L")
    print(f"  - 最终总浓度: {np.sum(sim_result['final_concentrations']):.4f} mol/L")
    
    hdf5_file = 'simulation_results.h5'
    simulation.save_to_hdf5(sim_result, hdf5_file, group_name='single_simulation')
    print(f"\n结果已保存到HDF5文件: {hdf5_file}")
    
    groups = simulation.list_hdf5_groups(hdf5_file)
    print(f"HDF5文件中的数据集: {groups}")
    
    print("\n" + "=" * 60)
    print("2. 温度扫描模拟")
    print("=" * 60)
    
    temp_range = (20, 100)
    num_temps = 20
    time_point = 50.0
    
    print(f"\n温度范围: {temp_range}°C")
    print(f"时间点: {time_point}s")
    
    temp_result = simulation.run_temperature_sweep(ratios, temp_range, num_temps, time_point)
    
    max_yield_idx = np.argmax(temp_result['reaction_yields'])
    print(f"\n最佳温度: {temp_result['temperatures'][max_yield_idx]:.1f}°C")
    print(f"最大产率: {temp_result['reaction_yields'][max_yield_idx]:.2f}%")
    
    print("\n" + "=" * 60)
    print("3. 颜色预测与分析")
    print("=" * 60)
    
    mixed_color = simulation.calculate_mixture_color(ratios)
    print(f"\n混合后预测颜色 (RGB): {mixed_color}")
    print(f"混合后预测颜色 (HEX): {color_predictor.rgb_to_hex(mixed_color)}")
    
    color_props = color_predictor.analyze_color_properties(mixed_color)
    print(f"\n颜色属性分析:")
    print(f"  - 亮度: {color_props['brightness']:.3f}")
    print(f"  - 饱和度: {color_props['saturation']:.3f}")
    print(f"  - 色温: {color_props['temperature']:.0f}K")
    print(f"  - 主色调: {color_props['dominant_channel']}")
    
    color_evo_result = simulation.simulate_color_evolution(ratios, temperature, time_span)
    print(f"\n颜色演化模拟完成")
    print(f"最终颜色 (RGB): {color_evo_result['final_color']}")
    
    print("\n" + "=" * 60)
    print("4. 配比优化 (目标颜色匹配)")
    print("=" * 60)
    
    target_color = np.array([0.7, 0.3, 0.5])
    print(f"\n目标颜色 (RGB): {target_color}")
    print(f"目标颜色 (HEX): {color_predictor.rgb_to_hex(target_color)}")
    
    base_colors = [m.color for m in material_collector.get_all_materials()]
    optimize_result = color_predictor.optimize_matching_ratio(
        target_color, base_colors, max_iterations=2000, learning_rate=0.05
    )
    
    material_names = [m.name for m in material_collector.get_all_materials()]
    optimized_ratios = dict(zip(material_names, optimize_result['ratios']))
    
    print(f"\n优化后的配比:")
    for name, ratio in optimized_ratios.items():
        print(f"  - {name}: {ratio*100:.2f}%")
    print(f"预测颜色: {optimize_result['predicted_color']}")
    print(f"匹配误差: {optimize_result['error']:.6f}")
    
    color_diff = color_predictor.color_difference(target_color, optimize_result['predicted_color'], 'euclidean')
    print(f"颜色差异 (欧氏距离): {color_diff:.4f}")
    
    print("\n" + "=" * 60)
    print("5. 生成可视化报告")
    print("=" * 60)
    
    output_dir = 'simulation_output'
    os.makedirs(output_dir, exist_ok=True)
    
    visualizer.plot_concentration_curve(
        sim_result['time_points'],
        sim_result['concentration_history'],
        sim_result['material_names'],
        title="浓度变化曲线",
        save_path=os.path.join(output_dir, 'concentration_curve.png')
    )
    print(f"\n已生成: concentration_curve.png")
    
    visualizer.plot_absorption_curve(
        sim_result['time_points'],
        sim_result['absorption_history'],
        sim_result['material_names'],
        title="吸光度变化曲线",
        save_path=os.path.join(output_dir, 'absorption_curve.png')
    )
    print("已生成: absorption_curve.png")
    
    visualizer.plot_temperature_effect(
        temp_result['temperatures'],
        temp_result['final_concentrations'],
        sim_result['material_names'],
        title="温度对最终浓度的影响",
        save_path=os.path.join(output_dir, 'temperature_effect.png')
    )
    print("已生成: temperature_effect.png")
    
    visualizer.plot_reaction_yield(
        temp_result['temperatures'],
        np.array(temp_result['reaction_yields']),
        title="温度对反应产率的影响",
        save_path=os.path.join(output_dir, 'reaction_yield.png')
    )
    print("已生成: reaction_yield.png")
    
    visualizer.plot_color_evolution(
        color_evo_result['time_points'],
        color_evo_result['color_evolution'],
        title="染色过程颜色演化",
        save_path=os.path.join(output_dir, 'color_evolution.png')
    )
    print("已生成: color_evolution.png")
    
    material_colors = {name: m.color for name, m in material_collector.materials.items()}
    visualizer.plot_material_colors(
        material_colors,
        title="染料原料颜色展示",
        save_path=os.path.join(output_dir, 'material_colors.png')
    )
    print("已生成: material_colors.png")
    
    material_colors_list = [v for v in material_colors.values()]
    color_palette = color_predictor.create_color_palette(mixed_color, num_shades=7, variation='lightness')
    palette_dict = {f'shade_{i}': color_palette[i] for i in range(len(color_palette))}
    visualizer.plot_material_colors(
        palette_dict,
        title="混合颜色的深浅变化调色板",
        save_path=os.path.join(output_dir, 'color_palette.png')
    )
    print("已生成: color_palette.png")
    
    config_path = os.path.join(output_dir, 'simulation_config.json')
    config_data = {
        'materials': {name: m.to_dict() for name, m in material_collector.materials.items()},
        'simulation_ratios': ratios,
        'temperature': temperature,
        'target_color': target_color.tolist(),
        'optimized_ratios': {k: float(v) for k, v in optimized_ratios.items()},
        'simulation_result': {
            'reaction_yield': float(sim_result['reaction_yield']),
            'timestamp': sim_result['timestamp']
        }
    }
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=2, ensure_ascii=False)
    print(f"\n配置已保存到: {config_path}")
    
    print("\n" + "=" * 60)
    print("模拟完成!")
    print(f"所有输出文件已保存到: {os.path.abspath(output_dir)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
