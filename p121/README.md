# 纤维图像分析系统

一个基于计算机视觉的纤维图像分析系统，支持纤维配比分析、强度计算和杂质检测。

## 功能特性

- **纤维图像上传**：支持拖拽上传，JPG/PNG 格式
- **配比分析**：自动识别棉纤维、聚酯纤维、羊毛、蚕丝等纤维类型并计算占比
- **强度计算**：基于纤维类型和图像特征计算纤维强度指数
- **杂质检测**：自动检测图像中的杂质并分类统计
- **批量接口**：支持同时上传和分析多张图像
- **历史记录**：保存所有分析记录，支持查询和删除

## 项目结构

```
p121/
├── main.py              # FastAPI 主应用
├── database.py          # 数据库配置
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模式
├── image_processing.py  # 图像处理核心算法
├── index.html           # 前端界面
├── requirements.txt     # Python 依赖
├── uploads/             # 上传文件存储目录
└── fiber_analysis.db    # SQLite 数据库（自动生成）
```

## 安装和运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问系统

打开浏览器访问：http://localhost:8000

## API 接口文档

启动服务后访问 Swagger 文档：http://localhost:8000/docs

### 主要接口

- `POST /api/upload` - 单图上传和分析
- `POST /api/batch` - 批量图像分析
- `GET /api/history` - 获取历史记录列表
- `GET /api/history/{id}` - 获取单条记录详情
- `DELETE /api/history/{id}` - 删除历史记录
- `GET /api/stats` - 获取统计数据

## 核心算法说明

### 纤维配比分析

基于颜色阈值分割算法：
- 使用 RGB 颜色空间对不同纤维类型建立颜色模型
- 对图像进行逐像素分类
- 计算各类纤维的像素占比

### 强度计算

综合考虑以下因素：
- 各类型纤维的基础强度权重
- 图像的均匀度（通过标准差计算）
- 边缘密度（通过 Canny 边缘检测）

### 杂质检测

基于形态学处理：
- Otsu 自动阈值二值化
- 形态学开运算去除噪点
- 轮廓检测和面积筛选
- 按形状和大小分类杂质类型

## 技术栈

- **后端框架**：FastAPI
- **图像处理**：OpenCV, NumPy, Pillow
- **数据库**：SQLite + SQLAlchemy
- **前端**：原生 HTML/CSS/JavaScript

## 使用说明

1. 在浏览器中打开系统
2. 选择"单图分析"或"批量分析"标签页
3. 点击或拖拽上传纤维图像
4. 点击"开始分析"按钮
5. 查看分析结果（纤维配比、强度指数、杂质数量）
6. 在"历史记录"中查看所有分析记录
7. 在"统计概览"中查看整体统计数据
