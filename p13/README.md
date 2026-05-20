# MIDI Script Studio

基于 Electron 的 MIDI 消息处理桌面应用，支持 JavaScript 脚本自定义 MIDI 处理逻辑。

## 功能特性

### MIDI 设备管理
- 自动检测系统中的 MIDI 输入/输出设备
- 支持手动选择和连接 MIDI 设备
- 设备热插拔自动检测（每 3 秒刷新）

### 脚本编辑器
- Monaco Editor 代码编辑器，支持语法高亮
- JavaScript 脚本实时运行和调试
- 脚本持久化存储到 SQLite 数据库
- 支持创建、编辑、删除脚本

### 脚本引擎
- 基于 Node.js VM 的安全沙盒执行环境
- 支持实时处理 MIDI 消息
- 提供脚本 API：
  - `message`: 接收到的 MIDI 消息对象
  - `sendMidi(msg)`: 发送 MIDI 消息
  - `log(...args)`: 日志输出
  - `state`: 持久化状态对象

### 预设管理
- 保存当前脚本和设备配置为预设
- 一键快速切换不同控制场景
- 预设配置存储在本地数据库

### 日志系统
- 实时显示 MIDI 消息收发日志
- 脚本运行日志输出
- 多种日志类型颜色区分

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite + vite-plugin-electron
- **MIDI 处理**: easymidi
- **数据存储**: better-sqlite3
- **代码编辑器**: Monaco Editor
- **桌面框架**: Electron 28

## 项目结构

```
.
├── electron/              # 主进程代码
│   ├── main.ts           # 应用入口
│   ├── preload.ts        # 预加载脚本
│   ├── midi.ts           # MIDI 设备管理
│   ├── database.ts       # SQLite 数据库操作
│   ├── script-engine.ts  # 脚本执行引擎
│   └── ipc.ts            # IPC 通信处理
├── src/                   # 渲染进程代码
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 渲染入口
│   ├── index.css         # 全局样式
│   ├── types/            # 类型定义
│   └── components/       # React 组件
├── index.html            # HTML 模板
├── vite.config.ts        # Vite 配置
└── package.json          # 项目配置
```

## 开发说明

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 使用说明

1. **连接 MIDI 设备**: 在侧边栏选择 MIDI 输入和输出设备
2. **编写脚本**: 在编辑器中编写 MIDI 消息处理逻辑
3. **运行脚本**: 点击 "Run" 按钮启动脚本引擎
4. **保存脚本**: 点击 "Save" 按钮保存到数据库
5. **创建预设**: 配置好设备和脚本后，点击 "Save Preset" 保存场景
6. **应用预设**: 点击预设项快速加载配置

## 脚本示例

```javascript
// 音符移调示例
if (message.type === 'noteon' || message.type === 'noteoff') {
  sendMidi({
    ...message,
    note: message.note + 2  // 升高 2 个半音
  })
}

// CC 控制器转音符示例
if (message.type === 'cc' && message.controller === 1) {
  if (message.value > 64) {
    sendMidi({
      type: 'noteon',
      note: 60,
      velocity: 100,
      channel: message.channel
    })
  }
}
```
