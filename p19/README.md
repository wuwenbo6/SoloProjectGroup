# 方言语料标注平台

一个前后端分离的全栈方言语料标注系统，专注于冷门乡土方言语料的整理和标注工作。

## 项目结构

```
p19/
├── backend/                 # 后端 FastAPI 应用
│   ├── app/
│   │   ├── api/            # API 路由
│   │   │   ├── annotations.py
│   │   │   ├── audio.py
│   │   │   ├── dialects.py
│   │   │   ├── tasks.py
│   │   │   └── users.py
│   │   ├── core/           # 核心配置
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/         # 数据库模型
│   │   │   └── __init__.py
│   │   ├── schemas/        # Pydantic 数据模型
│   │   │   └── __init__.py
│   │   ├── services/       # 业务逻辑服务
│   │   │   └── clustering_service.py
│   │   └── utils/          # 工具函数
│   │       └── audio_utils.py
│   ├── requirements.txt     # Python 依赖
│   └── .env                # 环境变量
└── frontend/               # 前端 Svelte 应用
    ├── src/
    │   ├── components/     # 通用组件
    │   │   └── Navbar.svelte
    │   ├── routes/         # 页面组件
    │   │   ├── Login.svelte
    │   │   ├── Dashboard.svelte
    │   │   ├── Annotation.svelte
    │   │   ├── AudioList.svelte
    │   │   └── Tasks.svelte
    │   ├── lib/            # 工具库
    │   │   ├── api.js
    │   │   └── store.js
    │   ├── App.svelte
    │   └── main.js
    ├── static/             # 静态资源
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 功能特性

### 后端功能

1. **用户分级管理**
   - 多角色系统：管理员、审核员、标注员
   - JWT 认证
   - 用户注册登录

2. **语音文件管理**
   - 语音文件分片上传
   - 音频格式自动识别
   - 语音文件流式播放
   - 语音分片截取

3. **标注任务管理**
   - 任务创建与分配
   - 按地区分配任务
   - 任务领取与释放
   - 标注进度实时统计

4. **方言智能聚类**
   - 基于 MFCC 特征提取
   - K-Means / DBSCAN 聚类算法
   - 方言相似度计算
   - 自动方言分类

### 前端功能

1. **登录注册页面**
   - 用户身份认证
   - 角色选择

2. **数据仪表盘**
   - 标注进度统计
   - 任务状态概览
   - 快捷操作入口

3. **标注工作台**
   - 语音播放控制
   - 播放进度条
   - 方言文本转写
   - 音标标注
   - 保存草稿 / 提交审核

4. **语音试听页面**
   - 语音文件列表
   - 状态筛选
   - 地区筛选
   - 上传新语音

5. **任务中心**
   - 可领取任务列表
   - 我的任务管理
   - 任务优先级显示

## 技术栈

### 后端

- **框架**: FastAPI 0.104
- **数据库**: SQLite + SQLAlchemy 2.0
- **认证**: JWT (python-jose)
- **音频处理**: librosa, soundfile, pydub
- **机器学习**: scikit-learn, numpy, scipy

### 前端

- **框架**: Svelte 4
- **路由**: svelte-routing
- **构建工具**: Vite 5

## 快速开始

### 后端启动

1. 进入后端目录并创建虚拟环境：

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 启动服务：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端 API 文档地址：http://localhost:8000/docs

### 前端启动

1. 进入前端目录：

```bash
cd frontend
```

2. 安装依赖：

```bash
npm install
```

3. 启动开发服务器：

```bash
npm run dev
```

前端访问地址：http://localhost:5173

## 数据库模型

- **User**: 用户表，存储用户信息和角色
- **DialectCategory**: 方言分类表
- **AudioSample**: 语音样本表
- **Annotation**: 标注记录表
- **AnnotationTask**: 标注任务表
- **FeatureCluster**: 特征聚类表

## API 端点

### 用户相关
- `POST /api/v1/users/register` - 用户注册
- `POST /api/v1/users/login` - 用户登录
- `GET /api/v1/users/me` - 获取当前用户信息

### 语音相关
- `POST /api/v1/audio/upload` - 上传语音文件
- `GET /api/v1/audio` - 获取语音列表
- `GET /api/v1/audio/{id}` - 获取语音详情
- `GET /api/v1/audio/{id}/stream` - 流式播放语音
- `POST /api/v1/audio/segment` - 截取语音片段

### 标注相关
- `POST /api/v1/annotations` - 创建标注
- `GET /api/v1/annotations` - 获取标注列表
- `POST /api/v1/annotations/{id}/submit` - 提交标注
- `POST /api/v1/annotations/{id}/review` - 审核标注

### 任务相关
- `GET /api/v1/tasks` - 获取任务列表
- `GET /api/v1/tasks/available` - 获取可领取任务
- `POST /api/v1/tasks/claim` - 领取任务
- `POST /api/v1/tasks/release` - 释放任务
- `POST /api/v1/tasks` - 创建任务（管理员）

### 方言聚类相关
- `POST /api/v1/dialects/clusters/kmeans` - 执行 K-Means 聚类
- `POST /api/v1/dialects/clusters/dbscan` - 执行 DBSCAN 聚类
- `GET /api/v1/dialects/similar/{sample_id}` - 查找相似语音

## 特色说明

本项目专注于冷门乡土方言语料的整理工作，避开了常见 Web 项目场景，主要特色：

1. **专业领域定位**：专注方言保护与语料整理这一细分领域
2. **音频处理核心**：以音频处理、语音特征提取为核心技术
3. **机器学习赋能**：利用聚类算法辅助方言分类工作
4. **协作式标注**：支持多人协作、分区域领取任务的工作模式
5. **全链路覆盖**：从实地采集上传、分段截取、人工标注到智能归类的完整流程

## 开发说明

### 添加新的 API 端点

在 `backend/app/api/` 目录下添加新的路由文件，然后在 `main.py` 中注册。

### 添加新页面

在 `frontend/src/routes/` 目录下添加 Svelte 组件，然后在 `App.svelte` 中配置路由。

### 音频处理扩展

在 `backend/app/utils/audio_utils.py` 中添加新的音频处理函数。

### 聚类算法扩展

在 `backend/app/services/clustering_service.py` 中添加新的聚类方法。

## 许可证

MIT License
