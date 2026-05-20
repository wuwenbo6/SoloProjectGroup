# 皮影道具材质检测监控平台

## 项目简介

本项目是一个完整的皮影道具材质检测监控系统，包括后端Go服务和前端React监控操作台。系统实现了材质检测数据采集、实时分析、分级预警、历史数据查询等功能。

## 技术栈

### 后端
- Go 1.21+
- Gin Web框架
- GORM ORM
- SQLite数据库
- WebSocket实时推送

### 前端
- React 18+
- TypeScript
- Ant Design组件库
- ECharts图表库
- Axios HTTP客户端

## 项目结构

```
p77/
├── backend/                    # 后端Go项目
│   ├── cmd/
│   │   └── main.go           # 主入口文件
│   ├── internal/
│   │   ├── api/              # API层
│   │   │   ├── handler.go    # API处理器
│   │   │   ├── router.go     # 路由配置
│   │   │   └── websocket.go  # WebSocket处理
│   │   ├── models/           # 数据模型
│   │   │   └── models.go
│   │   ├── repository/       # 数据访问层
│   │   │   ├── database.go   # 数据库初始化
│   │   │   ├── detection_repo.go
│   │   │   ├── device_repo.go
│   │   │   ├── material_repo.go
│   │   │   └── alert_repo.go
│   │   └── service/          # 业务逻辑层
│   │       ├── detection_service.go
│   │       ├── device_service.go
│   │       ├── material_service.go
│   │       └── alert_service.go
│   └── go.mod
├── frontend/                  # 前端React项目
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/       # 组件
│   │   │   ├── DeviceStatusPanel.tsx
│   │   │   ├── DetectionPanel.tsx
│   │   │   ├── MaterialParamPanel.tsx
│   │   │   ├── AlertPanel.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   └── HistoryQuery.tsx
│   │   ├── pages/            # 页面
│   │   │   └── Dashboard.tsx
│   │   ├── services/         # API服务
│   │   │   └── api.ts
│   │   ├── hooks/            # 自定义Hooks
│   │   │   └── useWebSocket.ts
│   │   ├── types/            # 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## 核心功能

### 1. 设备状态监控
- 实时显示检测设备在线状态
- 设备位置、检测计数统计
- 设备状态异常告警

### 2. 实时检测结果
- 实时展示材质检测数据
- 厚度、硬度、抗拉强度、湿度参数
- 质量评分计算
- 检测结果合格判定

### 3. 材质参数标准
- 各类材质（皮革、纸张、木材等）的参数标准配置
- 参数范围设定
- 合格分数、预警阈值配置

### 4. 分级预警系统
- 三级预警：正常、预警、异常
- 实时预警通知
- 预警处理功能
- 未处理预警统计

### 5. 统计分析
- 检测数量统计
- 合格率分析
- 趋势图表展示
- 历史数据对比

### 6. 历史数据查询
- 按设备、材质类型筛选
- 时间范围查询
- 分页展示
- 数据导出（可扩展）

### 7. WebSocket实时推送
- 检测结果实时推送
- 预警消息实时通知
- 实时数据更新

## 快速开始

### 后端启动

```bash
cd backend
go mod download
go run cmd/main.go
```

后端服务将在 `http://localhost:8080` 启动

### 前端启动

```bash
cd frontend
npm install
npm start
```

前端应用将在 `http://localhost:3000` 启动

## API接口

### 检测记录
- `POST /api/v1/detections` - 创建检测记录
- `GET /api/v1/detections` - 获取检测记录列表
- `GET /api/v1/detections/latest` - 获取最新检测记录
- `GET /api/v1/detections/stats` - 获取检测统计数据

### 设备管理
- `GET /api/v1/devices` - 获取所有设备
- `PUT /api/v1/devices/:id/status` - 更新设备状态

### 材质参数
- `GET /api/v1/materials` - 获取所有材质参数
- `PUT /api/v1/materials` - 更新材质参数

### 预警管理
- `GET /api/v1/alerts` - 获取预警列表
- `GET /api/v1/alerts/latest` - 获取最新预警
- `GET /api/v1/alerts/unhandled-count` - 获取未处理预警数量
- `PUT /api/v1/alerts/:id/handle` - 处理预警

### WebSocket
- `WS /ws` - WebSocket连接端点

## 数据模型

### DetectionRecord（检测记录）
- 设备ID、批次号
- 材质类型
- 厚度、硬度、抗拉强度、湿度
- 颜色值
- 质量评分
- 预警级别
- 是否合格
- 备注

### MaterialParam（材质参数）
- 材质类型
- 厚度范围
- 硬度范围
- 抗拉强度范围
- 湿度范围
- 合格分数
- 预警阈值
- 描述

### DeviceInfo（设备信息）
- 设备ID、设备名称
- 设备类型
- 状态（在线/离线/忙碌/故障）
- 位置
- IP地址
- 最后在线时间
- 检测计数
- 备注

### AlertRecord（预警记录）
- 设备ID
- 预警级别（正常/预警/异常）
- 预警类型
- 消息内容
- 关联检测记录ID
- 是否已处理
- 处理时间、处理人

## 质量评分算法

系统根据各项参数与标准范围的偏差计算质量评分：

1. 厚度评分（权重25%）
2. 硬度评分（权重25%）
3. 抗拉强度评分（权重25%）
4. 湿度评分（权重25%）

总分 = 各项评分加权之和

## 预警规则

- **正常**：质量评分 ≥ 合格分数
- **预警**：预警阈值 ≤ 质量评分 < 合格分数
- **异常**：质量评分 < 预警阈值 或 任何参数超出范围

## 扩展功能建议

1. 数据导出功能（Excel/PDF）
2. 报表生成与打印
3. 用户权限管理
4. 邮件/短信告警通知
5. 更多材质类型支持
6. AI预测分析
7. 移动端适配
8. 多语言支持

## 许可证

MIT
