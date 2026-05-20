# 古法陶瓷烧制数值模拟系统

基于 NumPy 和 SciPy 的古法陶瓷烧制过程数值模拟平台，支持窑温曲线仿真、坯体收缩计算、气氛控制、参数优化等功能。

## 功能特性

### 1. 核心仿真模块 (simulation.py)
- 窑温曲线动态仿真
- 湿度演变模型
- 窑内气氛（O2, CO2, 还原气氛）计算
- 热应力分析

### 2. 数值计算模块 (numerical.py)
- 坯体收缩率计算（热收缩 + 烧结收缩）
- 孔隙率与密度演变
- 一维热传导模拟
- 热应力与烧结应力计算
- 相变演变（石英相变、莫来石、玻璃相）

### 3. 参数采集模块 (data_acquisition.py)
- CSV/Excel 传感器数据导入
- 模拟传感器数据生成
- 数据重采样与插值
- 数据统计分析

### 4. 结果可视化模块 (visualization.py)
- 综合参数仪表板
- 温度/湿度/气氛曲线
- 3D 温度分布可视化
- 应力分析图表
- 相组成演变图

### 5. 参数优化模块 (optimization.py)
- 基于梯度的局部优化
- 差分进化全局优化
- 参数敏感性分析
- 帕累托前沿分析
- 质量与缺陷风险预测

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 运行完整仿真流程
```bash
python main.py
```

### 仅运行基础仿真
```bash
python main.py --mode simulation
```

### 仅运行参数优化
```bash
python main.py --mode optimization
```

### 运行传感器数据对比
```bash
python main.py --mode sensor
```

### 指定输出目录
```bash
python main.py --output ./results
```

## 项目结构

```
p64/
├── __init__.py              # 包初始化
├── simulation.py            # 核心仿真模块
├── numerical.py             # 数值计算模块
├── data_acquisition.py      # 参数采集模块
├── visualization.py         # 结果可视化模块
├── optimization.py          # 参数优化模块
├── main.py                  # 主程序入口
├── requirements.txt         # 依赖列表
└── README.md               # 项目文档
```

## 核心类说明

### FiringParameters
烧制参数配置类，包含：
- `initial_temp`: 初始温度 (°C)
- `target_temp`: 目标烧结温度 (°C)
- `heating_rate`: 升温速率 (°C/min)
- `holding_time`: 保温时间 (min)
- `cooling_rate`: 降温速率 (°C/min)

### KilnSimulation
窑炉仿真主类：
```python
from simulation import KilnSimulation, FiringParameters

params = FiringParameters(target_temp=1280, heating_rate=120)
sim = KilnSimulation(params)
result = sim.run(time_steps=1000)
```

### ParameterOptimizer
参数优化器：
```python
from optimization import ParameterOptimizer

optimizer = ParameterOptimizer()
result = optimizer.optimize_global(popsize=15, maxiter=100)
print("最优参数:", result.optimal_params)
```

## 输出图表说明

运行仿真后，output 目录将生成以下图表：

1. `dashboard.png` - 综合参数仪表板
2. `3d_temperature.png` - 3D 温度分布
3. `stress_analysis.png` - 热应力分析
4. `phase_composition.png` - 相组成演变
5. `porosity_density.png` - 孔隙率与密度
6. `optimized_curve.png` - 优化烧制曲线
7. `sensor_comparison.png` - 仿真与传感器对比

## 技术栈

- **数值计算**: NumPy, SciPy
- **数据处理**: Pandas
- **可视化**: Matplotlib
- **优化算法**: L-BFGS-B, Differential Evolution

## 扩展开发

### 添加新的烧制曲线
```python
from optimization import ScheduleGenerator

gen = ScheduleGenerator()
time, temp = gen.generate_multi_stage_schedule([
    {'type': 'heating', 'rate': 100, 'target': 600},
    {'type': 'holding', 'duration': 30},
    {'type': 'heating', 'rate': 80, 'target': 1250},
    {'type': 'holding', 'duration': 120},
    {'type': 'cooling', 'rate': 60, 'target': 25}
])
```

### 导入真实传感器数据
```python
from data_acquisition import SensorDataImporter

importer = SensorDataImporter()
data = importer.from_csv('sensor_data.csv', 
                         time_column='time',
                         temp_column='temperature')
```

## 许可证

本项目仅供学术研究使用。
