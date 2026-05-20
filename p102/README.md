# 榫卯结构受力模拟系统

Mortise and Tenon Joint Stress Simulation System

基于 NumPy 和 SciPy 的传统榫卯结构力学数值模拟系统。

## 项目简介

本系统实现了传统榫卯结构的受力分析与数值模拟，支持多种木材类型、榫卯结构和受力方向的参数化计算。系统集成了应力分布可视化、参数优化和数据存储功能。

## 功能特性

- **核心受力模拟**: 基于材料力学和弹性力学理论的数值计算
- **多种榫卯类型**: 支持平接、搭接、榫卯、燕尾榫等多种连接方式
- **多种木材类型**: 松木、橡木、红木等多种材料参数
- **多方向载荷**: 轴向、剪切、弯曲、扭转载荷分析
- **应力可视化**: 热力图、剖面图、应力曲线可视化
- **参数优化**: 随机搜索、网格搜索、贝叶斯优化
- **数据存储**: HDF5 存储仿真结果，JSON 存储配置参数

## 项目结构

```
p102/
├── __init__.py              # 模块初始化
├── parameters.py            # 参数管理模块
├── numerical.py             # 数值计算模块
├── simulation.py            # 核心模拟模块
├── visualization.py         # 结果可视化模块
├── optimization.py          # 参数优化模块
├── main.py                  # 主入口程序
├── example.py               # 示例脚本
├── config.json              # 配置文件
├── requirements.txt         # 依赖列表
├── data/                    # 数据目录
│   ├── *.h5                # HDF5 仿真结果
│   ├── *.json              # 参数配置
│   └── reports/            # 可视化报告
└── README.md               # 本文件
```

## 安装依赖

```bash
pip install -r requirements.txt
```

依赖包括:
- numpy >= 1.21.0
- scipy >= 1.7.0
- matplotlib >= 3.4.0
- h5py >= 3.2.0
- scikit-optimize >= 0.9.0

## 快速开始

### 方式1: 运行完整模拟流程

```bash
python main.py
```

### 方式2: 仅运行基础模拟

```bash
python main.py --mode simulation
```

### 方式3: 运行参数优化

```bash
python main.py --mode optimize
```

### 方式4: 运行示例脚本

```bash
# 运行所有示例
python example.py

# 运行单个示例 (1-5)
python example.py --example 1
```

## 模块说明

### 1. parameters.py - 参数管理模块

**ParameterManager** 类负责管理所有结构参数:

```python
from parameters import ParameterManager

pm = ParameterManager()

# 设置结构参数
params = pm.set_structure_parameters(
    wood_type='oak',           # 木材类型: pine, oak, rosewood
    joint_type='mortise_tenon', # 榫卯类型: butt_joint, lap_joint, mortise_tenon, dovetail
    beam_width=0.05,           # 梁宽 (m)
    beam_height=0.05,          # 梁高 (m)
    beam_length=0.3,           # 梁长 (m)
    tenon_length=0.03,         # 榫头长度 (m)
    tenon_width=0.02,          # 榫头宽度 (m)
    mortise_depth=0.02,        # 榫眼深度 (m)
    load_magnitude=1000.0,     # 载荷大小 (N)
    load_direction='bending',  # 受力方向: axial, shear, bending, torsion
    friction_coefficient=0.5   # 摩擦系数
)

# 验证参数
errors = pm.validate_parameters()

# 保存/加载参数
pm.save_parameters('params.json')
pm.load_parameters('params.json')
```

### 2. numerical.py - 数值计算模块

**NumericalCalculator** 静态类提供各种力学计算:

```python
from numerical import NumericalCalculator

# 截面特性计算
section = NumericalCalculator.calculate_section_properties(width=0.05, height=0.05)

# 应力计算
axial_stress = NumericalCalculator.calculate_axial_stress(load=1000, area=section['area'])

# 主应力计算
sigma1, sigma2, theta = NumericalCalculator.calculate_principal_stresses(
    sigma_x=10e6, sigma_y=0, tau_xy=5e6
)

# Von Mises 等效应力
von_mises = NumericalCalculator.calculate_von_mises_stress(
    sigma_x=10e6, sigma_y=0, sigma_z=0,
    tau_xy=5e6, tau_yz=0, tau_xz=0
)
```

### 3. simulation.py - 核心模拟模块

**StressSimulation** 类执行完整的受力模拟:

```python
from simulation import StressSimulation

simulation = StressSimulation(param_manager)

# 运行模拟
results = simulation.run_simulation()

# 获取摘要
print(simulation.get_summary())

# 保存/加载结果
h5_path = simulation.save_results('results.h5')
loaded_results = StressSimulation.load_results('results.h5')

# 参数化研究
study_results = simulation.run_parametric_study(
    param_name='tenon_length',
    start=0.01,
    end=0.08,
    num_points=15
)
```

### 4. visualization.py - 结果可视化模块

**ResultsVisualizer** 类生成各种可视化图表:

```python
from visualization import ResultsVisualizer

visualizer = ResultsVisualizer(results)

# 应力热力图
visualizer.plot_stress_heatmap('von_mises', save_path='stress.png')

# 应力剖面图
visualizer.plot_stress_profile(save_path='profile.png')

# 安全系数柱状图
visualizer.plot_safety_factors(save_path='sf.png')

# 结构示意图
visualizer.plot_joint_schematic(save_path='schematic.png')

# 生成完整报告
report_dir = visualizer.generate_report()
```

### 5. optimization.py - 参数优化模块

**JointOptimizer** 类提供参数优化功能:

```python
from optimization import JointOptimizer

optimizer = JointOptimizer(param_manager, simulation)

# 运行优化
opt_results = optimizer.optimize(
    method='random',              # 优化方法: random, grid, bayesian
    param_names=['tenon_length', 'tenon_width', 'mortise_depth'],
    n_iterations=50,
    weights={'safety_factor': 0.6, 'deformation': 0.3, 'stress': 0.1}
)

# 查看优化摘要
print(optimizer.get_optimization_summary())

# 绘制收敛曲线
optimizer.plot_convergence(save_path='convergence.png')

# 对比优化前后
optimizer.compare_before_after(save_path='comparison.png')
```

## 结果数据结构

模拟结果包含以下字段:

```python
results = {
    'simulation_id': str,           # 模拟ID
    'timestamp': str,               # 时间戳
    'parameters': dict,             # 输入参数
    'section_properties': dict,     # 截面特性
    'contact_area': float,          # 接触面积
    'stress_field': {               # 应力场
        'X': np.ndarray,            # X坐标
        'Y': np.ndarray,            # Y坐标
        'sigma_x': np.ndarray,      # x方向正应力
        'sigma_y': np.ndarray,      # y方向正应力
        'tau_xy': np.ndarray,       # 剪应力
        'von_mises': np.ndarray     # Von Mises等效应力
    },
    'max_stresses': dict,           # 最大应力值
    'contact_stresses': dict,       # 接触应力
    'joint_stiffness': float,       # 接头刚度
    'safety_factors': dict,         # 安全系数
    'failure_modes': dict,          # 失效模式
    'deformation': dict,            # 变形量
    'converged': bool               # 收敛状态
}
```

## 木材力学参数

系统内置三种木材类型的参数:

| 参数 | 松木 (pine) | 橡木 (oak) | 红木 (rosewood) |
|------|------------|-----------|----------------|
| 弹性模量 | 10 GPa | 12 GPa | 15 GPa |
| 剪切模量 | 0.5 GPa | 0.6 GPa | 0.8 GPa |
| 密度 | 500 kg/m³ | 700 kg/m³ | 900 kg/m³ |
| 抗压强度 | 40 MPa | 60 MPa | 80 MPa |
| 抗拉强度 | 80 MPa | 100 MPa | 120 MPa |

## 使用示例

### 示例1: 基础模拟

```python
from parameters import ParameterManager
from simulation import StressSimulation

pm = ParameterManager()
pm.set_structure_parameters(
    wood_type='oak',
    joint_type='mortise_tenon',
    beam_width=0.05,
    beam_height=0.05,
    beam_length=0.3,
    tenon_length=0.03,
    tenon_width=0.02,
    mortise_depth=0.02,
    load_magnitude=1000.0,
    load_direction='bending'
)

sim = StressSimulation(pm)
results = sim.run_simulation()
print(sim.get_summary())
```

### 示例2: 参数优化

```python
from parameters import ParameterManager
from simulation import StressSimulation
from optimization import JointOptimizer

pm = ParameterManager()
pm.set_structure_parameters(...)

sim = StressSimulation(pm)
optimizer = JointOptimizer(pm, sim)

results = optimizer.optimize(
    method='bayesian',
    param_names=['tenon_length', 'tenon_width'],
    n_iterations=100
)
```

## 命令行参数

```bash
python main.py [--mode MODE] [--load HDF5_FILE]
               [--wood WOOD_TYPE] [--joint JOINT_TYPE]
               [--load-dir DIRECTION] [--force FORCE]

参数说明:
  --mode        运行模式: all, simulation, study, optimize
  --load        加载已有的HDF5结果文件
  --wood        木材类型: pine, oak, rosewood
  --joint       榫卯类型: butt_joint, lap_joint, mortise_tenon, dovetail
  --load-dir    受力方向: axial, shear, bending, torsion
  --force       载荷大小 (N)
```

## 数据存储

### HDF5 格式

系统使用 HDF5 存储仿真结果，包含:
- 标量属性 (模拟ID、参数、截面特性等)
- 数组数据 (应力场)

### JSON 格式

结构参数以 JSON 格式存储，便于阅读和编辑。

## 常见问题

**Q: 如何添加新的木材类型?**

A: 编辑 `config.json` 文件，在 `wood_types` 部分添加新的材料参数。

**Q: 如何自定义优化目标函数?**

A: 继承 `JointOptimizer` 类并重写 `objective_function` 方法。

**Q: 支持 3D 模拟吗?**

A: 当前版本为 2D 平面应力/应变分析，3D 功能在开发中。

## 许可证

本项目仅供学习和研究使用。

## 联系方式

如有问题或建议，请联系开发团队。
