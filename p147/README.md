# 地震数据可视化平台

一个全栈地震数据可视化应用，支持SEG-Y格式地震数据的3D体渲染、切片查看、振幅分析和标注管理。

## 功能特性

- 📁 **文件管理**: 上传、管理和删除SEG-Y地震数据文件
- 🎨 **3D体渲染**: 使用Three.js实现高质量3D体渲染，支持多种颜色映射和可调传递函数
- 📊 **切片查看**: 支持inline、crossline和timeslice三种方向的切片浏览
- 📈 **振幅直方图**: 可视化振幅分布，支持自定义分箱数
- 🏷️ **标注系统**: 支持创建、查看和删除地震层位、断层等标注
- 🔄 **多文件对比**: 对比多个文件的元数据和统计信息
- 💾 **数据库存储**: SQLite存储文件索引和标注信息

## 技术栈

### 后端
- **FastAPI**: 高性能Python Web框架
- **segyio**: SEG-Y文件解析库
- **SQLAlchemy**: ORM数据库工具
- **NumPy**: 数值计算

### 前端
- **Vue 3**: 渐进式JavaScript框架
- **Three.js**: 3D渲染引擎
- **Element Plus**: UI组件库
- **Pinia**: 状态管理
- **Vite**: 构建工具

## 项目结构

```
p147/
├── backend/                 # 后端应用
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI主应用
│   │   ├── segy_parser.py  # SEG-Y文件解析器
│   │   ├── database.py     # 数据库模型
│   │   └── schemas.py      # Pydantic模型
│   ├── requirements.txt    # Python依赖
│   └── .env               # 环境变量
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── main.js        # 入口文件
│   │   ├── App.vue        # 根组件
│   │   ├── stores/        # Pinia状态
│   │   └── components/    # Vue组件
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 安装与运行

### 后端设置

1. 进入后端目录:
```bash
cd backend
```

2. 创建虚拟环境并安装依赖:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. 启动后端服务器:
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档将在 http://localhost:8000/docs 可用

### 前端设置

1. 进入前端目录:
```bash
cd frontend
```

2. 安装依赖:
```bash
npm install
```

3. 启动开发服务器:
```bash
npm run dev
```

前端应用将在 http://localhost:5173 可用

## API接口

### 文件管理
- `POST /api/files/upload` - 上传SEG-Y文件
- `GET /api/files` - 获取所有文件列表
- `GET /api/files/{id}` - 获取文件详细信息
- `DELETE /api/files/{id}` - 删除文件

### 数据获取
- `GET /api/files/{id}/volume` - 获取体数据
- `GET /api/files/{id}/slices/inline?index={idx}` - 获取inline切片
- `GET /api/files/{id}/slices/crossline?index={idx}` - 获取crossline切片
- `GET /api/files/{id}/slices/timeslice?index={idx}` - 获取时间切片

### 统计分析
- `GET /api/files/{id}/histogram?bins={n}` - 获取振幅直方图

### 标注管理
- `POST /api/annotations` - 创建标注
- `GET /api/annotations/{file_id}` - 获取文件的所有标注
- `DELETE /api/annotations/{id}` - 删除标注

### 文件对比
- `GET /api/files/compare/{id1},{id2},...` - 对比多个文件

## 使用说明

1. 上传SEG-Y文件
2. 在文件列表中选择要查看的文件
3. 切换不同的视图标签页：
   - **3D体渲染**: 查看三维体可视化效果，调整颜色映射和不透明度
   - **切片查看**: 浏览inline、crossline和时间切片
   - **振幅分析**: 查看振幅分布直方图和统计数据
4. 在标注面板中添加地震层位、断层等标注
5. 在对比面板中选择多个文件进行元数据对比

## 主要组件说明

### 后端核心模块
- **SegyParser** ([segy_parser.py](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/backend/app/segy_parser.py)): 封装SEG-Y文件解析功能
- **Database Models** ([database.py](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/backend/app/database.py)): 文件和标注的数据模型

### 前端核心组件
- **VolumeRenderer** ([VolumeRenderer.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/frontend/src/components/VolumeRenderer.vue)): Three.js体渲染组件，支持光线投射算法
- **SliceViewer** ([SliceViewer.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/frontend/src/components/SliceViewer.vue)): 切片查看组件
- **HistogramView** ([HistogramView.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/frontend/src/components/HistogramView.vue)): 直方图可视化
- **FileManager** ([FileManager.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/frontend/src/components/FileManager.vue)): 文件管理面板
- **AnnotationPanel** ([AnnotationPanel.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/frontend/src/components/AnnotationPanel.vue)): 标注管理面板
- **ComparePanel** ([ComparePanel.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p147/frontend/src/components/ComparePanel.vue)): 多文件对比面板

## 开发注意事项

1. SEG-Y文件可能很大，建议先测试小文件
2. 体渲染性能取决于数据大小和GPU性能
3. 默认使用SQLite数据库，生产环境建议使用PostgreSQL
4. 上传文件大小限制在.env配置文件中设置

## 许可证

MIT License
