# Modbus TCP 调试工具

一个功能完整的工业协议调试工具，支持 Modbus TCP 主站和从站模式，提供实时数据监控、历史记录和脚本注入功能。

## 功能特性

- **Modbus TCP 主站**：连接外部从站设备，读取/写入寄存器
- **Modbus TCP 从站**：模拟 PLC 设备，可通过脚本自定义逻辑
- **数据记录**：所有寄存器值变化自动存入 PostgreSQL，支持历史查询
- **数据可视化**：趋势图表展示历史数据变化
- **脚本引擎**：基于 isolated-vm 的安全 JavaScript 沙箱，支持 CPU 时间限制和内存限制，防止恶意脚本或死循环卡死主进程，周期性执行模拟 PLC 逻辑
- **实时通信**：基于 Socket.IO 的实时数据推送

## 项目结构

```
.
├── server.js              # 主服务器入口
├── package.json           # 后端依赖配置
├── shared/
│   └── constants.js       # 常量定义
├── master/
│   └── index.js           # Modbus TCP 主站实现
├── slave/
│   └── index.js           # Modbus TCP 从站实现
├── database/
│   ├── index.js           # 数据库操作封装
│   └── config.js          # 数据库配置
├── script-engine/
│   └── index.js           # 脚本执行引擎
└── frontend/              # React 前端应用
    ├── package.json
    ├── public/
    └── src/
        ├── App.js
        └── components/
            ├── MasterControl.jsx    # 主站控制界面
            ├── SlaveMonitor.jsx     # 从站监控界面
            ├── DataChart.jsx        # 数据图表界面
            └── ScriptEditor.jsx     # 脚本编辑器
```

## 安装与运行

### 前置要求

- Node.js 16+
- PostgreSQL 12+ (可选，无数据库时不记录历史数据)

### 后端安装

```bash
# 安装后端依赖
npm install

# 启动后端服务 (端口 3001)
npm start
```

### 前端安装

```bash
cd frontend

# 安装前端依赖
npm install

# 启动前端开发服务器 (端口 3000)
npm start
```

### 数据库配置（可选）

如需启用历史数据记录功能，需要配置 PostgreSQL：

1. 创建数据库 `modbus_debug`
2. 修改 `database/config.js` 中的连接配置
3. 数据表会在首次连接时自动创建

默认数据库配置：
- 主机: localhost
- 端口: 5432
- 数据库: modbus_debug
- 用户: postgres
- 密码: postgres

可通过环境变量覆盖默认配置：
- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD

## 使用说明

### 1. 主站控制

- 填写目标从站的 IP、端口、单元 ID，点击"连接"
- 选择寄存器类型、起始地址、数量和轮询间隔，点击"开始轮询"
- 可直接写入线圈和保持寄存器的值

### 2. 从站监控

- 点击"启动从站"在指定端口开启 Modbus TCP 服务
- 手动设置寄存器值用于测试
- 实时显示当前所有寄存器状态

### 3. 数据图表

- 选择寄存器类型和地址
- 指定时间范围查询历史数据
- 查看数据趋势图

### 4. 脚本编辑器

- 编写 JavaScript 脚本模拟 PLC 逻辑
- 支持读写所有类型的寄存器
- 可设置执行间隔，周期性运行
- 查看脚本执行日志

### 脚本 API

```javascript
// 线圈操作
setCoil(address, value)
getCoil(address)

// 离散输入操作
setDiscreteInput(address, value)
getDiscreteInput(address)

// 保持寄存器操作
setHoldingRegister(address, value)
getHoldingRegister(address)

// 输入寄存器操作
setInputRegister(address, value)
getInputRegister(address)

// 日志输出
log(message)
```

### 脚本示例

```javascript
// 计数器：保持寄存器0每周期+1
const count = getHoldingRegister(0) || 0;
setHoldingRegister(0, count + 1);

// 当计数达到100时，置位线圈0
if (count >= 100) {
  setCoil(0, true);
} else {
  setCoil(0, false);
}

log('当前计数: ' + count);
```

## 技术栈

**后端**
- Node.js + Express
- Socket.IO (实时通信)
- modbus-serial (Modbus协议)
- pg (PostgreSQL驱动)
- vm2 (安全沙箱)

**前端**
- React 18
- Material-UI
- Recharts (图表)
- Socket.IO Client

## 注意事项

1. 主站和从站不能使用相同端口同时运行
2. 脚本在沙箱环境中运行，无法访问系统资源
3. 大量数据轮询时，建议适当增加轮询间隔
4. 数据库为可选功能，未连接时仅不记录历史数据，不影响其他功能
