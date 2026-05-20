# 戏曲唱腔数据分析系统

专注于冷门戏曲（祁剧、潮剧等）唱腔数据分析的多模块Python系统。

## 功能模块

1. **音频数据接入模块** - 支持本地文件、戏曲数据库API接入
2. **唱腔特征提取模块** - 基于Librosa实现音调、节奏、音色等特征提取
3. **数据分析模块** - 唱腔风格分类、传承人对比、演变趋势分析
4. **可视化模块** - Dash+Plotly交互式仪表板
5. **用户管理模块** - 用户注册、登录、权限管理
6. **数据库模块** - 存储音频数据、特征数据、分析结果

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
python app.py
```

## 项目结构

```
src/
├── data_access/      # 音频数据接入模块
├── feature_extraction/  # 特征提取模块
├── analysis/         # 数据分析模块
├── visualization/    # 可视化模块
├── user_management/  # 用户管理模块
└── database/         # 数据库模块
data/
├── raw/             # 原始音频数据
├── processed/       # 处理后的数据
└── uploads/         # 用户上传文件
```
