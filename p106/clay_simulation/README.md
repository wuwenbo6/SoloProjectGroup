# 传统泥塑工艺受力数值模拟系统

基于 NumPy 和 SciPy 实现的传统泥塑工艺受力数值模拟系统，支持泥料参数动态计算、应力分布可视化、自动参数优化等功能。

## 功能特性

### 1. 核心受力模拟模块 (`force_simulation`)
- 基于有限元方法的弹性力学计算
- 支持粘塑性变形模拟
- 提供参数扫描分析功能
- 计算安全系数和统计指标

### 2. 泥料参数采集模块 (`data_acquisition`)
- 预置三种典型泥料参数（高岭土、膨润土、红陶土）
- 支持泥料属性验证
- 计算派生材料属性（剪切模量、体积模量、孔隙率等）
- 支持从 JSON/CSV 文件导入泥料参数

### 3. 数值计算模块 (`numerical_computation`)
- 基于稀疏矩阵求解器的有限元计算
- 应变/应力张量计算
- Von Mises 等效应力计算
- 结果插值处理

### 4. 结果可视化模块 (`visualization`)
- 应力分布彩色图
- 位移场矢量图
- 应力剖面图
- 参数影响分析曲线
- 变形过程动画
- Pareto 前沿可视化

### 5. 参数优化模块 (`optimization`)
- 网格搜索优化
- 差分进化算法
- 多目标优化（Pareto 前沿）
- 基于随机森林的代理模型

### 6. 数据存储模块 (`data_storage`)
- HDF5 格式存储仿真结果
- JSON 格式存储配置参数
- VTK 格式导出用于后处理
- 数据备份功能

## 安装依赖

```bash
pip install numpy scipy matplotlib h5py scikit-learn
```

## 快速开始

### 基础模拟示例
```bash
cd clay_simulation
python examples/basic_simulation.py
```

### 参数优化示例
```bash
python examples/optimization_demo.py
```

## 模块结构

```
clay_simulation/
├── data_acquisition/          # 泥料参数采集模块
│   ├── __init__.py
│   └── parameter_collector.py
├── numerical_computation/     # 数值计算模块
│   ├── __init__.py
│   └── computation.py
├── force_simulation/          # 核心受力模拟模块
│   ├── __init__.py
│   └── simulator.py
├── visualization/             # 结果可视化模块
│   ├── __init__.py
│   └── visualizer.py
├── optimization/              # 参数优化模块
│   ├── __init__.py
│   └── optimizer.py
├── data_storage/              # 数据存储模块
│   ├── __init__.py
│   └── storage.py
├── examples/                  # 示例代码
│   ├── __init__.py
│   ├── basic_simulation.py
│   └── optimization_demo.py
├── tests/                     # 测试代码
├── requirements.txt
├── setup.py
└── README.md
```

## 使用示例

### 基础模拟流程
```python
from data_acquisition import ParameterCollector
from force_simulation import ForceSimulator, SimulationConfig
from visualization import ResultVisualizer

# 初始化
collector = ParameterCollector()
simulator = ForceSimulator(collector)
visualizer = ResultVisualizer()

# 配置模拟
config = SimulationConfig(
    clay_type='kaolin',
    force_magnitude=1000.0,
    force_direction=(0, -1),
    grid_size=(30, 30),
    simulation_time=0.5,
    time_steps=50
)

# 运行模拟
result = simulator.run_simulation(config)

# 可视化结果
visualizer.plot_stress_distribution(result, config)
```

### 参数优化流程
```python
from optimization import ParameterOptimizer, OptimizationConstraints

# 初始化优化器
optimizer = ParameterOptimizer(collector)

# 设置优化约束
constraints = OptimizationConstraints(
    target_safety_factor=1.5,
    moisture_range=(0.15, 0.40),
    force_range=(500.0, 2000.0),
    clay_types=['kaolin', 'bentonite', 'red_clay']
)

# 运行优化
opt_result = optimizer.grid_search_optimization(
    base_config=config,
    constraints=constraints,
    weights={'minimize_stress': 1.0, 'maximize_safety_factor': 0.5},
    resolution=10
)
```

## 泥料参数说明

系统预置三种典型泥料参数：

| 参数 | 高岭土 (kaolin) | 膨润土 (bentonite) | 红陶土 (red_clay) | 单位 |
|------|----------------|-------------------|-----------------|------|
| 含水量 | 0.25 | 0.35 | 0.22 | - |
| 密度 | 2600 | 2400 | 2700 | kg/m³ |
| 杨氏模量 | 5.0e6 | 3.0e6 | 7.0e6 | Pa |
| 泊松比 | 0.35 | 0.4 | 0.32 | - |
| 屈服强度 | 50000 | 30000 | 70000 | Pa |
| 粘度 | 1000 | 5000 | 800 | Pa·s |

## 支持的功能

1. **参数分析**:
   - 含水量对材料属性的影响
   - 力方向对结果的影响
   - 泥料类型对比分析

2. **优化目标**:
   - 最小化最大应力
   - 最小化最大变形
   - 最大化安全系数
   - 支持多目标权重配置

3. **数据导出**:
   - HDF5 数值结果
   - JSON 配置文件
   - PNG 图像文件
   - VTK 可视化文件

## 许可证

MIT License
