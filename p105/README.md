# 漆器干燥过程数值模拟系统

基于 NumPy 和 SciPy 实现的传统漆器干燥过程数值模拟软件，支持多参数动态计算、结果可视化和参数优化。

## 功能特性

- 核心干燥模拟模块：基于传质传热理论的干燥过程数学模型
- 原料参数采集模块：支持多种漆料类型参数配置与导入
- 数值计算模块：使用 SciPy 求解偏微分方程
- 结果可视化模块：Matplotlib 绘制干燥曲线、温度分布等
- 参数优化模块：自动优化干燥温度、湿度等工艺参数
- 数据存储：HDF5 存储仿真结果，JSON 存储配置参数

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

1. 配置干燥参数：编辑 `config/default_config.json`
2. 运行模拟：`python main.py`
3. 查看结果：结果保存在 `results/` 目录

## 项目结构

```
lacquer_drying_sim/
├── config/              # 配置文件目录
├── data/                # 原料数据目录
├── results/             # 仿真结果目录
├── material_params.py   # 原料参数采集模块
├── numerical_solver.py  # 数值计算模块
├── drying_simulation.py # 核心干燥模拟模块
├── visualization.py     # 结果可视化模块
├── optimization.py      # 参数优化模块
└── main.py              # 主程序入口
```
