# 点云分析与安全评估系统

基于 Python 和 Open3D 的点云处理系统，支持磨损区域识别、厚度分析、安全评估和可视化展示。

## 功能特性

### 1. 点云导入 (Point Cloud IO)
- 支持 PLY、PCD、XYZ、XYZN、XYZRGB 等多种格式
- 点云信息获取和格式转换
- 示例点云生成功能

### 2. 预处理 (Preprocessing)
- 异常值移除（统计滤波、半径滤波）
- 点云降采样（体素滤波）
- 法向量估计和定向
- 点云配准（ICP算法）
- 平面拟合

### 3. 磨损区域识别 (Wear Analysis)
- 基于参考点云的距离计算
- 磨损区域聚类识别（DBSCAN）
- 磨损深度、面积、体积计算
- 无参考点云的曲率分析方法
- 磨损热力图生成

### 4. 厚度分析 (Thickness Analysis)
- 到参考平面的距离计算
- 点云间厚度计算（支持法向量方向）
- 厚度统计分析（均值、最小值、最大值、标准差）
- 薄区域检测
- 厚度分布直方图

### 5. 安全评估 (Safety Assessment)
- 厚度安全等级评估
- 磨损风险等级评估
- 综合安全评分
- 剩余寿命估算
- 维护建议生成

### 6. 报表输出 (Reporting)
- PDF格式报告
- Excel格式报告（多工作表）
- JSON格式数据报告
- 包含统计数据和评估结果

### 7. 三维可视化 (Visualization)
- 交互式点云展示
- 磨损热力图可视化
- 厚度分布图
- 磨损区域边界框显示
- 曲面重建可视化
- 批量截图功能

## 项目结构

```
p125/
├── src/
│   ├── __init__.py          # 包初始化
│   ├── io.py                # 点云IO模块
│   ├── preprocessing.py     # 预处理模块
│   ├── wear_analysis.py     # 磨损分析模块
│   ├── thickness_analysis.py # 厚度分析模块
│   ├── safety_assessment.py # 安全评估模块
│   ├── reporting.py         # 报告生成模块
│   └── visualization.py     # 可视化模块
├── main.py                  # 主程序入口
├── example.py               # 示例代码
├── requirements.txt         # 依赖包列表
└── README.md               # 项目说明
```

## 安装

### 环境要求
- Python 3.8+
- 支持 Windows / macOS / Linux

### 安装依赖

```bash
pip install -r requirements.txt
```

依赖包包括：
- open3d==0.18.0
- numpy==1.26.3
- pandas==2.1.4
- scipy==1.11.4
- scikit-learn==1.3.2
- matplotlib==3.8.2
- reportlab==4.0.9
- openpyxl==3.1.2
- pillow==10.2.0

## 使用方法

### 1. 快速开始

直接运行主程序，将使用示例数据执行完整分析流程：

```bash
python main.py
```

### 2. 命令行参数

```bash
# 使用自定义点云文件进行分析
python main.py --measured /path/to/measured.ply --reference /path/to/reference.ply

# 指定组件ID和检测人员
python main.py --component GEAR-001 --inspector "张三"

# 禁用可视化（适用于批处理）
python main.py --no-vis

# 单点云分析模式（无参考点云）
python main.py --single --measured /path/to/pointcloud.ply
```

### 3. 运行示例程序

```bash
python example.py
```

### 4. 自定义使用

```python
from src.io import PointCloudIO
from src.wear_analysis import WearAnalyzer
from src.reporting import ReportGenerator

# 初始化
io = PointCloudIO()
wear_analyzer = WearAnalyzer()
report_gen = ReportGenerator()

# 加载点云
reference_pcd = io.load_point_cloud("reference.ply")
measured_pcd = io.load_point_cloud("measured.ply")

# 磨损分析
wear_regions, distances, wear_mask = wear_analyzer.detect_wear_regions(
    measured_pcd, reference_pcd
)
wear_metrics = wear_analyzer.compute_wear_metrics(
    wear_regions, distances, wear_mask
)

# 生成报告
reports = report_gen.generate_full_report({
    'wear_metrics': wear_metrics,
    # ... 其他分析结果
})
```

## 输出说明

### 报告文件 (reports/)
- `{COMP_ID}_analysis_{timestamp}.pdf` - PDF格式报告
- `{COMP_ID}_analysis_{timestamp}.xlsx` - Excel格式报告（含多个工作表）
- `{COMP_ID}_analysis_{timestamp}.json` - JSON格式原始数据

### 可视化文件 (visualizations/)
- `thickness_histogram.png` - 厚度分布直方图
- `wear_depth_distribution.png` - 磨损深度分布图
- `wear_heatmap.png` - 磨损热力图截图

## 安全等级说明

| 安全等级 | 说明 | 建议措施 |
|---------|------|---------|
| SAFE | 安全 | 正常维护 |
| CAUTION | 注意 | 增加监测频率 |
| WARNING | 警告 | 安排维护计划 |
| CRITICAL | 临界 | 立即安排更换 |
| UNSAFE | 不安全 | 停止使用，立即更换 |

## 常见问题

### Q1: Open3D 可视化窗口无法打开？
A: 确保已安装正确的图形驱动，或者使用 `--no-vis` 参数跳过可视化。

### Q2: 支持哪些点云格式？
A: 支持 PLY、PCD、XYZ、XYZN、XYZRGB、PTS 等格式。

### Q3: 如何调整磨损检测的灵敏度？
A: 修改 `wear_threshold` 参数，例如：
```python
wear_regions, distances, wear_mask = wear_analyzer.detect_wear_regions(
    measured_pcd, reference_pcd, wear_threshold=-0.01  # 更严格
)
```

### Q4: 没有参考点云可以分析吗？
A: 可以，使用单点云分析模式，系统将基于曲率进行磨损检测。

## 技术支持

如有问题或建议，请查看源码文档或提交 Issue。

## 许可证

本项目仅供学习和研究使用。
