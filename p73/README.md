# 酿酒发酵监控系统

一个完整的酿酒发酵监控操作台系统，包含React前端、Go后端和SQLite数据库。

## 功能特性

### 前端功能
- 实时显示温度、湿度、微生物浓度等参数
- 趋势图表展示（温度、湿度、微生物浓度）
- 多发酵罐切换监控
- 参数阈值配置
- 实时分析与健康度评分
- 告警记录展示

### 后端功能
- RESTful API接口
- WebSocket实时数据推送
- 传感器数据采集模拟
- 实时数据分析与告警生成
- SQLite数据库存储

## 技术栈

### 前端
- React 18
- Ant Design (UI组件库)
- Recharts (图表库)
- Axios (HTTP客户端)
- WebSocket

### 后端
- Go 1.21
- Gin Web框架
- GORM ORM
- SQLite数据库
- Gorilla WebSocket

## 快速开始

### 前置要求
- Node.js 16+
- Go 1.21+

### 安装与运行

#### 1. 启动后端服务

```bash
cd backend
go mod tidy
go run cmd/main.go
```

后端服务将在 http://localhost:8080 启动

#### 2. 启动前端服务

```bash
cd frontend
npm install
npm start
```

前端服务将在 http://localhost:3000 启动

## 项目结构

```
.
├── frontend/                 # React前端
│   ├── src/
│   │   ├── components/       # 组件
│   │   │   ├── Settings.js      # 参数配置
│   │   │   ├── SensorCard.js    # 传感器数据卡片
│   │   │   ├── TrendChart.js    # 趋势图表
│   │   │   └── AlertsList.js    # 告警列表
│   │   ├── pages/            # 页面
│   │   │   └── Dashboard.js     # 监控仪表盘
│   │   ├── services/         # 服务
│   │   │   └── api.js           # API服务
│   │   ├── App.js            # 主应用
│   │   └── index.js          # 入口
│   └── package.json
├── backend/                  # Go后端
│   ├── cmd/
│   │   └── main.go           # 主程序
│   ├── internal/
│   │   ├── api/              # API处理器
│   │   ├── database/         # 数据库操作
│   │   ├── models/           # 数据模型
│   │   └── sensor/           # 传感器模拟
│   └── go.mod
└── scripts/                  # 脚本文件
```

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/fermenters | 获取发酵罐列表 |
| GET | /api/settings | 获取配置参数 |
| PUT | /api/settings | 更新配置参数 |
| GET | /api/data/current/:id | 获取当前传感器数据 |
| GET | /api/data/history/:id | 获取历史数据 |
| GET | /api/alerts | 获取告警记录 |
| GET | /api/analysis/:id | 获取分析结果 |
| GET | /ws | WebSocket连接 |

## 数据模型

### Fermenter (发酵罐)
- ID: 唯一标识
- Name: 名称
- Location: 位置
- Status: 状态 (running/idle/error)

### SensorData (传感器数据)
- FermenterID: 发酵罐ID
- Temperature: 温度
- Humidity: 湿度
- MicrobeConcentration: 微生物浓度
- Status: 状态
- Timestamp: 时间戳

### Settings (配置)
- 温度范围 (TempMin, TempMax)
- 湿度范围 (HumidityMin, HumidityMax)
- 微生物浓度范围 (MicrobeMin, MicrobeMax)
- 采样间隔 (SampleInterval)

### AdjustmentRecord (调整记录)
- FermenterID: 发酵罐ID
- Parameter: 参数名称
- OldValue: 旧值
- NewValue: 新值
- Reason: 调整原因
- AutoAdjusted: 是否自动调整
- Timestamp: 调整时间

### FaultDiagnosis (故障诊断)
- FermenterID: 发酵罐ID
- FaultType: 故障类型
- Severity: 严重程度 (warning/error)
- Description: 故障描述
- Suggestion: 修复建议
- Status: 状态 (detected/resolved)
- Timestamp: 检测时间
- ResolvedAt: 解决时间

## 配置说明

默认配置参数：
- 温度范围: 20°C - 35°C
- 湿度范围: 40% - 70%
- 微生物浓度范围: 1000 - 1000000 CFU/mL
- 采样间隔: 5000ms

## 截图预览

系统主界面包含：
1. 发酵罐选择器
2. 实时数据展示卡片（温度、湿度、微生物浓度）
3. 趋势分析图表
4. 实时分析面板（健康度评分、趋势、建议）
5. 告警记录列表
6. 参数配置侧边栏
