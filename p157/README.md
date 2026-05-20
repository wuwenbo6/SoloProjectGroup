# ARM Cortex-M FreeRTOS Web Simulator

一个基于Web的ARM Cortex-M模拟器，支持FreeRTOS实时操作系统可视化。

## 功能特性

### 核心模拟
- **ARM Cortex-M内核模拟**：JavaScript实现的指令集模拟器
- **Thumb/Thumb-2指令集**：支持大部分常用指令
- **ELF文件加载**：支持加载和解析ARM ELF格式的可执行文件
- **SysTick定时器**：模拟系统滴答定时器

### FreeRTOS功能
- **任务调度**：优先级抢占式调度器
- **任务状态追踪**：就绪、运行、阻塞、挂起状态
- **队列管理**：任务间通信
- **信号量/互斥量**：同步原语
- **任务通知**：轻量级同步机制

### 可视化界面
- **任务状态图**：D3.js绘制的状态机图，实时显示任务状态
- **队列视图**：队列填充状态和等待任务
- **信号量视图**：计数信号量和互斥量状态
- **寄存器视图**：实时显示CPU寄存器和标志位
- **跟踪日志**：系统事件时间线

### 调试功能
- **单步执行**：逐条指令执行
- **运行/暂停**：连续执行控制
- **断点管理**：设置和删除地址断点
- **速度调节**：1-10倍速执行
- **快照管理**：保存和加载模拟状态

### 后端服务
- **编译服务**：arm-none-eabi-gcc交叉编译（需系统安装）
- **数据库**：SQLite保存模拟快照
- **REST API**：快照管理接口

## 项目结构

```
p157/
├── frontend/                 # 前端Vue应用
│   ├── src/
│   │   ├── core/            # 模拟器核心
│   │   │   ├── arm-core.js  # ARM Cortex-M内核
│   │   │   └── freertos-sim.js  # FreeRTOS调度器
│   │   ├── components/      # Vue组件
│   │   │   ├── TaskStateGraph.vue  # 任务状态图
│   │   │   ├── QueueSemaphoreView.vue  # 队列信号量
│   │   │   ├── DebugControls.vue  # 调试控制
│   │   │   ├── RegisterView.vue  # 寄存器视图
│   │   │   └── TraceLog.vue  # 跟踪日志
│   │   ├── stores/          # Pinia状态管理
│   │   └── App.vue          # 主应用
│   └── package.json
├── backend/                  # 后端Express服务
│   ├── src/
│   │   ├── index.js         # 服务器入口
│   │   ├── database.js      # SQLite数据库
│   │   └── compiler.js      # ARM编译服务
│   └── package.json
├── data/                     # 数据库文件目录
└── package.json             # 根工作区
```

## 快速开始

### 安装依赖

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖（可选，用于编译服务和数据库）
cd backend && npm install
```

### 启动开发服务器

```bash
# 启动前端 (http://localhost:5173)
cd frontend && npm run dev

# 启动后端 (http://localhost:3000)
cd backend && npm run dev
```

### 使用演示

1. 打开浏览器访问 http://localhost:5173
2. 点击"创建演示任务"按钮生成示例任务
3. 使用控制面板：
   - **运行**：开始连续执行
   - **暂停**：暂停模拟
   - **单步**：逐条指令执行
   - **停止**：重置模拟器

### 上传ELF文件

1. 点击"上传 ELF 文件"
2. 选择编译好的ARM ELF文件
3. 文件加载后即可开始模拟

## API接口

### 快照管理

```
GET    /api/snapshots          # 获取所有快照
GET    /api/snapshots/:id      # 获取单个快照
POST   /api/snapshots          # 保存快照
DELETE /api/snapshots/:id      # 删除快照
```

### 编译服务

```
GET    /api/compiler/info      # 获取编译器信息
POST   /api/compiler/compile   # 编译C代码
```

### ELF上传

```
POST   /api/elf/upload         # 上传ELF文件
```

## 系统调用

模拟器通过SVC指令实现FreeRTOS系统调用：

| SVC号 | 功能 | 参数 |
|-------|------|------|
| 0 | vTaskDelay | r0 = ticks |
| 1 | xQueueCreate | r0 = length, r1 = itemSize |
| 2 | xQueueSend | r0 = queue, r1 = item, r2 = timeout |
| 3 | xQueueReceive | r0 = queue, r1 = timeout |
| 4 | xSemaphoreCreate | r0 = maxCount, r1 = initialCount |
| 5 | xSemaphoreTake | r0 = sem, r1 = timeout |
| 6 | xSemaphoreGive | r0 = sem |
| 7 | xTaskCreate | r0 = name, r1 = priority, r2 = stack, r3 = entry |
| 8 | vTaskSuspend | r0 = taskHandle |
| 9 | vTaskResume | r0 = taskHandle |
| 10 | xTaskNotifyGive | r0 = taskHandle |
| 11 | ulTaskNotifyTake | r0 = clearCount, r1 = timeout |

## 技术栈

**前端**：
- Vue 3 + Composition API
- Pinia 状态管理
- Element Plus UI组件库
- D3.js 可视化
- Vite 构建工具

**后端**：
- Node.js + Express
- better-sqlite3 数据库
- multer 文件上传
- arm-none-eabi-gcc 交叉编译

## 注意事项

1. 编译服务需要系统安装 `arm-none-eabi-gcc` 工具链
2. 模拟器实现了核心指令集，复杂程序可能需要扩展
3. ELF文件需为ARM Thumb架构的可执行文件
4. 数据库文件保存在 `data/simulator.db`

## 许可证

MIT License
