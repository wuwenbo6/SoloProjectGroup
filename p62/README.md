# 戏曲唱腔特征分析系统

基于 Python 的多模块戏曲唱腔特征分析系统，支持祁剧、潮剧等小众戏曲的音频处理、特征提取、风格分类与交互式可视化。

## 功能特性

### 1. 音频数据接入模块 (Audio)
- 支持多种音频格式：WAV、MP3、FLAC、OGG、M4A
- 自动识别戏曲类型（祁剧、潮剧、京剧等）
- 从文件名提取传承人信息与年代信息
- 支持批量目录加载
- 内置示例数据生成功能

### 2. 唱腔特征提取模块 (Features)
- **音调特征**：基频均值、标准差、范围、颤音速率与深度
- **节奏特征**：速度、节拍强度、 onset 速率、节奏复杂度
- **音色特征**：20维 MFCC 系数、频谱质心、带宽、滚降点、过零率
- **能量特征**：能量均值、标准差、范围、能量曲线

### 3. 数据分析模块 (Analysis)
- **唱腔风格分类**：K-Means 聚类 + 随机森林分类器
- **传承人对比**：欧氏距离、余弦相似度、曼哈顿距离、T检验
- **演变趋势分析**：时间序列回归、年代均值对比
- **特征重要性分析**：基于分类器的特征权重排序
- **唱腔相似度矩阵**：基于特征的样本相似度计算

### 4. 可视化仪表板 (Visualization)
基于 Dash 的交互式 Web 仪表板，包含6个功能标签页：

| 标签页 | 功能描述 | 图表类型 |
|--------|----------|----------|
| 数据概览 | 数据集统计、特征分布、数据表格 | 直方图、箱线图 |
| 特征热力图 | 特征相关性矩阵、剧种特征均值对比 | 热力图 |
| 节奏曲线分析 | 节奏包络、音高轮廓、能量曲线、节拍标记 | 折线图、散点图 |
| 风格分类 | PCA降维可视化、聚类统计、特征重要性 | 散点图、条形图 |
| 传承人对比 | 雷达图对比、特征差异百分比、相似度指标 | 雷达图、条形图 |
| 演变趋势分析 | 时间序列趋势、年代热力图 | 散点图+趋势线、热力图 |

## 项目结构

```
p62/
├── src/
│   ├── audio/
│   │   ├── __init__.py
│   │   └── audio_loader.py      # 音频加载模块
│   ├── features/
│   │   ├── __init__.py
│   │   └── feature_extractor.py # 特征提取模块
│   ├── analysis/
│   │   ├── __init__.py
│   │   └── analyzer.py          # 数据分析模块
│   └── visualization/
│       ├── __init__.py
│       └── app.py               # Dash 可视化仪表板
├── data/
│   ├── raw/                      # 原始音频数据
│   ├── processed/                # 处理后的特征数据
│   └── examples/                 # 示例数据
├── config.yaml                   # 配置文件
├── requirements.txt              # 依赖包列表
├── main.py                       # 主入口文件
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行系统

#### 使用示例数据运行仪表板：
```bash
python main.py
```

#### 从指定目录加载音频数据：
```bash
python main.py --data-dir ./data/raw
```

#### 仅处理数据并保存特征：
```bash
python main.py --process-only
```

#### 指定端口运行仪表板：
```bash
python main.py --port 8080
```

### 3. 访问仪表板

启动后，在浏览器中访问：
```
http://localhost:8050
```

## 模块使用示例

### 音频加载
```python
from src.audio import AudioLoader

loader = AudioLoader()

# 加载目录中的所有音频文件
audio_data = loader.load_directory('./data/raw')

# 按剧种筛选
qi_opera = loader.get_audio_by_opera('祁剧')

# 获取可用剧种列表
opera_types = loader.get_opera_types()
```

### 特征提取
```python
from src.features import FeatureExtractor

extractor = FeatureExtractor()

# 批量提取特征
features_df = extractor.extract_features_batch(audio_data)

# 特征归一化
normalized_df = extractor.normalize_features(features_df)

# 获取特征矩阵
X = extractor.get_feature_matrix(features_df)
```

### 唱腔分析
```python
from src.analysis import VocalAnalyzer

analyzer = VocalAnalyzer()

# 风格分类
classification = analyzer.classify_opera_style(features_df)

# 传承人对比
comparison = analyzer.compare_inheritors(features_df, '张三', '李四')

# 趋势分析
trend = analyzer.analyze_temporal_trend(features_df)
```

### 可视化仪表板
```python
from src.visualization import DashVisualizer

dashboard = DashVisualizer(features_df)
dashboard.run(port=8050)
```

## 音频文件命名规范

为了自动识别戏曲类型、传承人和年代，建议采用以下命名格式：

```
{剧种}_{传承人}_{年份}_{唯一标识}.wav
```

示例：
- `祁剧_张三_1990_001.wav`
- `潮剧_李四_2005_sample.wav`

## 配置文件说明

`config.yaml` 包含系统的主要配置参数：

```yaml
audio:
  sample_rate: 22050      # 采样率
  hop_length: 512         # 帧移

features:
  pitch: true             # 是否提取音调特征
  rhythm: true            # 是否提取节奏特征
  timbre: true            # 是否提取音色特征
  mfcc_coeffs: 20         # MFCC 系数数量

visualization:
  port: 8050              # Dash 服务端口
  debug: true             # 调试模式
```

## 技术栈

| 组件 | 技术/库 | 用途 |
|------|---------|------|
| 音频处理 | librosa, soundfile | 音频加载、特征提取 |
| 数据处理 | numpy, pandas | 数值计算、数据结构化 |
| 机器学习 | scikit-learn | 聚类、分类、降维 |
| 统计分析 | scipy | 统计检验、信号处理 |
| 可视化 | Dash, Plotly | 交互式 Web 仪表板 |
| 配置管理 | PyYAML | 配置文件解析 |

## 支持的戏曲类型

- 祁剧
- 潮剧
- 京剧
- 豫剧
- 越剧
- 黄梅戏
- 昆曲
- 粤剧

可在 `audio_loader.py` 中扩展支持更多戏曲类型。

## 输出说明

处理完成后，特征数据将保存为 CSV 格式：
- 位置：`data/processed/features.csv`
- 编码：UTF-8 with BOM (Excel 兼容)
- 内容：所有提取的数值特征 + 元数据（文件名、剧种、传承人、年份）

## 常见问题

**Q: 如何添加自定义的戏曲类型？**

A: 在 `audio_loader.py` 的 `OPERA_TYPES` 列表中添加新类型即可。

**Q: 支持哪些音频格式？**

A: 支持 WAV、MP3、FLAC、OGG、M4A 格式。如需扩展，可在 `SUPPORTED_FORMATS` 列表中添加。

**Q: 如何处理大文件？**

A: 系统采用流式处理方式，逐个文件加载并提取特征，避免一次性加载所有数据到内存。

**Q: 可以在服务器上部署吗？**

A: 可以使用 gunicorn 部署 Dash 应用：
```bash
gunicorn --workers 4 --bind 0.0.0.0:8050 src.visualization.app:server
```

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue。
