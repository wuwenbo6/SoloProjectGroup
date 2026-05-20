# 刺绣针法张力模拟系统

基于 NumPy、SciPy 的传统刺绣针法张力数值模拟系统，支持丝线种类、针法类型、张力大小等关键参数的动态计算与优化。

## 功能特性

- **核心张力模拟**：支持多种针法和丝线类型的张力动态模拟
- **针法参数采集**：参数配置、验证、导入导出
- **数值计算**：统计分析、信号处理、拟合插值
- **结果可视化**：张力曲线、分布图、FFT频谱、对比图
- **参数优化**：多种优化算法、灵敏度分析、多目标优化
- **数据存储**：HDF5 存储仿真结果、JSON 存储配置

## 项目结构

```
p103/
├── src/
│   ├── __init__.py
│   ├── tension_simulator.py      # 核心张力模拟
│   ├── stitch_acquisition.py     # 针法参数采集
│   ├── numerical_computation.py  # 数值计算
│   ├── visualization.py          # 结果可视化
│   ├── parameter_optimization.py # 参数优化
│   └── data_storage.py           # 数据存储
├── main.py                        # 主程序入口
├── requirements.txt               # 依赖包
├── data/                          # 数据目录
│   ├── simulation_results.h5
│   └── configs/
└── output/                        # 输出目录（图表）
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 基础张力模拟

```bash
python main.py simulate --stitch-type fill --base-tension 1.0 --stitch-count 100
```

### 2. 参数优化

```bash
python main.py optimize --target-tension 1.5 --optim-method differential_evolution
```

### 3. 不同针法对比

```bash
python main.py compare --base-tension 1.0
```

### 4. 灵敏度分析

```bash
python main.py sensitivity
```

### 5. 查看保存的数据集

```bash
python main.py list
```

### 6. 创建配置模板

```bash
python main.py template --output my_config.json
```

## 模块说明

### 1. 张力模拟 (tension_simulator.py)

- **StitchType**：针法类型枚举（satin/chain/fill/outline）
- **SilkThread**：丝线属性类（直径、杨氏模量、密度、断裂张力）
- **TensionSimulator**：模拟器主类

主要方法：
- `simulate_stitch_tension()`：单针法张力模拟
- `simulate_multi_needle_tension()`：多针张力模拟
- `calculate_tension_metrics()`：计算张力统计指标
- `check_tension_safety()`：安全性检查

### 2. 参数采集 (stitch_acquisition.py)

- **StitchParameters**：参数类
- **StitchAcquisition**：参数管理类

主要功能：
- JSON 配置文件读写
- 参数验证
- 参数范围生成
- 实验数据导入导出

### 3. 数值计算 (numerical_computation.py)

- **NumericalComputation**：数值计算类

主要功能：
- 基础统计分析
- 导数/积分计算
- 移动平均、滤波
- FFT 频谱分析
- 峰值检测
- 插值
- 相关分析
- 异常值检测
- 分布拟合

### 4. 可视化 (visualization.py)

- **Visualization**：可视化类

支持的图表类型：
- 张力时间序列图
- 多针张力对比图
- 张力分布图（直方图+箱线图）
- FFT 频谱图
- 滚动统计图表
- 参数扫描图
- 针法类型对比图
- 自相关图
- PSD 功率谱密度图
- 综合仪表盘

### 5. 参数优化 (parameter_optimization.py)

- **ParameterOptimization**：参数优化类

支持的优化算法：
- 网格搜索 (Grid Search)
- 梯度下降 (Gradient-based)
- 差分进化 (Differential Evolution)
- 随机搜索 (Random Search)
- 盆地跳跃 (Basin Hopping)

额外功能：
- 灵敏度分析
- Pareto 优化
- 多目标加权优化
- 优化结果验证

### 6. 数据存储 (data_storage.py)

- **DataStorage**：数据存储类

主要功能：
- HDF5 格式仿真结果存储
- JSON 格式配置存储
- 批量结果存储
- CSV 导出
- 数据备份
- 存储优化

## 支持的针法类型

| 针法 | 说明 | 张力系数 |
|------|------|----------|
| satin | 缎纹针 | 1.2 |
| chain | 链形针 | 0.8 |
| fill | 填充针 | 1.0 |
| outline | 轮廓针 | 1.5 |

## 支持的丝线类型

| 丝线 | 直径 | 杨氏模量 | 断裂张力 |
|------|------|----------|----------|
| silk_120D | 0.12 mm | 10 GPa | 5.0 N |
| silk_240D | 0.24 mm | 9.5 GPa | 8.0 N |
| cotton_30s | 0.18 mm | 5 GPa | 3.5 N |

## API 使用示例

```python
from src import TensionSimulator, Visualization, DataStorage

# 创建模拟器
simulator = TensionSimulator(sample_rate=100)

# 运行模拟
time, tension = simulator.simulate_stitch_tension(
    stitch_type='fill',
    thread_type='silk_120D',
    base_tension=1.0,
    stitch_count=100
)

# 可视化
viz = Visualization()
viz.plot_tension_time_series(time, tension)

# 保存结果
storage = DataStorage()
storage.save_simulation_result(time, tension, {
    'stitch_type': 'fill',
    'thread_type': 'silk_120D'
})
```

## 许可证

MIT License
