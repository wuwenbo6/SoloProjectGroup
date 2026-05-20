# 点云分析系统 (Point Cloud Analysis System)

一个完整的点云分析解决方案，包含点云导入、缺损识别、厚度分析、安全评估、报表输出和三维渲染功能。

## 功能特性

### 1. 点云导入 (Point Cloud Import)
- 支持多种格式：PLY, PCD, XYZ, PTS, TXT, LAS, LAZ
- 自动计算法向量
- 点云预处理：下采样、离群点移除
- 点云统计信息获取

### 2. 缺损识别 (Defect Detection)
- 多种检测算法：
  - 统计异常检测 (statistical)
  - 距离异常检测 (distance)
  - 曲率异常检测 (curvature)
  - 参考点云对比检测 (reference)
- 缺损聚类与分类
- 缺损参数计算：面积、深度、严重程度
- 支持缺损类型识别：裂缝、凹陷、磨损、缺失

### 3. 厚度分析 (Thickness Analysis)
- 多种厚度计算方法：
  - 法向量投影法 (normal_projection)
  - 对侧搜索法 (opposite_search)
  - 光线投射法 (ray_casting)
  - 网格距离法 (mesh_distance)
- 厚度统计分析：均值、中位数、标准差、分位数
- 厚薄区域识别
- 厚度分布可视化

### 4. 安全评估 (Safety Assessment)
- 多标准综合评估
- 安全等级评定：安全/注意/警告/严重/危险
- 基于厚度的安全评估
- 基于缺损的安全评估
- 自动生成安全建议

### 5. 报表输出 (Report Generation)
- 支持多种格式：
  - Excel 报表 (.xlsx)
  - PDF 报表 (.pdf)
  - JSON 数据 (.json)
- 包含图表和统计数据
- 详细的安全建议清单

### 6. 三维渲染 (3D Visualization)
- 交互式点云可视化
- 缺损着色显示
- 厚度分布着色显示
- 导出3D模型（PLY, PCD格式）
- 生成分析图表

## 安装依赖

```bash
pip install -r requirements.txt
```

依赖包包括：
- numpy
- open3d
- scipy
- scikit-learn
- pandas
- matplotlib
- reportlab
- openpyxl

## 快速开始

### 方式1：运行演示脚本

```bash
python demo.py
```

这将自动生成示例点云并运行完整分析流程。

### 方式2：运行主程序

```bash
# 基本用法
python main.py input.ply

# 带参考点云对比
python main.py input.ply -r reference.ply

# 指定输出目录
python main.py input.ply -o results

# 显示交互式可视化
python main.py input.ply --show-visual

# 指定最小可接受厚度
python main.py input.ply -m 2.0

# 指定检测方法
python main.py input.ply --detection-method curvature
```

## 命令行参数说明

| 参数 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| `input_file` | 输入点云文件路径 | 必填 | PLY, PCD, XYZ等 |
| `-r, --reference` | 参考点云文件路径 | None | |
| `-o, --output` | 输出目录 | output | |
| `-m, --min-thickness` | 最小可接受厚度 | 5.0 | |
| `--detection-method` | 缺损检测方法 | statistical | statistical, distance, curvature, reference |
| `--thickness-method` | 厚度计算方法 | normal_projection | normal_projection, opposite_search, ray_casting, mesh_distance |
| `--show-visual` | 显示可视化窗口 | False | |

## 项目结构

```
p116/
├── src/
│   ├── __init__.py
│   ├── point_cloud_import.py    # 点云导入模块
│   ├── defect_detection.py      # 缺损检测模块
│   ├── thickness_analysis.py    # 厚度分析模块
│   ├── safety_assessment.py     # 安全评估模块
│   ├── report_generator.py      # 报表生成模块
│   └── visualization.py         # 可视化模块
├── main.py                      # 主程序
├── demo.py                      # 演示脚本
├── requirements.txt             # 依赖列表
└── README.md                    # 说明文档
```

## 模块说明

### PointCloudImporter (点云导入)

```python
from src import PointCloudImporter

importer = PointCloudImporter()
success, msg = importer.import_file('input.ply')
pcd = importer.get_point_cloud()
stats = importer.get_statistics()
```

### DefectDetector (缺损检测)

```python
from src import DefectDetector

detector = DefectDetector()
detector.set_point_cloud(pcd)
defects, labels = detector.detect_defects(method='statistical')
summary = detector.get_defect_summary()
```

### ThicknessAnalyzer (厚度分析)

```python
from src import ThicknessAnalyzer

analyzer = ThicknessAnalyzer()
analyzer.set_point_cloud(pcd)
thickness, confidence = analyzer.compute_thickness(method='normal_projection')
stats = analyzer.get_thickness_statistics()
```

### SafetyAssessor (安全评估)

```python
from src import SafetyAssessor

assessor = SafetyAssessor()
assessor.set_defect_data(defect_summary)
assessor.set_thickness_data(thickness_summary)
report = assessor.assess_safety(min_acceptable_thickness=5.0)
```

### ReportGenerator (报表生成)

```python
from src import ReportGenerator

reporter = ReportGenerator(output_dir='reports')
files = reporter.generate_full_report(
    point_cloud_stats=pc_stats,
    defect_summary=defect_summary,
    thickness_summary=thickness_summary,
    safety_report=safety_report
)
```

### PointCloudVisualizer (可视化)

```python
from src import PointCloudVisualizer

visualizer = PointCloudVisualizer()
visualizer.set_point_cloud(pcd)
visualizer.set_defect_labels(labels)
visualizer.set_thickness_values(thickness)
visualizer.visualize_defects()
```

## 输出文件结构

```
output/
├── reports/                    # 报表文件
│   ├── point_cloud_analysis_report_*.xlsx
│   ├── point_cloud_analysis_report_*.pdf
│   └── point_cloud_analysis_report_*.json
└── visualizations/             # 可视化文件
    ├── point_cloud_defects.ply
    ├── point_cloud_thickness.ply
    ├── defect_analysis.png
    └── thickness_analysis.png
```

## 支持的点云格式

- **PLY**: Polygon File Format (ASCII和二进制)
- **PCD**: Point Cloud Data
- **XYZ**: 简单文本格式
- **LAS/LAZ**: LiDAR 格式 (需要 laspy 库)

## 可视化查看

生成的PLY文件可以使用以下工具查看：
- MeshLab: https://www.meshlab.net/
- CloudCompare: https://www.danielgm.net/cc/
- Open3D: Python库直接查看

## 性能说明

| 点数 | 处理时间 | 内存占用 |
|------|----------|----------|
| 1万 | ~1秒 | ~50MB |
| 10万 | ~5秒 | ~200MB |
| 100万 | ~30秒 | ~1GB |

## 常见问题

### Q: 如何处理大型点云？
A: 使用下采样功能减少点数：
```python
importer.downsample(voxel_size=0.05)
```

### Q: 厚度计算结果异常？
A: 尝试不同的计算方法，或确保点云法向量计算正确：
```python
importer.compute_normals(radius=0.1, max_nn=30)
```

### Q: PDF报表生成失败？
A: 确保已安装 reportlab 库：
```bash
pip install reportlab
```

## 许可证

MIT License

## 技术支持

如有问题或建议，请提交 Issue 或联系开发团队。
