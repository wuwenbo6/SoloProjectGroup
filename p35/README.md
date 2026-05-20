# 古法酿造发酵过程数值仿真系统

基于NumPy和SciPy的古法酿造（黄酒、酱油）发酵过程数值模拟系统，提供发酵动力学建模、参数优化、结果可视化等功能。

## 功能特性

### 核心仿真模块
- 黄酒发酵动力学模型（酵母、细菌、糖分、酒精）
- 酱油发酵动力学模型（曲霉、乳酸菌、酵母、蛋白质分解、氨基酸生成）
- 基于Scipy ODE求解器的数值计算
- 温度曲线配置与插值

### 参数采集模块
- JSON配置文件导入导出
- 手动参数输入交互界面
- 传感器数据模拟与导入
- 数据验证与检查

### 结果可视化模块
- 微生物生长曲线（对数坐标）
- 底物消耗与产物生成对比
- 温度与pH变化曲线
- 综合监控仪表盘
- 多批次参数对比图

### 参数优化模块
- 局部参数优化（L-BFGS-B）
- 全局参数优化（差分进化）
- 网格搜索参数探索
- 多参数同时优化
- 历史数据驱动的优化建议

### 数据存储模块
- JSON格式存储配置与摘要
- HDF5格式存储仿真结果（高效压缩）
- CSV格式导出数据
- 历史数据管理

## 项目结构

```
p35/
├── src/
│   ├── __init__.py              # 包初始化
│   ├── numerical_computation.py # 数值计算与动力学模型
│   ├── fermentation_simulator.py # 核心仿真引擎
│   ├── data_acquisition.py      # 参数采集与传感器接口
│   ├── visualization.py         # 结果可视化
│   ├── parameter_optimization.py # 参数优化算法
│   └── data_storage.py          # 数据存储管理
├── configs/
│   ├── rice_wine_default.json   # 黄酒默认配置
│   └── soy_sauce_default.json   # 酱油默认配置
├── data/                        # 数据存储目录
│   ├── configs/
│   ├── simulations/
│   └── history/
├── output/                      # 图表输出目录
├── main.py                      # 主程序入口
├── requirements.txt             # 依赖包列表
└── README.md
```

## 安装与配置

### 环境要求
- Python 3.8+
- NumPy
- SciPy
- Matplotlib
- h5py

### 安装依赖
```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 运行默认黄酒发酵仿真
```bash
python main.py --mode demo
```

### 2. 运行酱油发酵仿真
```bash
python main.py --mode soy_sauce
```

### 3. 使用自定义配置文件
```bash
python main.py --mode rice_wine --config your_config.json
```

### 4. 运行参数优化
```bash
python main.py --mode optimize
```

### 5. 模拟传感器数据采集
```bash
python main.py --mode sensor
```

### 6. 多批次参数对比
```bash
python main.py --mode batch
```

### 7. 完整功能演示
```bash
python main.py --mode full
```

## 配置文件说明

### 黄酒发酵配置 (rice_wine_default.json)
```json
{
  "name": "古法黄酒发酵配置",
  "type": "rice_wine",
  "fermentation": {
    "total_time": 168,
    "time_step": 0.5,
    "initial_temperature": 25.0,
    "target_temperature": 30.0
  },
  "kinetics": {
    "yeast_growth_rate": 0.3,
    "bacteria_growth_rate": 0.15,
    "sugar_conversion_rate": 0.25,
    "alcohol_production_rate": 0.2
  },
  "initial_conditions": {
    "yeast_concentration": 1e6,
    "bacteria_concentration": 1e4,
    "sugar_concentration": 150.0,
    "alcohol_concentration": 0.0,
    "ph": 5.5
  }
}
```

### 酱油发酵配置 (soy_sauce_default.json)
```json
{
  "name": "古法酱油发酵配置",
  "type": "soy_sauce",
  "fermentation": {
    "total_time": 1440,
    "time_step": 6.0,
    "initial_temperature": 28.0,
    "target_temperature": 32.0
  },
  "kinetics": {
    "aspergillus_growth_rate": 0.15,
    "lactobacillus_growth_rate": 0.1,
    "yeast_growth_rate": 0.08,
    "protein_decomposition_rate": 0.12,
    "amino_acid_production_rate": 0.08
  },
  "initial_conditions": {
    "aspergillus_concentration": 5e5,
    "lactobacillus_concentration": 1e4,
    "yeast_concentration": 1e3,
    "protein_concentration": 200.0,
    "amino_acid_concentration": 0.0,
    "salt_concentration": 180.0,
    "ph": 6.0
  }
}
```

## API使用示例

### 基本仿真流程
```python
from src import FermentationSimulator, FermentationVisualizer

# 加载配置
import json
with open("configs/rice_wine_default.json") as f:
    config = json.load(f)

# 运行仿真
simulator = FermentationSimulator(config_dict=config)
results = simulator.run_simulation()

# 评估质量
quality = simulator.calculate_quality_score()
print(f"质量评分: {quality}")

# 可视化
visualizer = FermentationVisualizer(results)
visualizer.plot_combined_dashboard(save_path="output/dashboard.png")
```

### 参数优化
```python
from src import FermentationOptimizer

optimizer = FermentationOptimizer(config)
results = optimizer.optimize_local()

print(f"最优温度: {results['best_parameters']['temperature']}")
print(f"最优发酵时间: {results['best_parameters']['fermentation_time']}")
```

### 数据存储
```python
from src import DataManager

data_manager = DataManager("data")
paths = data_manager.save_full_simulation(config, results, summary)

# 加载历史数据
loaded = data_manager.load_full_simulation(
    "config_file.json",
    "simulation_file.h5"
)
```

## 动力学模型

### 黄酒发酵模型
- 酵母生长: Monod动力学 + 酒精抑制
- 细菌生长: Monod动力学 + 酒精抑制
- 糖消耗: 微生物生长耦联
- 酒精生成: 酵母代谢产物
- 温度影响: Arrhenius方程修正
- pH影响: 高斯分布修正

### 酱油发酵模型
- 曲霉生长: 蛋白底物限制
- 乳酸菌生长: 糖类底物 + 盐耐受
- 酵母生长: 氨基酸底物
- 蛋白质分解: 酶催化动力学
- 淀粉转化: 糖化酶作用
- 氨基酸生成: 蛋白质分解产物

## 质量评分标准

### 黄酒质量评分
- 酒精含量 (40%权重)
- 残糖量 (30%权重)
- 酵母数 (30%权重)

### 酱油质量评分
- 氨基酸含量 (40%权重)
- 蛋白质转化率 (35%权重)
- pH平衡度 (25%权重)

## 输出图表说明

1. `microbes_growth.png`: 微生物生长曲线（半对数坐标）
2. `substrate_conversion.png`: 底物消耗与产物生成（双Y轴）
3. `ph_temperature.png`: pH值与温度变化曲线
4. `combined_dashboard.png`: 综合监控仪表盘（2x2子图）
5. `optimization_results.png`: 参数优化过程与探索空间
6. `sensor_data.png`: 传感器采集数据可视化
7. `batch_comparison.png`: 多批次参数对比图

## 数据格式

### HDF5存储结构
- /time: 时间序列数组
- /states: 状态变量矩阵 (n_vars x n_time)
- attributes:
  - simulation_id: 仿真唯一标识
  - fermentation_type: 发酵类型
  - state_names: 状态变量名称（JSON格式）

### 配置JSON结构
- fermentation: 发酵参数（时间、温度等）
- kinetics: 动力学参数（生长速率、转化率等）
- initial_conditions: 初始条件
- optimization: 优化参数范围与目标

## 开发与扩展

### 添加新的发酵类型
1. 在`numerical_computation.py`中继承`FermentationKinetics`类
2. 实现自定义的ODE系统
3. 在`FermentationSimulator`中添加类型判断
4. 创建对应的配置文件模板

### 自定义动力学参数
修改配置文件中的`kinetics`部分，或使用参数优化模块自动寻优。

### 添加新的可视化图表
在`FermentationVisualizer`类中添加新的绘图方法。

## 许可证

本项目仅供科研与教学使用。

## 联系方式

古法酿造仿真团队
v1.0.0
