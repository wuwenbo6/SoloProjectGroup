# 打字机字符采集监控操作台

一个完整的全栈打字机字符采集监控系统，包含前端监控操作台和后端设备对接服务。

## 项目结构

```
p75/
├── backend/                 # 后端 FastAPI 服务
│   ├── main.py             # 主应用文件
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端 React 应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── contexts/       # 上下文
│   │   ├── services/       # API 服务
│   │   ├── App.jsx         # 主应用组件
│   │   ├── index.js        # 入口文件
│   │   └── index.css       # 样式文件
│   ├── package.json        # Node.js 依赖
│   ├── tailwind.config.js  # Tailwind 配置
│   └── postcss.config.js   # PostCSS 配置
└── README.md               # 本文件
```

## 功能特性

### 后端 (FastAPI)
- ✅ 打字机设备连接与管理
- ✅ 采集参数配置（采样率、置信度阈值等）
- ✅ 字符数据存储与查询
- ✅ WebSocket 实时数据推送
- ✅ 设备心跳检测与超时预警
- ✅ 异常告警机制
- ✅ SQLite 数据库持久化存储

### 前端 (React)
- ✅ 实时监控操作台主界面
- ✅ 设备状态实时显示（在线/离线/采集中）
- ✅ 采集进度实时展示（字符数、时长、平均置信度）
- ✅ 字符识别结果可视化（带置信度标识）
- ✅ 告警信息实时弹窗与列表展示
- ✅ 历史采集记录查询
- ✅ 设备参数远程配置
- ✅ WebSocket 自动重连机制

## 快速开始

### 1. 启动后端服务

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

后端服务将在 `http://localhost:8000` 启动

API 文档：`http://localhost:8000/docs`

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm start
```

前端服务将在 `http://localhost:3000` 启动

## API 接口说明

### 设备管理
- `GET /api/devices` - 获取所有设备列表
- `GET /api/devices/{device_id}` - 获取单个设备信息
- `POST /api/devices` - 注册新设备
- `PUT /api/devices/{device_id}/config` - 更新设备配置
- `POST /api/devices/{device_id}/connect` - 连接设备
- `POST /api/devices/{device_id}/disconnect` - 断开设备
- `POST /api/devices/{device_id}/heartbeat` - 发送心跳

### 数据采集
- `POST /api/collect/start` - 开始采集
- `POST /api/collect/stop` - 停止采集
- `POST /api/collect/character` - 提交采集字符

### 数据查询
- `GET /api/records` - 获取采集记录列表
- `GET /api/characters/{session_id}` - 获取会话字符数据

### 告警
- `POST /api/alerts` - 发送告警信息

### WebSocket
- `ws://localhost:8000/ws` - WebSocket 实时通信端点

## 数据库表结构

### devices (设备表)
- id: 主键
- device_id: 设备ID（唯一）
- name: 设备名称
- status: 设备状态（offline/online/collecting）
- is_connected: 是否连接
- last_heartbeat: 最后心跳时间
- config: 配置JSON
- created_at: 创建时间

### character_data (字符数据表)
- id: 主键
- device_id: 设备ID
- character: 字符内容
- confidence: 置信度
- timestamp: 时间戳
- session_id: 会话ID

### collection_records (采集记录表)
- id: 主键
- device_id: 设备ID
- session_id: 会话ID
- start_time: 开始时间
- end_time: 结束时间
- total_characters: 总字符数
- status: 状态
- error_message: 错误信息

## 使用说明

1. 启动前后端服务
2. 在前端界面点击"添加设备"，创建设备
3. 点击"连接设备"建立连接
4. 点击"开始采集"启动数据采集
5. 通过 WebSocket 可以实时推送模拟字符数据

## 技术栈

- **后端**: Python 3.8+, FastAPI, SQLAlchemy, SQLite
- **前端**: React 18, Tailwind CSS, Axios, Lucide React
- **通信**: RESTful API + WebSocket

## 注意事项

- 本系统为演示系统，实际使用时需要对接真实的打字机硬件设备
- 生产环境建议使用 PostgreSQL 或 MySQL 数据库
- 建议添加用户认证和权限控制
- WebSocket 在生产环境建议添加认证机制