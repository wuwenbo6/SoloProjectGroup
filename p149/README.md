# PLC 梯形图仿真平台

一个基于Web的PLC梯形图编程与仿真平台，支持可视化编程、实时仿真、在线调试和Modbus通信。

## 功能特性

### 1. Blockly可视化编程
- 拖拽式梯形图编程
- 支持常开/常闭触点
- 支持上升沿/下降沿检测
- 支持普通/置位/复位线圈
- 支持TON/TOF/TP定时器
- 支持内部继电器

### 2. Go仿真引擎
- 100ms扫描周期
- 实时变量更新
- 定时器逻辑处理
- 程序加载和执行

### 3. 在线调试
- 变量实时监视
- 变量强制置位/复位
- 强制状态指示
- 扫描周期计数

### 4. Modbus TCP通信
- 连接真实PLC或模拟器
- 线圈读写
- 寄存器读写
- 通信日志

### 5. 项目管理
- SQLite数据库存储
- 项目创建、保存、加载
- 项目列表管理

## 技术栈

### 前端
- React 18 + TypeScript
- Blockly (可视化编程)
- Zustand (状态管理)
- Tailwind CSS (样式)
- React Router (路由)
- Lucide React (图标)
- Vite (构建工具)

### 后端
- Go 1.21+
- Gin (Web框架)
- Gorilla WebSocket
- SQLite (数据库)
- Modbus TCP库

## 项目结构

```
p149/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── components/       # React组件
│   │   │   ├── Editor/      # Blockly编辑器
│   │   │   ├── Monitor/     # 变量监视器
│   │   │   └── Modbus/      # Modbus面板
│   │   ├── blocks/          # Blockly自定义块
│   │   ├── store/           # Zustand状态管理
│   │   ├── hooks/           # 自定义Hooks
│   │   ├── pages/           # 页面组件
│   │   └── utils/           # 工具函数
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # 后端项目
│   ├── cmd/
│   │   └── server/          # 主程序入口
│   ├── internal/
│   │   ├── engine/          # 仿真引擎
│   │   ├── api/             # API处理器
│   │   ├── models/          # 数据模型
│   │   └── parser/          # 梯形图解析器
│   ├── pkg/
│   ├── go.mod
│   └── go.sum
└── data/                     # SQLite数据库文件
```

## 快速开始

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 启动

### 后端启动

```bash
cd backend
go mod tidy
mkdir -p ../data
go run cmd/server/main.go
```

后端将在 http://localhost:8080 启动

## API接口

### REST API
- `GET /api/projects` - 获取项目列表
- `GET /api/projects/:id` - 获取单个项目
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### Modbus API
- `POST /api/modbus/connect` - 连接Modbus设备
- `POST /api/modbus/disconnect` - 断开连接
- `POST /api/modbus/read-coils` - 读取线圈
- `POST /api/modbus/write-coil` - 写入线圈
- `POST /api/modbus/read-registers` - 读取寄存器
- `POST /api/modbus/write-register` - 写入寄存器

### WebSocket
- `ws://localhost:8080/ws` - 实时变量更新和仿真控制

## 使用说明

### 1. 创建梯形图
1. 从左侧工具箱拖拽元件到编辑区
2. 连接触点和线圈形成梯级
3. 点击元件修改变量地址（如I0.0, Q0.0）

### 2. 运行仿真
1. 点击"启动仿真"按钮
2. 观察右侧变量监视器
3. 强制置位变量测试逻辑

### 3. 项目管理
1. 点击"保存"按钮保存当前项目
2. 访问 /projects 查看项目列表
3. 加载或删除已有项目

### 4. Modbus通信
1. 在Modbus面板配置PLC连接参数
2. 点击连接
3. 测试线圈和寄存器读写

## 变量地址规范

- **输入变量**: I0.0 ~ I0.7 (8点)
- **输出变量**: Q0.0 ~ Q0.7 (8点)
- **内部继电器**: M0.0 ~ M1.7 (16点)
- **定时器**: T0 ~ T7 (8个)

## 开发计划

- [ ] 更多梯形图指令支持（计数器、数据运算等）
- [ ] 梯形图导出/导入功能
- [ ] 仿真速度可调
- [ ] 断点调试功能
- [ ] 更多PLC型号支持
- [ ] 程序在线下载到真实PLC

## 许可证

MIT
