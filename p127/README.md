# 点云磨损分析系统

一个完整的点云分析工具，用于检测物体磨损区域、分析厚度分布、评估安全性并生成可视化报告。

## 功能特性

### 1. 点云导入 (Point Cloud Import)
- 支持多种点云格式: .ply, .pcd, .xyz, .pts, .txt
- 点云信息统计（点数、边界、中心位置等）
- 示例点云生成功能（球体、立方体、圆柱体）

### 2. 磨损区域识别 (Wear Detection)
- 基于ICP算法的点云精准配准
- 点云距离计算与比较
- 法向量方向的磨损检测
- 磨损区域统计（点数、比例、最大深度等）

### 3. 厚度分析 (Thickness Analysis)
- 基于法向量射线追踪的厚度计算
- 厚度分布统计（平均值、中位数、标准差等）
- 厚度直方图生成
- 磨损区域聚类分析

### 4. 安全评估 (Safety Evaluation)
- 多等级安全评估（安全/警告/危险/严重）
- 基于标称厚度的相对厚度计算
- 综合评分系统
- 智能建议生成
- 剩余寿命预估

### 5. 报表输出 (Report Generation)
- HTML格式报告（美观的可视化界面）
- JSON格式报告（便于数据集成）
- 包含统计图表和风险评估

### 6. 三维可视化 (3D Visualization)
- 点云3D可视化
- 磨损区域高亮显示
- 厚度分布彩色映射
- 风险区域分类显示
- 配准结果对比显示

## 项目结构

```
p127/
├── pointcloud_analysis/
│   ├── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── importer.py           # 点云导入模块
│   │   ├── wear_detection.py     # 磨损检测模块
│   │   ├── thickness_analysis.py # 厚度分析模块
│   │   └── safety_evaluation.py  # 安全评估模块
│   ├── visualization/
│   │   ├── __init__.py
│   │   └── visualizer.py         # 3D可视化模块
│   ├── reports/
│   │   ├── __init__.py
│   │   └── report_generator.py   # 报告生成模块
│   └── utils/
│       ├── __init__.py
│       └── helpers.py            # 工具函数
├── main.py                        # 主程序入口
├── requirements.txt               # 依赖包列表
└── README.md                      # 项目说明
```

## 安装依赖

```bash
pip install -r requirements.txt
```

主要依赖:
- numpy: 数值计算
- open3d: 点云处理
- scipy: 科学计算
- scikit-learn: 机器学习算法
- matplotlib: 数据可视化
- pandas: 数据处理
- jinja2: 模板引擎

## 使用方法

### 1. 演示模式

直接运行演示程序，使用自动生成的示例点云:

```bash
python main.py --demo
```

演示流程:
1. 生成球体形参考点云
2. 模拟磨损区域
3. 点云配准
4. 磨损检测
5. 厚度分析
6. 安全评估
7. 生成报告
8. 3D可视化

### 2. 实际点云分析

分析自己的点云文件:

```bash
python main.py --reference <参考点云路径> --test <测试点云路径>
```

示例:
```bash
python main.py --reference data/reference.ply --test data/worn.ply
```

## 模块使用示例

### 点云导入

```python
from pointcloud_analysis import PointCloudImporter

importer = PointCloudImporter()

# 加载点云文件
point_cloud = importer.load("example.ply")

# 获取点云信息
info = importer.get_info()
print(f"点数: {info['num_points']}")

# 生成示例点云
sample_cloud = importer.generate_sample(num_points=10000, shape='sphere')
```

### 磨损检测

```python
from pointcloud_analysis import WearDetector

detector = WearDetector(reference_cloud, test_cloud)

# 点云配准
transform = detector.register_point_clouds()

# 检测磨损
wear_values, wear_mask = detector.detect_wear(threshold=0.005)

# 获取统计信息
stats = detector.get_wear_statistics()
print(f"磨损比例: {stats['wear_percentage']:.2f}%")
```

### 厚度分析

```python
from pointcloud_analysis import ThicknessAnalyzer

analyzer = ThicknessAnalyzer(point_cloud)

# 计算厚度
thickness_values = analyzer.compute_thickness_by_normal(max_distance=0.2)

# 获取统计
stats = analyzer.get_thickness_statistics()
print(f"平均厚度: {stats['mean_thickness']:.4f}m")

# 聚类磨损区域
clusters, cluster_mask = analyzer.cluster_worn_areas(threshold=0.005)
```

### 安全评估

```python
from pointcloud_analysis import SafetyEvaluator

evaluator = SafetyEvaluator(nominal_thickness=0.05)

# 综合评估
result = evaluator.comprehensive_evaluation(
    thickness_values, wear_values, wear_mask
)

print(f"安全等级: {result['overall_safety_level'].value}")
print(f"评分: {result['overall_score'] * 100:.1f}")

# 获取建议
for recommendation in result['final_recommendations']:
    print(recommendation)
```

### 报告生成

```python
from pointcloud_analysis import ReportGenerator

generator = ReportGenerator(output_dir="reports")

# 生成HTML报告
html_path = generator.generate_html_report(analysis_results, point_cloud_info)

# 生成JSON报告
json_path = generator.generate_json_report(analysis_results, point_cloud_info)
```

### 3D可视化

```python
from pointcloud_analysis import Visualizer3D

visualizer = Visualizer3D()

# 可视化磨损区域
visualizer.visualize_wear_regions(
    reference_cloud, test_cloud, wear_mask,
    title="磨损区域检测结果"
)

# 可视化厚度分布
visualizer.visualize_thickness(
    point_cloud, thickness_values,
    title="厚度分布"
)

# 生成厚度直方图
visualizer.create_thickness_histogram(thickness_values, save=True)
```

## 输出目录

运行程序后会自动生成以下目录:
- `reports/`: 存放分析报告（HTML, JSON）
- `visualizations/`: 存放可视化图片（PNG）

## 报告内容

HTML报告包含:
1. 总体评估结果（安全等级、评分）
2. 点云基本信息
3. 厚度评估统计
4. 各风险区域比例
5. 磨损评估指标
6. 维护建议措施

## 技术细节

### 点云配准算法
使用基于ICP (Iterative Closest Point) 的点到平面配准算法，通过最小化点到平面的距离实现精准配准。

### 磨损检测原理
1. 计算测试点云到参考点云的最近邻距离
2. 使用法向量确定距离方向
3. 应用阈值区分磨损区域

### 厚度计算方法
基于法向量的射线追踪法，沿每个点的法向量方向发射射线，寻找对面的交点，两点距离即为厚度。

## 注意事项

1. 点云单位建议统一为米(m)
2. 确保参考点云和测试点云的坐标系统一致
3. 对于大型点云，建议先进行下采样以提高计算效率
4. 磨损阈值需要根据具体应用场景调整

## 许可证

本项目仅供学习和研究使用。

## 联系方式

如有问题或建议，欢迎反馈。
