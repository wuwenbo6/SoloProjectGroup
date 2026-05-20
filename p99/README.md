# 传统陶瓷烧制过程数值模拟系统

基于 NumPy、SciPy 实现的陶瓷烧制过程数值仿真平台，支持窑温、湿度、气氛等关键参数的动态计算与优化。

## 功能特性

### 核心仿真模块 (simulation.py)
- 一维热传导方程求解
- 窑内温度场动态模拟
- 陶瓷坯体内部温度分布计算
- 干燥过程模拟（水分排出）
- 有机物燃烧过程模拟
- 热收缩变形计算

### 数值计算模块 (numerical.py)
- 基于有限差分法的热传导求解器
- 热力学参数计算（蒸汽压、比热容、热膨胀）
- 窑内气氛模型（氧气含量、CO2 产生）
- 插值与数据处理工具

### 数据采集模块 (data_acquisition.py)
- 传感器数据导入（CSV/JSON 格式）
- 异常值检测与去除
- 数据平滑处理
- 参数梯度计算
- 温度曲线自动提取

### 结果可视化模块 (visualization.py)
- 温度变化曲线图（表面/中心/窑温对比）
- 温度分布热力图
- 湿度变化曲线图
- 气氛参数变化图
- 物理变化过程图（水分/有机物/收缩）
- 仿真与实测数据对比图

### 参数优化模块 (optimization.py)
- 基于 L-BFGS-B 的温度曲线优化
- 多参数联合优化
- 网格搜索参数寻优
- 自定义目标函数
- 烧制质量指标评估

### 多窑炉协同模拟模块 (multi_kiln.py)
- 多窑炉调度管理
- 能量分配优化
- 废气排放协同控制
- 共享资源管理
- 调度冲突检测

### 异常预警检测模块 (anomaly_detection.py)
- 温度异常检测（超温、升温过快）
- 参数变化率检测
- 多级预警机制（INFO/WARNING/CRITICAL/FATAL）
- 异常事件持久化存储
- 实时监控回调机制
- 模式识别（热冲击、干燥效率、保温波动）

### 对比分析模块 (comparison.py)
- 仿真与实测数据对齐
- 误差统计分析（MAE/RMSE/R²）
- 分阶段质量评估
- 温度曲线相关分析
- 自动生成改进建议
- 可视化对比图表

### 高性能计算模块 (fast_numerical.py)
- 向量化热传导求解器
- 批量仿真支持
- 进程池并行计算
- 性能剖析与基准测试
- 内存使用优化
- 滑动窗口向量化计算

## 项目结构

```
p99/
├── main.py                 # 主程序入口
├── requirements.txt        # 依赖包列表
├── src/
│   ├── __init__.py
│   ├── simulation.py       # 核心仿真模块
│   ├── numerical.py        # 数值计算模块
│   ├── data_acquisition.py # 数据采集模块
│   ├── visualization.py    # 结果可视化模块
│   ├── optimization.py     # 参数优化模块
│   ├── multi_kiln.py       # 多窑炉协同模块
│   ├── anomaly_detection.py # 异常预警模块
│   ├── comparison.py       # 对比分析模块
│   └── fast_numerical.py   # 高性能计算模块
├── config/                 # 配置文件目录
├── data/                   # 传感器数据目录
└── results/                # 仿真结果目录
```

## 安装

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 运行默认仿真

```bash
python main.py simulate
```

### 2. 使用自定义配置

```bash
# 生成示例配置文件
python main.py generate-config -o config/my_config.json

# 修改配置后运行仿真
python main.py simulate -c config/my_config.json
```

### 3. 导入和处理传感器数据

```bash
# 生成示例传感器数据
python main.py generate-sensor -o data/sensor.csv

# 处理传感器数据
python main.py import -s data/sensor.csv
```

### 4. 参数优化

```bash
python main.py optimize -c config/my_config.json
```

### 5. 多窑炉协同仿真

```bash
# 3窑炉协同仿真（默认）
python main.py multi-kiln

# 5窑炉协同仿真
python main.py multi-kiln -n 5
```

### 6. 异常预警检测

```bash
python main.py anomaly -sim results/simulation_results.h5
```

### 7. 仿真与实测数据对比分析

```bash
# 简单对比
python main.py compare -sim results/simulation_results.h5 -s data/sensor.csv

# 详细分析报告
python main.py analysis -sim results/simulation_results.h5 -s data/sensor.csv
```

### 8. 性能基准测试

```bash
python main.py benchmark
```

## 配置说明

### simulation（仿真设置）
- `total_time`: 总仿真时间（秒）
- `time_step`: 时间步长（秒）
- `geometry`: 几何参数
  - `thickness`: 坯体厚度（米）
  - `num_nodes`: 空间节点数

### material（材料参数）
- `density`: 密度 (kg/m³)
- `specific_heat`: 比热容 (J/kg·K)
- `thermal_conductivity`: 热导率 (W/m·K)
- `organic_content`: 初始有机物含量
- `water_content`: 初始水分含量

### kiln（窑炉参数）
- `heat_transfer_coeff`: 对流传热系数 (W/m²·K)
- `volume`: 窑炉容积 (m³)

### temperature_profile（温度曲线）
格式: `[[时间1, 温度1], [时间2, 温度2], ...]`
- 时间单位: 秒
- 温度单位: K（开尔文）

### humidity_profile（湿度曲线）
格式: `[[时间1, 绝对湿度1], [时间2, 绝对湿度2], ...]`

## 数据格式

### 仿真结果存储
- 格式: HDF5 (.h5)
- 包含: 时间序列、温度场、湿度数据、气氛参数、物理变化数据

### 传感器数据导入
支持 CSV 格式:
```csv
time,temperature,humidity
0,293.15,50.0
60,300.0,48.0
...
```

## 质量指标

系统自动计算以下质量指标:
- `temperature_uniformity`: 温度均匀性（标准差/均值）
- `heating_smoothness`: 升温平稳性（升温速率标准差）
- `energy_efficiency`: 能效指标（时间×平均温度）
- `drying_time_hours`: 干燥完成时间（小时）
- `final_water_content`: 最终水分含量

## 可视化输出

运行仿真后在 results 目录生成以下图像:
- `temperature.png`: 温度变化曲线
- `temperature_heatmap.png`: 温度分布热力图
- `humidity.png`: 湿度变化曲线
- `atmosphere.png`: 气氛参数变化
- `physical.png`: 物理变化过程

## 命令行参数

```bash
python main.py --help
```

子命令:
- `simulate`: 运行仿真
- `optimize`: 参数优化
- `import`: 导入传感器数据
- `compare`: 对比仿真与实测
- `generate-config`: 生成示例配置
- `generate-sensor`: 生成示例传感器数据

## 技术栈

- **NumPy**: 数组运算与数值计算
- **SciPy**: ODE求解、插值、优化算法
- **Matplotlib**: 数据可视化
- **HDF5 (h5py)**: 仿真结果存储
- **scikit-learn**: 数据预处理

## 许可证

MIT License
