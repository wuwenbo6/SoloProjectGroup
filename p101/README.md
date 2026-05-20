# 古法造纸纤维配比数值模拟系统

基于 NumPy、SciPy 实现的古法造纸纤维配比数值模拟系统，涵盖纤维种类、配比比例、浸泡时间等关键参数的动态计算。

## 功能特性

- **原料参数采集模块** (`raw_materials.py`)
  - 内置5种纤维原料数据库（桑皮、竹纤维、稻草、棉纤维、麻纤维）
  - 支持自定义原料参数导入/导出
  - 原料属性包括：纤维长度、直径、抗张强度、吸水率、密度

- **数值计算模块** (`numerical_computation.py`)
  - 基于加权平均的纤维属性计算
  - 纤维交互作用模型
  - 浸泡时间效应计算
  - 抗张强度预测模型
  - 孔隙率计算
  - 平滑曲线插值
  - 纤维长度分布统计
  - 多维度质量指标评估

- **核心配比模拟模块** (`simulation.py`)
  - 配比配置管理与验证
  - 单组分配比仿真
  - 参数批量扫描
  - HDF5 格式仿真结果存储
  - JSON 格式配置参数存储

- **结果可视化模块** (`visualization.py`)
  - 纤维长度分布图
  - 浸泡时间-强度曲线图
  - 配比比例饼图
  - 质量指标雷达图
  - 参数扫描分析图
  - 综合分析仪表盘

- **参数优化模块** (`optimization.py`)
  - 基于 SLSQP 的配比优化
  - 多目标权重配置
  - 浸泡时间网格搜索
  - 多目标 Pareto 优化
  - 优化过程历史追踪

## 项目结构

```
p101/
├── __init__.py              # 包初始化文件
├── raw_materials.py         # 原料参数采集模块
├── numerical_computation.py # 数值计算模块
├── simulation.py            # 核心配比模拟模块
├── visualization.py         # 结果可视化模块
├── optimization.py          # 参数优化模块
├── main.py                  # 主程序入口
├── requirements.txt         # 依赖包列表
└── README.md                # 说明文档
```

## 安装依赖

```bash
pip install numpy scipy matplotlib h5py
```

## 使用方法

### 1. 运行完整示例

```bash
python main.py
```

运行后将在 `output/` 目录下生成所有示例的图表和数据文件。

### 2. 基础配比模拟

```python
from simulation import PaperFiberSimulator, PaperSimulationConfig
from visualization import ResultVisualizer

simulator = PaperFiberSimulator()
visualizer = ResultVisualizer()

config = PaperSimulationConfig()
config.material_names = ['mulberry', 'bamboo', 'rice_straw']
config.ratios = [0.4, 0.35, 0.25]
config.soak_time = 24.0

result = simulator.run_simulation(config)
visualizer.plot_comprehensive_dashboard(result, 'dashboard.png')
```

### 3. 参数优化

```python
from simulation import PaperFiberSimulator
from optimization import ParameterOptimizer

simulator = PaperFiberSimulator()
optimizer = ParameterOptimizer(simulator)

material_names = ['mulberry', 'bamboo', 'rice_straw', 'cotton']
weights = {'strength': 0.5, 'uniformity': 0.3, 'printability': 0.2}

optimal_result, opt_info = optimizer.optimize_ratios(
    material_names,
    weights=weights
)
```

### 4. 参数扫描

```python
import numpy as np
from simulation import PaperFiberSimulator, PaperSimulationConfig
from visualization import ResultVisualizer

simulator = PaperFiberSimulator()
visualizer = ResultVisualizer()

base_config = PaperSimulationConfig()
base_config.material_names = ['mulberry', 'bamboo', 'hemp']
base_config.ratios = [0.4, 0.3, 0.3]

soak_times = np.linspace(6, 48, 15)
results = simulator.run_parameter_sweep(base_config, 'soak_time', soak_times)

visualizer.plot_parameter_sweep(results, 'soak_time', 'sweep.png')
```

### 5. 数据存储与加载

```python
# 保存配置和结果
simulator.save_config(config, 'config.json')
simulator.save_results_hdf5([result], 'results.h5')

# 加载配置和结果
loaded_config = simulator.load_config('config.json')
loaded_results = simulator.load_results_hdf5('results.h5')
```

## 可用纤维原料

| 英文名称 | 中文名称 | 纤维长度 (mm) | 抗张强度 (MPa) |
|---------|---------|-------------|-------------|
| mulberry | 桑皮 | 2.5 | 85.0 |
| bamboo | 竹纤维 | 1.8 | 72.0 |
| rice_straw | 稻草 | 1.2 | 55.0 |
| cotton | 棉纤维 | 3.0 | 95.0 |
| hemp | 麻纤维 | 2.8 | 90.0 |

## 质量指标说明

- **强度 (strength)**: 纸张抗张强度 (MPa)
- **孔隙率 (porosity)**: 纸张孔隙率 (0-1)
- **吸水性 (water_absorption)**: 纸张吸水率 (0-1)
- **均匀性 (uniformity)**: 纤维分布均匀性 (0-1)
- **耐久性 (durability)**: 综合耐久性指标
- **可打印性 (printability)**: 打印适应性评分 (0-100)
- **综合评分 (overall_score)**: 所有指标加权综合评分

## 输出文件说明

运行示例后，`output/` 目录将包含：

- `dashboard.png`: 基础配置综合仪表盘
- `fiber_distribution.png`: 纤维长度分布图
- `soaking_curve.png`: 浸泡时间-强度曲线图
- `ratios_pie.png`: 配比比例饼图
- `quality_radar.png`: 质量指标雷达图
- `parameter_sweep.png`: 参数扫描分析图
- `optimal_dashboard.png`: 最优配置综合仪表盘
- `config.json`: 示例配置文件
- `results.h5`: 仿真结果 HDF5 文件

## 技术栈

- **NumPy**: 数值计算与数组操作
- **SciPy**: 优化算法、插值、信号处理
- **Matplotlib**: 数据可视化
- **HDF5 (h5py)**: 高效科学数据存储
- **JSON**: 配置参数存储
