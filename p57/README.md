# 🎭 传统皮影戏材质分析系统

专注于冷门传统皮影戏材质研究的多模块Python分析系统，支持材质数据接入、特征提取、数据分析和交互式可视化。

## ✨ 系统特性

### 📊 数据接入模块
- **本地文件接入**: 支持CSV、Excel、JSON格式
- **皮影戏博物馆API**: 集成传统皮影戏博物馆数据接口
- **数据标准化**: 自动处理中文列名和日期格式

### 🧮 材质特征提取模块
- **物理特征**: 厚度、抗张强度、强度/厚度比
- **化学特征**: 胶原蛋白比例、含水量分类
- **老化特征**: 年龄分类、老化指数、存储因子
- **颜料特征**: 颜色空间(L*a*b*)、色饱和度、褪色敏感度

### 📈 数据分析模块
- **材质特性分析**: 按材质类型统计、ANOVA对比、聚类分析
- **老化趋势预测**: 随机森林回归模型、特征重要性分析、未来老化预测
- **颜料褪色分析**: 线性回归模型、褪色速率对比、颜色变化模拟

### 🎨 可视化模块 (Dash + Plotly)
- **数据概览**: 统计卡片、材质分布饼图、特性雷达图
- **材质热力图**: 成分热力图、相关性矩阵
- **老化趋势**: 趋势曲线、特征重要性条形图
- **颜料褪色**: 褪色对比图、颜色空间3D分布图、褪色模拟
- **数据管理**: API数据加载、本地上传、数据表格展示

### 👥 用户管理模块
- 用户注册与认证
- 密码哈希存储
- 文件上传管理

## 🗂️ 项目结构

```
shadow-puppet-analysis/
├── app.py                          # 主应用入口
├── config.py                       # 配置文件
├── requirements.txt                # 依赖包列表
├── .env.example                    # 环境变量示例
├── data_access/                    # 数据接入模块
│   ├── __init__.py
│   └── data_loader.py
├── feature_extraction/             # 特征提取模块
│   ├── __init__.py
│   └── feature_extractor.py
├── analysis/                       # 数据分析模块
│   ├── __init__.py
│   └── material_analyzer.py
├── visualization/                  # 可视化模块
│   ├── __init__.py
│   └── dashboard.py
├── user_management/                # 用户管理模块
│   ├── __init__.py
│   └── user_manager.py
├── database/                       # 数据库模块
│   ├── __init__.py
│   └── models.py
├── data/                           # 数据目录
│   └── uploads/                    # 用户上传文件
└── static/                         # 静态资源
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和API信息
```

### 3. 运行系统

```bash
python app.py
```

### 4. 访问仪表板

打开浏览器访问: http://localhost:8050

## 📦 主要依赖

- **pandas**: 数据处理与分析
- **numpy**: 数值计算
- **scikit-learn**: 机器学习模型
- **dash**: 交互式Web应用框架
- **plotly**: 可视化图表库
- **sqlalchemy**: ORM数据库操作
- **requests**: HTTP客户端
- **openpyxl**: Excel文件处理

## 🎯 核心功能示例

### 材质数据加载
```python
from data_access.data_loader import DataManager

data_manager = DataManager()

# 从博物馆API加载数据
df = data_manager.load_from_museum(material_type='牛皮')

# 从本地文件加载
df = data_manager.load_from_file('path/to/materials.csv')

# 保存到数据库
data_manager.save_to_database(df)
```

### 材质特征提取
```python
from feature_extraction.feature_extractor import MaterialFeatureExtractor

extractor = MaterialFeatureExtractor()

# 提取所有特征
features = extractor.extract_all_features(df)

# 保存特征到数据库
extractor.save_features_to_database(features, material_ids=[1, 2, 3])
```

### 数据分析
```python
from analysis.material_analyzer import AnalysisManager

analyzer = AnalysisManager()

# 运行完整分析
results = analyzer.run_full_analysis(material_df, pigment_df)

# 保存分析结果
result_id = analyzer.save_analysis_result('aging_analysis', results)
```

### 启动仪表板
```python
from visualization.dashboard import ShadowPuppetDashboard

dashboard = ShadowPuppetDashboard()
dashboard.run_server(debug=True, port=8050)
```

## 📊 可视化图表说明

### 数据概览标签页
- **统计卡片**: 显示样本总数、材质类型数量、平均厚度、平均抗张强度
- **材质分布饼图**: 展示不同材质类型的占比
- **特性雷达图**: 对比各材质的物理化学特性

### 材质热力图标签页
- **成分热力图**: 按材质类型和来源展示各项指标的分布
- **相关性矩阵**: 展示材质各属性间的相关关系

### 老化趋势标签页
- **老化趋势曲线**: 预测未来N年材质性能变化趋势
- **特征重要性图**: 展示影响老化的关键因素

### 颜料褪色标签页
- **褪色对比图**: 对比不同颜料的褪色速率
- **颜色空间3D图**: 在L*a*b*颜色空间展示颜料分布
- **褪色模拟**: 模拟光照下颜色随时间的变化

## 🔧 配置说明

在 `config.py` 中可以配置:

- `DATABASE_URI`: 数据库连接地址
- `MUSEUM_API_URL`: 皮影戏博物馆API地址
- `MUSEUM_API_KEY`: API访问密钥
- `UPLOAD_FOLDER`: 文件上传目录
- `VISUALIZATION_THEME`: 可视化主题配色

## 🎨 主题设计

系统采用深色主题设计，配色方案:
- 主色调: #e94560 (复古红)
- 背景色: #0f0f23 (深蓝黑)
- 卡片色: #16213e (深蓝)
- 强调色: #4ade80 (绿色)、#4a90d9 (蓝色)、#f59e0b (琥珀色)

## 📝 开发说明

### 添加新的可视化图表
1. 在 `visualization/dashboard.py` 中添加图表生成方法
2. 在标签页布局中添加对应的 `dcc.Graph` 组件
3. 在回调函数中更新图表数据

### 添加新的分析模型
1. 在 `analysis/material_analyzer.py` 中添加新的分析类
2. 实现训练和预测方法
3. 在 `AnalysisManager` 中集成新功能

### 扩展数据接入
1. 在 `data_access/data_loader.py` 中添加新的数据加载器
2. 实现对应的数据标准化逻辑
3. 在 `DataManager` 中添加访问接口

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License

## 🙏 致谢

感谢所有为传统皮影戏保护和研究做出贡献的人们！
