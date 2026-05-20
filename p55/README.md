# 传统陶艺烧制过程数值模拟系统

基于 NumPy、SciPy 和 Matplotlib 实现的传统陶艺烧制过程数值模拟系统，涵盖窑温、湿度、气氛（氧化/还原）、坯体收缩率等关键参数的动态计算。

## 功能特性

### 1. 核心仿真模块 (simulation.py)
- 烧制过程温度曲线生成
- 湿度动态变化模拟
- 氧化/还原气氛下氧气浓度计算
- 坯体收缩率模型（支持瓷器、炻器、陶器）
- 实时状态查询

### 2. 数值计算模块 (numerics.py)
- 热传导求解（有限差分法）
- 热应力计算
- 石英晶型转变模拟
- 玻化程度计算
- 能量消耗分析
- 数据插值与平滑处理

### 3. 参数采集模块 (data_acquisition.py)
- 窑炉传感器数据模拟采集
- 手动参数输入界面
- 传感器噪声模拟
- CSV 数据导入导出

### 4. 结果可视化模块 (visualization.py)
- 温度曲线绘制（含烧制阶段标注）
- 湿度变化曲线
- 氧气浓度曲线（氧化/还原对比）
- 收缩率变化曲线（双轴显示温度）
- 温度-收缩率关系图
- 多参数对比图
- 3D 表面图和热力图

### 5. 参数优化模块 (optimization.py)
- 多目标优化函数（能量、收缩均匀性、时间、稳定性）
- 局部优化（L-BFGS-B）
- 全局优化（差分进化算法）
- 历史数据学习与推荐
- 灵敏度分析
- 参数网格搜索

### 6. 数据存储模块 (storage.py)
- HDF5 格式存储仿真结果（支持压缩）
- JSON 格式存储配置参数
- 结果搜索与元数据查询
- CSV 格式导出
- 数据备份功能
- 统计信息汇总

## 安装依赖

```bash
pip install numpy scipy matplotlib h5py
```

或使用 requirements.txt：

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 运行完整演示

```bash
python main.py demo
```

演示将运行两种典型烧制工艺的仿真（瓷器氧化烧、炻器还原烧），保存结果并生成对比图。

### 2. 运行基础仿真

```bash
# 默认参数仿真并绘图
python main.py simulation --plot

# 自定义参数仿真
python main.py simulation \
    --target-temp 1280 \
    --heating-rate 150 \
    --holding-time 120 \
    --cooling-rate 100 \
    --clay-type porcelain \
    --atmosphere oxidation \
    --plot --save --name my_first_run
```

### 3. 参数优化

```bash
# 局部优化
python main.py optimization --method local --iterations 50

# 全局优化（更彻底但较慢）
python main.py optimization --method global --iterations 30
```

### 4. 结果可视化

```bash
# 可视化所有参数
python main.py visualization --type all

# 从存储加载数据可视化
python main.py visualization --type all --load porcelain_demo

# 仅温度曲线
python main.py visualization --type temperature

# 温度-收缩率关系
python main.py visualization --type shrinkage_temp
```

### 5. 存储管理

```bash
# 列出所有存储的运行
python main.py storage --action list

# 查看统计信息
python main.py storage --action stats

# 导出为CSV
python main.py storage --action export --name porcelain_demo

# 删除运行
python main.py storage --action delete --name run_to_delete
```

## 模块使用示例

### 直接使用仿真模块

```python
from simulation import CeramicFiringSimulation, FiringConfig

# 创建配置
config = FiringConfig(
    target_temp=1280.0,
    heating_rate=150.0,
    holding_time=120.0,
    cooling_rate=100.0,
    clay_type="porcelain",
    atmosphere="oxidation"
)

# 运行仿真
simulation = CeramicFiringSimulation(config)
results = simulation.run_simulation()

# 获取结果
print(f"最终收缩率: {results['shrinkage'][-1]:.2f}%")
print(f"最终温度: {results['temperature'][-1]:.1f}°C")
```

### 使用可视化模块

```python
from visualization import FiringVisualization

visual = FiringVisualization()

# 绘制所有参数
fig, axes = visual.plot_all_parameters(results)
visual.show()

# 保存图表
visual.save("firing_results.png", dpi=150)
```

### 使用存储模块

```python
from storage import StorageManager

storage = StorageManager()

# 保存运行
run_name = storage.save_full_run(config, results, "my_experiment")

# 加载运行
loaded_results = storage.load_full_run("my_experiment")

# 获取统计
stats = storage.get_statistics()
print(f"总运行次数: {stats['total_runs']}")
```

### 使用优化模块

```python
from optimization import FiringOptimizer, FiringObjective

optimizer = FiringOptimizer(base_config)

# 定义优化参数和范围
bounds = {
    'heating_rate': (80.0, 250.0),
    'holding_time': (60.0, 180.0),
    'cooling_rate': (50.0, 150.0),
    'target_temp': (1200.0, 1350.0)
}

# 运行优化
result = optimizer.optimize_global(bounds, max_iter=50)
print(f"最优参数: {result.best_params}")
```

## 烧制工艺说明

### 黏土类型

- **porcelain (瓷器)**: 高温烧成（1250-1400°C），高收缩率（10-15%）
- **stoneware (炻器)**: 中高温烧成（1180-1280°C），中等收缩率（8-12%）
- **earthenware (陶器)**: 低温烧成（950-1150°C），低收缩率（5-8%）

### 气氛类型

- **oxidation (氧化)**: 氧气充足，适合透明釉和亮色釉料
- **reduction (还原)**: 缺氧环境，适合青瓷、天目釉等效果

### 典型烧制阶段

1. **干燥阶段 (室温 - 200°C)**: 排除坯体物理水
2. **氧化阶段 (200°C - 600°C)**: 碳素和有机物燃烧
3. **烧成阶段 (600°C - 1000°C)**: 石英晶型转变、烧结开始
4. **玻化阶段 (1000°C - 最高温)**: 玻璃相形成、致密化
5. **保温阶段**: 均匀受热、化学反应完成
6. **冷却阶段**: 控制降温速度防止热应力开裂

## 项目结构

```
├── __init__.py           # 包初始化
├── simulation.py         # 核心仿真模块
├── numerics.py           # 数值计算模块
├── data_acquisition.py   # 参数采集模块
├── visualization.py      # 结果可视化模块
├── optimization.py       # 参数优化模块
├── storage.py            # 数据存储模块
├── main.py               # 主程序入口
├── requirements.txt      # 依赖列表
└── README.md            # 本文件
```

运行时会自动创建以下目录：
- `configs/` - JSON 配置文件存储
- `exports/` - CSV 导出文件
- `backups/` - 数据备份

## 数据格式

### HDF5 存储结构

```
/run_name/
    time          -> 时间数组 (秒)
    temperature   -> 温度数组 (°C)
    humidity      -> 湿度数组 (%)
    oxygen        -> 氧气浓度数组 (%)
    shrinkage     -> 收缩率数组 (%)
    config/       -> 配置参数组
    attrs:
        saved_at  -> 保存时间戳
```

### JSON 配置格式

```json
{
  "initial_temp": 25.0,
  "target_temp": 1280.0,
  "heating_rate": 150.0,
  "holding_time": 120.0,
  "cooling_rate": 100.0,
  "total_time": 600.0,
  "clay_type": "porcelain",
  "atmosphere": "oxidation"
}
```

## 扩展开发

### 添加新的黏土类型

在 `simulation.py` 的 `shrinkage_model` 方法中添加新的参数：

```python
clay_params = {
    "new_clay": {"alpha": 0.0001, "beta": 0.00003, "T1": 500, "T2": 900},
    ...
}
```

### 添加新的优化目标

在 `optimization.py` 的 `FiringObjective` 类中添加新方法：

```python
@staticmethod
def new_objective(results):
    # 计算自定义目标值
    return value
```

## 注意事项

1. 仿真结果基于理论模型，实际烧制需根据窑炉特性调整
2. 建议先进行小批量试烧验证仿真结果
3. 参数优化需结合实际工艺要求
4. 大型仿真结果可能占用较多磁盘空间

## 许可证

本项目专注于冷门传统陶艺烧制的科学计算场景，无通用仿真模板。
