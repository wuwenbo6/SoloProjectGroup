# 古法竹编工艺张力数值模拟系统

基于 NumPy、SciPy 实现的古法竹编工艺张力数值模拟系统，涵盖竹丝种类、编织方式、张力大小等关键参数的动态计算。

## 功能特性

- **竹丝参数采集模块** (`bamboo_data.py`)
  - 支持多种竹种材料属性定义
  - 竹丝几何参数管理
  - JSON 格式导入导出配置

- **数值计算模块** (`numerical_calculation.py`)
  - 有限元求解器（桁架、梁单元）
  - 张力计算器（轴向、弯曲、接触）
  - 积分、插值、非线性求解器

- **核心张力模拟模块** (`tension_simulation.py`)
  - 静态张力模拟
  - 动态张力模拟
  - 多种编织方式支持（平纹、斜纹、缎纹、格子）
  - HDF5 格式结果存储

- **结果可视化模块** (`visualization.py`)
  - 张力时间序列图
  - 各分量张力对比图
  - 张力热力图
  - 应变-位移图
  - 张力统计分析图
  - 多结果对比图

- **参数优化模块** (`optimization.py`)
  - 梯度优化算法
  - 全局优化算法（差分进化）
  - 网格搜索
  - 多目标优化（帕累托前沿）
  - 参数敏感性分析

## 安装依赖

```bash
pip install -r requirements.txt
```

依赖包：
- numpy >= 1.21.0
- scipy >= 1.7.0
- matplotlib >= 3.4.0
- h5py >= 3.2.0

## 快速开始

### 运行完整示例

```bash
python main.py
```

### 基本使用

```python
from bamboo_data import BambooDataCollector
from tension_simulation import BambooWeaveSimulator
from visualization import TensionVisualizer

# 1. 初始化数据采集器
data_collector = BambooDataCollector()

# 2. 创建竹丝
data_collector.create_strip(
    species_name='Phyllostachys pubescens',
    length=1.0,
    width=0.005,
    thickness=0.001
)

# 3. 初始化模拟器
simulator = BambooWeaveSimulator(data_collector)
simulator.set_config(
    pattern='plain',
    warp_count=20,
    weft_count=20,
    base_tension=100.0
)

# 4. 运行模拟
result = simulator.simulate_static_tension()

# 5. 可视化结果
visualizer = TensionVisualizer()
visualizer.plot_tension_time_series(result, save_path='output/tension_plot.png')
```

### 参数优化

```python
from optimization import TensionOptimizer, OptimizationConfig

opt_config = OptimizationConfig(
    target_tension=150.0,
    tension_weight=1.0,
    uniformity_weight=0.5
)

optimizer = TensionOptimizer(data_collector, simulator, opt_config)
opt_result = optimizer.optimize_gradient_based(max_iter=50)

print(f"最优张力: {opt_result.optimal_tension:.2f} N")
print(f"最优参数: {opt_result.optimal_params}")
```

## 项目结构

```
.
├── bamboo_data.py          # 竹丝参数采集模块
├── numerical_calculation.py # 数值计算模块
├── tension_simulation.py   # 核心张力模拟模块
├── visualization.py        # 结果可视化模块
├── optimization.py         # 参数优化模块
├── main.py                 # 主程序入口
├── requirements.txt        # 依赖配置
├── config/                 # 配置文件目录
│   ├── weave_config.json  # 编织配置
│   └── bamboo_config.json # 竹材配置
└── output/                 # 输出目录
    └── *.png              # 生成的图表
```

## 配置说明

### 编织配置参数

| 参数 | 说明 | 默认值 | 范围 |
|------|------|--------|------|
| pattern | 编织方式 | 'plain' | plain, twill, satin, lattice |
| warp_count | 经纱数量 | 10 | 5-50 |
| weft_count | 纬纱数量 | 10 | 5-50 |
| base_tension | 基础张力 (N) | 100.0 | 50-500 |
| friction_coefficient | 摩擦系数 | 0.3 | 0.1-0.8 |
| simulation_time | 模拟时间 (s) | 1.0 | - |
| time_steps | 时间步数 | 100 | - |

### 支持的竹种

1. **Phyllostachys pubescens** (毛竹)
   - 杨氏模量: 1.2e10 Pa
   - 剪切模量: 5.0e9 Pa
   - 密度: 780 kg/m³

2. **Phyllostachys bambusoides** (刚竹)
   - 杨氏模量: 1.5e10 Pa
   - 剪切模量: 6.0e9 Pa
   - 密度: 820 kg/m³

## 数据存储

### HDF5 结果文件

包含以下数据集：
- `time`: 时间序列
- `warp_tension`: 经向张力
- `weft_tension`: 纬向张力
- `contact_tension`: 接触张力
- `total_tension`: 总张力
- `strain`: 应变
- `displacement`: 位移

### JSON 配置文件

- `config/weave_config.json`: 编织参数配置
- `config/bamboo_config.json`: 竹材参数配置

## 输出图表

运行 `main.py` 后将在 `output/` 目录生成以下图表：

1. `simulation_report_time_series.png` - 张力时间序列
2. `simulation_report_comparison.png` - 张力分量对比
3. `simulation_report_heatmap.png` - 张力热力图
4. `simulation_report_strain_displacement.png` - 应变位移图
5. `simulation_report_statistics.png` - 张力统计分析
6. `pattern_comparison.png` - 编织方式对比
7. `dynamic_tension.png` - 动态张力图

## 许可证

MIT License
