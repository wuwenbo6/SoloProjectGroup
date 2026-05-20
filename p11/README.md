# 2D 有限元结构力学仿真系统
=====================================

## 项目简介

本项目是一个基于 FEniCS 的二维有限元结构力学仿真框架，支持平面应力和平面应变问题的求解，包括线性弹性和弹塑性材料模型。

## 最新功能 (v2.0)

### ✅ 新增功能

1. **材料非线性仿真** - 支持塑性材料模型（von Mises 屈服准则）
2. **高级后处理分析** - 应力极值点查找、安全系数计算、位移统计、主应力分析
3. **多工况仿真** - 支持用户设置多个荷载工况，批量计算并对比结果
4. **仿真配置导入/导出** - JSON 格式保存与复用仿真参数

## 功能特性

### 核心仿真模块 (core/)

#### 线性仿真
- `Material`: 材料属性定义（弹性模量、泊松比、密度、屈服应力、硬化模量）
- `PlaneStress` / `PlaneStrain`: 二维平面应力/应变问题求解
- 刚度矩阵正则化，防止奇异矩阵错误

#### 非线性仿真
- `NonlinearPlaneStress` / `NonlinearPlaneStrain`: 弹塑性材料仿真
- **von Mises 屈服准则**
- 各向同性硬化模型
- 增量加载 + Newton-Raphson 迭代
- 收敛历史追踪

#### 多工况分析
- `LoadCase`: 荷载工况定义
- `MultiCaseSimulation`: 批量仿真管理器
- 自动结果提取与对比
- 对比报告导出

### 前处理模块 (preprocessing/)

- `MeshGenerator`: 网格生成器
  - 矩形/梁/圆形网格生成
  - 结构化/非结构化网格
  - STL导入与自动修复
  - 重复顶点移除
  - 非流形边检测与修复
  - 网格质量评估

- `BoundaryCondition`: 边界条件
  - 固定约束
  - 指定位移约束

- `Load`: 荷载定义
  - 集中力
  - 均布压力
  - 体积力

### 后处理模块 (postprocessing/)

#### `Visualizer2D`: 可视化工具
- 网格显示
- 位移场显示（含变形放大）
- 应力分量云图
- 应变分量云图
- Von Mises 应力云图
- 变形动画生成（支持降采样加速）
- 汇总图生成

#### `ResultAnalyzer`: 高级结果分析
- **位移场统计**: 最大/平均位移、RMS值
- **应力极值点查找**: 前N个高/低应力点坐标
- **安全系数计算**: 基于屈服应力的安全系数分布
- **主应力计算**: σ₁, σ₂
- **应变能计算**: 总应变能
- **完整分析报告生成**

### 数据存储模块 (io/)

#### `SimulationConfig`: 完整仿真配置
- 问题类型（平面应力/应变、线性/非线性）
- 几何参数与网格设置
- 材料参数（含塑性参数）
- 求解器参数
- 边界条件定义
- 多荷载工况配置
- JSON格式导入/导出
- 配置验证

#### `ResultStorage`: 仿真结果存储
- 网格数据
- 位移场
- 应力场
- 应变场
- 统计数据
- HDF5 格式

## 项目结构

```
p11/
├── core/
│   ├── __init__.py
│   ├── simulation.py        # 线性/非线性仿真核心
│   └── multi_case.py        # 多工况仿真
├── preprocessing/
│   ├── __init__.py
│   ├── meshing.py          # 网格生成与STL导入
│   └── boundary.py         # 边界条件与荷载
├── postprocessing/
│   ├── __init__.py
│   ├── visualization.py    # 可视化与动画
│   └── analysis.py        # 高级后处理分析
├── io/
│   ├── __init__.py
│   └── storage.py         # 配置与结果存储
├── example_advanced_features.py  # 高级功能示例
├── example_beam.py           # 悬臂梁示例
├── example_plate.py          # 受压板示例
├── requirements.txt
├── setup.py
├── README.md              # 本文件
└── BUG_FIXES.md           # 修复记录
```

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
conda install -c conda-forge fenics  # FEniCS 需单独安装
```

### 运行高级功能示例

```bash
python example_advanced_features.py
```

此示例展示：
1. 仿真配置的导入/导出
2. 高级后处理分析（应力极值、安全系数等）
3. 多工况仿真与对比

## 使用示例

### 1. 材料非线性仿真

```python
from core import Material, NonlinearPlaneStress
from preprocessing import MeshGenerator, BoundaryCondition, Load, Boundary

# 生成网格
mesh_gen = MeshGenerator()
mesh = mesh_gen.create_beam_mesh(length=1.0, height=0.2, nx=50, ny=10)

# 定义塑性材料
material = Material(
    E=210e9,
    nu=0.3,
    yield_stress=250e6,    # 屈服应力
    hardening_modulus=1e9    # 硬化模量
)

# 创建非线性仿真
simulation = NonlinearPlaneStress(mesh)
simulation.set_material(material)

# 设置边界条件和荷载...

# 增量求解
u = simulation.solve_incremental(num_load_steps=20)
```

### 2. 高级后处理分析

```python
from postprocessing import ResultAnalyzer

# 创建分析器
analyzer = ResultAnalyzer(simulation)

# 完整分析
results = analyzer.full_analysis(yield_stress=250e6)

# 打印报告
analyzer.print_report()

# 访问具体结果
max_stress = results["stress_extremes"]["max_von_mises"]
min_safety_factor = results["safety_factor"]["min"]
max_displacement = results["displacement_statistics"]["magnitude"]["max"]
```

### 3. 多工况仿真

```python
from core import MultiCaseSimulation, Material

# 创建多工况仿真
multi_case = MultiCaseSimulation(
    mesh=mesh,
    material=material,
    base_bcs=[fixed_bc],  # 公共边界条件
    problem_type="plane_stress"
)

# 添加工况
multi_case.create_load_case(
    name="工况1: 小荷载",
    loads=[load1]
)

multi_case.create_load_case(
    name="工况2: 大荷载",
    loads=[load2]
)

# 运行所有工况
results = multi_case.run_all_cases(nonlinear=False)

# 对比结果
multi_case.compare_cases(metric="max_von_mises")
multi_case.compare_cases(metric="max_displacement")

# 导出报告
multi_case.export_comparison_report("output/report.json")
```

### 4. 仿真配置导入/导出

```python
from io import SimulationConfig

# 创建配置
config = SimulationConfig()

# 设置问题类型
config.set_problem_type("plane_stress", is_nonlinear=True)

# 设置几何与网格
config.set_beam_geometry(length=1.0, height=0.2, nx=50, ny=10)

# 设置材料
config.set_material(
    E=210e9, nu=0.3, rho=7850.0,
    yield_stress=250e6, hardening_modulus=1e9
)

# 设置边界条件
config.add_fixed_boundary(location="left", description="左端固定")

# 添加荷载工况
load = config.create_boundary_load(location="right", value=[0, -1e6])
config.add_load_case(name="工况1", loads=[load], description="右端集中力")

# 保存配置
config.save("output/config.json")

# 加载配置
loaded_config = SimulationConfig.load("output/config.json")
loaded_config.print_summary()
```

## 主要 API 类

### 核心仿真类
| 类 | 功能 |
|-----|------|
| `Material(E, nu, rho, yield_stress, hardening_modulus)` | 材料属性 |
| `PlaneStress(mesh)` | 线性平面应力 |
| `PlaneStrain(mesh)` | 线性平面应变 |
| `NonlinearPlaneStress(mesh)` | 弹塑性平面应力 |
| `NonlinearPlaneStrain(mesh)` | 弹塑性平面应变 |
| `MultiCaseSimulation(...)` | 多工况仿真 |

### 后处理类
| 类 | 功能 |
|-----|------|
| `Visualizer2D(simulation)` | 可视化与动画 |
| `ResultAnalyzer(simulation)` | 结果分析 |

### 配置存储类
| 类 | 功能 |
|-----|------|
| `SimulationConfig()` | 完整仿真配置 |
| `ResultStorage(simulation)` | 结果存储 |

## 技术栈

- **FEniCS (DOLFIN)**: 有限元求解器
- **NumPy/SciPy**: 数值计算
- **Matplotlib**: 可视化
- **H5Py**: HDF5 数据存储
- **MeshIO**: 网格文件读写

## 常见问题

### 1. 刚度矩阵奇异
- 检查边界条件是否完全约束刚体运动
- 启用正则化: `simulation.enable_regularization(True, 1e-8)`

### 2. 非线性收敛问题
- 增加荷载步数: `num_load_steps`
- 减小收敛容差: `nonlinear_tolerance`
- 检查材料参数是否合理

### 3. STL导入失败
- 检查STL是否为二维平面网格
- 启用自动修复: `import_mesh(..., auto_fix=True)`

## 许可证

本项目仅供学习和研究使用。
