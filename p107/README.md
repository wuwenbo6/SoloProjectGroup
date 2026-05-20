# 制墨工艺配比数值模拟系统

基于 NumPy、SciPy 实现的传统制墨工艺配比数值模拟系统，涵盖原料种类、配比比例、烧制温度等关键参数的动态计算。

## 功能特性

- **原料参数采集模块**：支持原料数据导入和管理
- **数值计算模块**：基于 NumPy/SciPy 的高性能数值计算
- **核心配比模拟模块**：制墨工艺核心模拟逻辑
- **结果可视化模块**：基于 Matplotlib 的配比曲线与墨色变化可视化
- **参数优化模块**：自动优化制墨参数
- **数据存储**：HDF5 文件存储仿真结果，JSON 存储配比配置参数

## 模块说明

- `material_collection.py` - 原料参数采集模块
- `numerical_computation.py` - 数值计算模块
- `formula_simulation.py` - 核心配比模拟模块
- `visualization.py` - 结果可视化模块
- `parameter_optimization.py` - 参数优化模块
- `data_storage.py` - 数据存储模块

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

```bash
python main.py
```
