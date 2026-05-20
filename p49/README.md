# FSM DSL Toolchain

一个完整的全栈DSL工具链，用于设计、编辑、可视化和调试有限状态机。

## ✨ 新功能

### 自动生成测试用例

一键自动生成覆盖所有状态转换的测试套件：

**包含的测试类型：**
- 📊 **Transition Coverage** - 遍历所有状态转换
- 📍 **State Coverage** - 访问所有状态
- 🔄 **Round Trip** - 往返测试（从初始状态返回）
- 🗺️ **Path Testing** - 多条独立执行路径

**功能特点：**
- 实时覆盖率进度条显示
- 测试用例可点击预览
- 一键复制完整测试脚本
- 自动生成标准DSL测试格式
- 显示每个测试用例的步骤数

**使用方式：**
1. 点击工具栏的 "🧪 Test Cases" 按钮
2. 点击 "Generate Test Cases" 生成测试
3. 点击测试用例预览详细内容
4. 使用 "Copy to Clipboard" 复制脚本

**相关文件：**
- [testCaseGenerator.js](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/web-editor/src/utils/testCaseGenerator.js) - 核心生成算法
- [TestCasePanel.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/web-editor/src/components/TestCasePanel.vue) - 测试面板组件

---

## Bug修复记录

### 修复：可视化编辑器贝塞尔曲线闪烁和错位问题

**问题描述：**
当拖拽状态节点或画布缩放时，连线的贝塞尔曲线出现闪烁和端点错位，原因是：
1. 坐标系统不统一（屏幕坐标 vs SVG内部坐标）
2. 缺少画布缩放比例的坐标转换
3. 频繁重绘导致渲染抖动

**修复方案：**

1. **统一坐标系统**
   - 使用 SVG 根组元素一次性处理 `translate + scale` 变换
   - 所有状态位置和连线端点统一在 SVG 局部坐标系计算
   - 避免了每个元素单独缩放导致的累积误差

2. **精确坐标转换函数**
   ```javascript
   const screenToSvg = (screenX, screenY) => {
     const rect = svg.getBoundingClientRect()
     return {
       x: (screenX - rect.left - svgCenter.x - panOffset.x) / zoom,
       y: (screenY - rect.top - svgCenter.y - panOffset.y) / zoom
     }
   }
   ```

3. **RAF 批量更新避免闪烁**
   - 使用 `requestAnimationFrame` 批量处理位置更新
   - 取消未完成的帧请求，避免频繁重绘导致抖动
   - 拖拽和移动操作统一调度，确保 60fps 流畅渲染

4. **中心点动态计算**
   - 监听窗口大小变化，实时更新 SVG 中心点
   - 初始化时自动计算画布中心，确保状态布局居中

**相关代码位置：**
- [StateMachineVisualizer.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/web-editor/src/components/StateMachineVisualizer.vue#L23) - SVG 根组变换
- [StateMachineVisualizer.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/web-editor/src/components/StateMachineVisualizer.vue#L247-L256) - 坐标转换函数
- [StateMachineVisualizer.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/web-editor/src/components/StateMachineVisualizer.vue#L303-L311) - RAF 调度器

---

### 修复：循环状态机断点调试无限循环问题

**问题描述：**
当状态机存在间接循环转移（如 A→B→C→A）时，解释器的断点调试在单步模式下会陷入无限循环。

**修复方案：**

1. **步进计数器与最大步数限制**
   - 新增 `stepCount` 计数器和 `maxSteps` 配置（默认1000步）
   - 超过最大步数时自动暂停并显示错误信息

2. **循环检测机制**
   - 两种检测算法：
     - 连续重复序列检测：检测堆栈尾部是否出现重复模式
     - 历史重复检测：检测同一状态第二次出现形成的循环
   - 检测到循环时自动暂停并显示循环路径

3. **单步模式自动关闭**
   - 单次单步执行后自动关闭 `stepMode`
   - 避免后续事件触发时不必要的暂停

4. **前端显示增强**
   - 循环检测警告显示（黄色高亮）
   - 最大步数超限错误显示（红色高亮）
   - 循环路径可视化展示

**相关代码位置：**
- [interpreter.go](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/interpreter/pkg/interpreter/interpreter.go#L158-L194) - `detectCycle()` 循环检测函数
- [types.go](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/interpreter/pkg/types/types.go#L28-L37) - 新增 `Error` 和 `CycleDetected` 字段
- [App.vue](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p49/web-editor/src/App.vue#L49-L54) - 前端错误和循环显示

## 项目结构

```
p49/
├── language-server/     # TypeScript LSP服务器
│   ├── src/
│   │   ├── parser.ts    # DSL解析器
│   │   ├── validator.ts # 验证器
│   │   └── server.ts    # LSP服务器
│   ├── package.json
│   └── tsconfig.json
├── interpreter/         # Go后端解释器
│   ├── pkg/
│   │   ├── types/       # 类型定义
│   │   ├── parser/      # Go DSL解析器
│   │   ├── interpreter/ # 状态机执行引擎
│   │   └── server/      # WebSocket服务器
│   ├── cmd/
│   │   └── main.go      # 入口文件
│   └── go.mod
├── web-editor/          # Vue前端编辑器
│   ├── src/
│   │   ├── App.vue      # 主应用组件
│   │   ├── components/
│   │   │   └── StateMachineVisualizer.vue  # SVG可视化组件
│   │   └── style.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── shared/              # 共享类型定义
│   └── types/
│       └── index.ts
└── examples/            # 示例DSL文件
    └── demo.fsm
```

## DSL语法

```
machine TrafficLight {
    initial: Red
    
    state Red {
        on Enter: turnOnRedLight
        on Exit: turnOffRedLight
        on TimerTick -> Yellow
    }
    
    state Yellow {
        on Enter: turnOnYellowLight
        on Exit: turnOffYellowLight
        on TimerTick -> Green
    }
    
    state Green {
        on Enter: turnOnGreenLight
        on Exit: turnOffGreenLight
        on TimerTick -> Red
        on EmergencyStop -> Red
    }
}

action turnOnRedLight {
    print("红灯亮起")
}
```

## 运行说明

### 1. 启动Go后端解释器

```bash
cd interpreter
go mod tidy
go run cmd/main.go
```

服务器将在 `http://localhost:8080` 启动，WebSocket端点为 `/ws`。

### 2. 启动前端编辑器

```bash
cd web-editor
npm install
npm run dev
```

前端将在 `http://localhost:3000` 启动。

### 3. (可选) 启动LSP服务器

```bash
cd language-server
npm install
npm run build
npm start
```

## 功能特性

### 编辑器功能
- **语法高亮**: 基于Monaco Editor的自定义语法高亮
- **实时解析**: 编辑时自动解析并更新可视化
- **自定义主题**: 深色主题，专为DSL设计

### 可视化功能
- **SVG渲染**: 纯SVG绘制状态节点和连线
- **状态高亮**: 当前状态以绿色高亮显示
- **断点标记**: 断点状态以红色标记
- **事件标签**: 转换连线上显示触发事件名称

### 调试功能
- **断点管理**: 在可视化或调试面板中设置/移除断点
- **单步执行**: Step按钮执行下一步状态转换
- **暂停/恢复**: 暂停和恢复状态机执行
- **执行堆栈**: 显示完整的状态转换历史
- **实时同步**: WebSocket实时同步执行状态

### 后端功能
- **DSL解析**: Go实现的完整DSL解析器
- **状态机执行**: 事件驱动的状态转换引擎
- **动作执行**: 进入/退出状态时执行关联动作
- **WebSocket通信**: 实时双向通信，同步断点和执行状态

## 使用流程

1. 启动Go后端服务器
2. 启动前端编辑器
3. 在编辑器中编写或修改FSM DSL代码
4. 点击 "Load DSL" 按钮加载到后端
5. 点击可视化中的状态节点设置断点
6. 点击 "Timer Tick" 或输入自定义事件触发状态转换
7. 观察状态机执行和调试信息
