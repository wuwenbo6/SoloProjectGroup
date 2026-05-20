# 胶片转录监控操作台

一个完整的胶片转录监控系统，包含FastAPI后端服务和React前端界面。

## 功能特性

### 后端 (FastAPI)
- 设备管理：连接/断开放映机，设备状态监控
- 转录控制：开始/暂停/停止转录任务
- 画质参数：分辨率、码率、帧率、PSNR、SSIM等实时监控
- 数据库集成：SQLite存储转录记录、设备参数、视频信息
- WebSocket实时通信：前后端数据同步
- 模拟数据生成：用于演示和测试

### 前端 (React)
- 实时监控仪表盘：设备数、运行任务数、警报数
- 转录进度条：实时显示转录进度和帧数
- 画质参数展示：PSNR/SSIM趋势图表
- 设备状态面板：在线/离线状态监控
- 系统警报：异常预警展示
- 响应式设计：支持多种屏幕尺寸

## 项目结构

```
p71/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py      # 数据库配置
│   │   ├── models.py        # SQLAlchemy模型
│   │   ├── schemas.py       # Pydantic模型
│   │   └── crud.py          # 数据库操作
│   ├── main.py              # FastAPI主应用
│   └── requirements.txt     # Python依赖
├── frontend/
│   ├── src/
│   │   ├── components/      # React组件
│   │   ├── services/        # API服务
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── public/
└── database/                # SQLite数据库目录
```

## 安装与运行

### 后端服务

1. 进入后端目录：
```bash
cd backend
```

2. 创建虚拟环境并安装依赖：
```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

3. 启动FastAPI服务：
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档将在 http://localhost:8000/docs 可用。

### 前端界面

1. 打开新终端，进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动React开发服务器：
```bash
npm start
```

前端界面将在 http://localhost:3000 打开。

## API接口

### 设备管理
- `GET /api/devices` - 获取所有设备
- `POST /api/devices` - 创建设备
- `PUT /api/devices/{id}/connect` - 连接设备
- `PUT /api/devices/{id}/disconnect` - 断开设备

### 转录控制
- `POST /api/transcription/start` - 开始转录
- `POST /api/transcription/pause` - 暂停转录
- `POST /api/transcription/stop` - 停止转录

### 数据查询
- `GET /api/sessions` - 获取转录会话列表
- `GET /api/alerts` - 获取系统警报
- `GET /api/dashboard/summary` - 获取仪表盘汇总

### WebSocket
- `WS /ws/realtime` - 实时数据更新通道

## 技术栈

### 后端
- FastAPI: Web框架
- SQLAlchemy: ORM
- SQLite: 数据库
- WebSocket: 实时通信
- Uvicorn: ASGI服务器

### 前端
- React 18: UI框架
- Axios: HTTP客户端
- Recharts: 图表库
- Lucide React: 图标库

## 使用说明

1. 启动后端服务后，系统会自动创建2个演示设备（胶片放映机A1和胶片扫描仪S2）
2. 在前端界面点击"开始转录"按钮启动模拟转录任务
3. 观察实时更新的进度条、帧数、画质参数和设备状态
4. 可以随时暂停或停止转录任务
5. 切换"画质参数"和"任务历史"标签查看不同信息

## 许可证

MIT License
