# 造纸工序监控操作台

一个完整的工业监控系统，包含后端Go服务、前端React界面和SQLite数据库，实现造纸工序的实时数据监测与异常预警。

## 系统架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   传感器设备     │ ◄────────────────► │   Go 后端服务    │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                ▼
┌─────────────────┐     HTTP/API       ┌─────────────────┐
│   React 前端    │ ◄────────────────► │   SQLite 数据库  │
└─────────────────┘                    └─────────────────┘
```

## 功能特性

### 后端 (Go)
- ✅ 传感器数据采集与模拟
- ✅ 实时数据分析与异常检测
- ✅ WebSocket 实时推送
- ✅ RESTful API 接口
- ✅ SQLite 数据库持久化
- ✅ 工序参数配置管理

### 前端 (React)
- ✅ 浸泡工序实时监控
- ✅ 捶打工序实时监控
- ✅ 抄纸工序实时监控
- ✅ 异常预警面板
- ✅ 温度趋势图表
- ✅ WebSocket 实时更新

### 监控参数
- 温度 (°C)
- 湿度 (%)
- pH 值
- 浓度 (%)
- 转速 (rpm)

## 项目结构

```
p69/
├── backend/
│   ├── cmd/
│   │   └── main.go              # 主程序入口
│   ├── internal/
│   │   ├── models/
│   │   │   └── models.go        # 数据模型
│   │   ├── config/
│   │   │   └── database.go      # 数据库配置
│   │   ├── sensor/
│   │   │   ├── collector.go     # 数据采集器
│   │   │   └── analyzer.go      # 数据分析器
│   │   ├── api/
│   │   │   ├── handlers.go      # API 处理器
│   │   │   └── routes.go        # 路由配置
│   │   └── ws/
│   │       └── websocket.go     # WebSocket 服务
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProcessCard.tsx  # 工序卡片组件
│   │   │   └── AlertPanel.tsx   # 预警面板组件
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts  # WebSocket Hook
│   │   ├── services/
│   │   │   └── api.ts           # API 服务
│   │   ├── types/
│   │   │   └── index.ts         # 类型定义
│   │   ├── App.tsx              # 主应用组件
│   │   └── index.tsx            # 入口文件
│   ├── package.json
│   └── tsconfig.json
└── database/                    # SQLite 数据库目录
```

## 快速开始

### 环境要求
- Go 1.21+
- Node.js 18+
- npm 9+

### 后端启动

```bash
cd backend

# 安装依赖
go mod tidy

# 运行服务
go run cmd/main.go
```

后端服务将在 `http://localhost:8080` 启动

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端界面将在 `http://localhost:3000` 打开

## API 接口

### 传感器数据
- `GET /api/sensor-data?process_type=soaking&limit=30` - 获取传感器数据
- `GET /api/historical-data?start=&end=&process_type=` - 获取历史数据

### 预警管理
- `GET /api/alerts?limit=20` - 获取预警列表
- `PUT /api/alerts/:id/acknowledge` - 确认预警

### 配置管理
- `GET /api/configs` - 获取所有工序配置
- `PUT /api/configs/:process_type` - 更新工序配置

### WebSocket
- `ws://localhost:8080/ws` - 实时数据推送

## 工序说明

### 浸泡工序 (Soaking)
- 监测温度、湿度、pH值、浓度
- 设备: SOAK-001

### 捶打工序 (Beating)
- 监测温度、湿度、pH值、浓度、转速
- 设备: BEAT-001

### 抄纸工序 (Papermaking)
- 监测温度、湿度、pH值、浓度、转速
- 设备: PAPER-001

## 预警级别

- 🟢 信息 (Info) - 正常范围波动
- 🟡 警告 (Warning) - 轻微偏离阈值
- 🔴 错误 (Error) - 明显偏离阈值
- 🟥 严重 (Critical) - 严重偏离阈值

## 技术栈

### 后端
- **Go 1.21** - 编程语言
- **Gin** - Web 框架
- **GORM** - ORM 框架
- **Gorilla WebSocket** - WebSocket 库
- **SQLite** - 数据库

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型系统
- **Recharts** - 图表库
- **Axios** - HTTP 客户端
- **Create React App** - 脚手架

## 开发说明

当前系统使用模拟数据生成器来模拟真实传感器数据。在实际生产环境中，需要：

1. 替换 `backend/internal/sensor/collector.go` 中的数据采集逻辑
2. 接入真实的传感器设备 API 或 Modbus/TCP 协议
3. 根据实际设备调整数据格式和频率

## 许可证

MIT
