# 数据分析平台

一个功能完整的多模块数据分析平台，支持多源数据接入、数据清洗、关联分析和交互式可视化。

## 功能特性

### 1. 数据接入模块
- 支持多种数据源：
  - CSV文件
  - JSON文件
  - MySQL数据库
  - PostgreSQL数据库
  - API接口
- 自动解析异构数据格式
- 数据预览和信息统计

### 2. 数据清洗模块
- 缺失值处理：
  - 删除含缺失值行
  - 均值/中位数/众数填充
  - 前向/后向填充
  - 指定值填充
- 异常值检测与处理：
  - IQR方法
  - Z-score方法
  - 盖帽法/删除/均值替换
- 数据类型转换
- 文本标准化
- 重复数据去除
- 特征缩放（标准化/归一化）

### 3. 关联分析模块
- 相关性分析：
  - Pearson相关系数
  - Spearman相关系数
  - Kendall相关系数
  - 高相关性变量对识别
- 聚类分析：
  - K-Means聚类
  - 层次聚类
  - DBSCAN聚类
- PCA降维分析
- 相关性网络构建
- 简单因果推断

### 4. 可视化模块
- 基于 Dash + Plotly 的交互式仪表板
- 多种图表类型：
  - 散点图
  - 直方图
  - 箱线图
  - 折线图
  - 条形图
  - 相关性热力图
  - 聚类可视化
- 交互式筛选控件

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 启动 Web 仪表板

```bash
python app.py
```

然后在浏览器中访问：http://localhost:8050

### 2. 运行示例脚本

```bash
python example.py
```

### 3. 代码调用示例

```python
import pandas as pd
from data_access import DataConnector
from data_cleaning import DataCleaner
from correlation_analysis import CorrelationAnalyzer

# 数据接入
connector = DataConnector()
df = connector.load_csv("data.csv")

# 数据清洗
cleaner = DataCleaner(df)
cleaner.handle_missing_values(strategy="fill_mean")
cleaner.handle_outliers(method="cap")
cleaned_df = cleaner.get_cleaned_data()

# 关联分析
analyzer = CorrelationAnalyzer(cleaned_df)
corr_matrix = analyzer.compute_correlation_matrix()
high_corr = analyzer.get_high_correlations(threshold=0.7)
cluster_result = analyzer.kmeans_clustering(n_clusters=3)
```

## 项目结构

```
p14/
├── __init__.py                    # 包初始化文件
├── requirements.txt               # 依赖列表
├── app.py                         # 主应用入口
├── example.py                     # 示例脚本
├── README.md                      # 项目说明
├── data_access/                   # 数据接入模块
│   ├── __init__.py
│   └── connector.py
├── data_cleaning/                 # 数据清洗模块
│   ├── __init__.py
│   └── cleaner.py
├── correlation_analysis/          # 关联分析模块
│   ├── __init__.py
│   └── analyzer.py
└── visualization/                 # 可视化模块
    ├── __init__.py
    └── dashboard.py
```

## 技术栈

- **数据处理**: Pandas, NumPy
- **机器学习**: Scikit-learn, SciPy
- **可视化**: Dash, Plotly
- **数据库**: MySQL Connector, Psycopg2
- **网络请求**: Requests

## 注意事项

1. 使用数据库接入功能时，需要确保已安装对应的数据库驱动并配置正确的连接参数
2. API接入时需要确保网络连接正常且API可访问
3. 大数据集的聚类分析可能需要较长计算时间
4. Web仪表板默认使用8050端口，如需更改请修改app.py中的port参数
