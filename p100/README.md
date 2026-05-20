# 染料配比模拟系统 (Dye Mixing Simulation System)

基于 NumPy、SciPy 实现的传统染料配比数值模拟系统，涵盖原料浓度、配比比例、反应温度等关键参数的动态计算，支持数据导入、可视化分析和染色效果预测。

## 功能特性

### 1. 原料参数采集模块 (`material_collector.py`)
- 染料原料的增删改查管理
- 原料浓度、摩尔质量、吸光系数、RGB颜色等参数配置
- 原料数据验证
- JSON/CSV格式数据导入导出
- 总质量计算、浓度数组、颜色矩阵生成

### 2. 数值计算模块 (`numerical_calculator.py`)
- Arrhenius方程温度效应计算
- 基于ODE的反应动力学模拟
- Beer-Lambert定律吸光度计算
- 配比优化（最小二乘优化）
- 温度扫描分析
- 动力学参数拟合
- 多组分扩散计算
- pH效应计算

### 3. 核心配比模拟模块 (`simulation.py`)
- 单次配比模拟
- 温度扫描模拟
- 批量配比模拟
- HDF5格式结果存储与加载
- 混合颜色计算
- 颜色演化模拟

### 4. 结果可视化模块 (`visualization.py`)
- 浓度变化曲线
- 吸光度变化曲线
- 温度效应曲线
- 反应产率曲线
- 配比对比柱状图
- 颜色演化可视化
- 原料颜色展示
- 3D配比响应曲面
- 综合报告生成

### 5. 颜色预测模块 (`color_predictor.py`)
- RGB/HEX/HSV颜色空间转换
- 混合颜色预测
- 颜色差异计算（欧氏距离、CIE76、CIE94）
- 最接近颜色匹配
- 颜色梯度生成
- 颜色属性分析（亮度、饱和度、色温）
- 配比优化（目标颜色匹配）
- 染色结果预测
- 调色板生成

## 项目结构

```
p100/
├── __init__.py              # 包初始化文件
├── material_collector.py    # 原料参数采集模块
├── numerical_calculator.py  # 数值计算模块
├── simulation.py            # 核心配比模拟模块
├── visualization.py         # 结果可视化模块
├── color_predictor.py       # 颜色预测模块
├── main.py                  # 包主程序入口
├── example.py               # 可直接运行的示例程序
├── requirements.txt         # 依赖包列表
├── config.json              # 配置文件
└── README.md                # 项目说明文档
```

## 安装依赖

```bash
pip install -r requirements.txt
```

依赖包列表：
- numpy >= 1.21.0
- scipy >= 1.7.0
- matplotlib >= 3.4.0
- h5py >= 3.2.0
- colorspacious >= 1.1.2 （可选，用于CIE颜色差异计算）

## 快速开始

### 运行示例程序

```bash
python example.py
```

示例程序将演示：
1. 原料配置与验证
2. 单次配比模拟
3. 温度扫描分析
4. 颜色预测与分析
5. 配比优化（目标颜色匹配）
6. 生成可视化报告

### 基础使用示例

```python
from material_collector import Material, MaterialCollector
from numerical_calculator import NumericalCalculator
from simulation import DyeSimulation
from visualization import DyeVisualizer
from color_predictor import ColorPredictor

# 1. 初始化原料采集器
material_collector = MaterialCollector()

# 2. 添加染料原料
material_collector.add_material(Material(
    name="红色染料R",
    concentration=1.0,
    molar_mass=300.0,
    absorption_coefficient=0.8,
    color=[1.0, 0.1, 0.1]
))

# 3. 运行模拟
calculator = NumericalCalculator()
simulation = DyeSimulation(material_collector, calculator)

ratios = {"红色染料R": 0.4, "黄色染料Y": 0.3, "蓝色染料B": 0.3}
result = simulation.run_single_simulation(ratios, temperature=60.0, time_span=(0, 100))

# 4. 可视化
visualizer = DyeVisualizer()
visualizer.plot_concentration_curve(
    result['time_points'],
    result['concentration_history'],
    result['material_names'],
    save_path='concentration_curve.png'
)

# 5. 颜色预测
color_predictor = ColorPredictor()
mixed_color = simulation.calculate_mixture_color(ratios)
print(f"混合颜色: {color_predictor.rgb_to_hex(mixed_color)}")
```

## 数据存储

### HDF5 格式存储仿真结果
- 支持多组仿真结果存储
- 完整保留时间序列数据
- 高效压缩存储

```python
# 保存结果
simulation.save_to_hdf5(result, 'simulation_results.h5', group_name='sim_001')

# 读取结果
loaded_result = simulation.load_from_hdf5('simulation_results.h5', group_name='sim_001')

# 列出所有数据集
groups = simulation.list_hdf5_groups('simulation_results.h5')
```

### JSON 格式存储配置参数
- 原料配置
- 配比参数
- 模拟结果摘要

## 可视化输出

运行示例后将在 `simulation_output/` 目录下生成以下图表：

1. `concentration_curve.png` - 各染料浓度随时间变化曲线
2. `absorption_curve.png` - 吸光度随时间变化曲线
3. `temperature_effect.png` - 温度对最终浓度的影响
4. `reaction_yield.png` - 温度对反应产率的影响
5. `color_evolution.png` - 染色过程颜色演化
6. `material_colors.png` - 染料原料颜色展示
7. `color_palette.png` - 混合颜色的深浅变化调色板
8. `simulation_config.json` - 模拟配置参数

## 核心API说明

### Material 类
```python
Material(name, concentration, molar_mass, absorption_coefficient, color)
```

### MaterialCollector 类
```python
add_material(material)
remove_material(name)
get_material(name)
get_all_materials()
update_concentration(name, new_concentration)
calculate_total_mass(ratios)
save_to_json(filepath)
load_from_json(filepath)
validate_materials()
```

### NumericalCalculator 类
```python
arrhenius_equation(temperature, Ea, A)
simulate_reaction(initial_concentrations, temperature, time_span, num_points)
beer_lambert(concentration, absorption_coeff, path_length)
optimize_ratio(target_absorption, absorption_coeffs, bounds)
temperature_effect_curve(temp_range, initial_concentrations, time_point)
calculate_kinetic_parameters(time_data, conc_data)
```

### DyeSimulation 类
```python
run_single_simulation(ratios, temperature, time_span)
run_temperature_sweep(ratios, temp_range, num_temps, time_point)
run_ratio_optimization(target_absorption, bounds)
run_batch_simulation(ratio_list, temperature, time_span)
save_to_hdf5(results, filepath, group_name)
load_from_hdf5(filepath, group_name)
calculate_mixture_color(ratios)
simulate_color_evolution(ratios, temperature, time_span)
```

### DyeVisualizer 类
```python
plot_concentration_curve(time_points, concentration_history, material_names)
plot_absorption_curve(time_points, absorption_history, material_names)
plot_temperature_effect(temperatures, final_concentrations, material_names)
plot_reaction_yield(temperatures, yields)
plot_ratio_comparison(ratio_results)
plot_color_evolution(time_points, color_evolution)
plot_material_colors(material_colors)
create_comprehensive_report(sim_result, output_dir)
```

### ColorPredictor 类
```python
rgb_to_hex(rgb)
hex_to_rgb(hex_color)
rgb_to_hsv(rgb)
hsv_to_rgb(hsv)
predict_mixed_color(colors, weights)
color_difference(color1, color2, method)
find_closest_color(target_color, color_palette, method)
generate_color_gradient(start_color, end_color, num_steps)
optimize_matching_ratio(target_color, base_colors, max_iterations, learning_rate)
analyze_color_properties(rgb)
predict_dyeing_result(fabric_color, dye_color, dye_concentration)
create_color_palette(base_color, num_shades, variation)
```

## 配置说明

### config.json 配置文件
```json
{
    "simulation": {
        "temperature_range": [20, 100],
        "time_steps": 100,
        "reaction_rate_constant": 0.01
    },
    "visualization": {
        "figure_size": [12, 8],
        "dpi": 100,
        "colormap": "viridis"
    },
    "storage": {
        "hdf5_file": "simulation_results.h5",
        "config_file": "config.json"
    }
}
```

## 扩展开发

### 添加新的染料原料
```python
new_material = Material(
    name="新染料X",
    concentration=1.0,
    molar_mass=350.0,
    absorption_coefficient=0.75,
    color=[0.2, 0.8, 0.6]  # RGB值
)
material_collector.add_material(new_material)
```

### 自定义反应动力学模型
继承并重写 `NumericalCalculator` 类：
```python
class CustomCalculator(NumericalCalculator):
    def reaction_kinetics(self, concentrations, t, temperature, rate_constant=None):
        # 自定义反应动力学方程
        pass
```

## 许可证

本项目仅供学术研究和工业应用参考。

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。
