# WebRTC 远程控制系统

一个基于WebRTC的远程控制应用，支持通过浏览器远程控制多台主机。

## 系统架构

```
控制端(浏览器)
    ├── 屏幕捕获 (getDisplayMedia)
    ├── 输入事件捕获 (鼠标/键盘)
    ├── WebRTC PeerConnection
    └── DataChannel (传输输入事件)
         │
         ▼
    信令服务器 (Socket.io)
         │
         ▼
被控端(Node.js agent)
    ├── WebRTC PeerConnection
    ├── DataChannel (接收输入事件)
    └── robotjs (模拟输入)
```

## 功能特性

- ✅ 屏幕实时共享（H.264硬件编码）
- ✅ 鼠标移动、点击、滚轮控制
- ✅ 键盘按键控制
- ✅ 多主机同时注册
- ✅ 控制端可切换不同被控主机
- ✅ Socket.io信令服务器

## 安装步骤

### 1. 安装所有依赖

```bash
# 在根目录执行
npm run install:all
```

或者分别安装：

```bash
# 信令服务器
cd server && npm install

# 被控端agent
cd ../agent && npm install

# 前端客户端
cd ../client && npm install
```

**注意**: `robotjs` 和 `wrtc` 模块需要编译，可能需要安装以下依赖：

- Windows: windows-build-tools
- macOS: Xcode Command Line Tools
- Linux: build-essential, python-dev

## 运行方式

需要同时启动三个组件（建议使用三个不同的终端）：

### 1. 启动信令服务器

```bash
cd server && npm start
```
服务器运行在: http://localhost:3001

### 2. 启动被控端Agent

```bash
cd agent && npm start
```

可以通过环境变量配置：
```bash
# 指定信令服务器地址
SIGNALING_SERVER=http://your-server:3001 npm start

# 指定主机名称
HOST_NAME=My-Desktop npm start
```

### 3. 启动前端控制端

```bash
cd client && npm start
```

浏览器会自动打开: http://localhost:3000

## 使用流程

1. **在被控主机上**：启动agent，它会自动连接信令服务器并注册
2. **在控制主机上**：
   - 打开浏览器访问 http://localhost:3000
   - 点击"开始屏幕捕获"按钮，选择要共享的屏幕
   - 从左侧"在线主机"列表中选择要控制的主机
   - WebRTC连接建立后，在视频区域内移动鼠标即可控制远程主机
   - 点击和键盘事件也会同步到远程主机

## 项目结构

```
p144/
├── server/              # 信令服务器
│   ├── index.js        # 服务器主文件
│   └── package.json
├── agent/               # 被控端代理
│   ├── index.js        # Agent主文件
│   └── package.json
├── client/              # 前端控制端
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js
│   │   ├── App.js      # 主应用组件
│   │   └── App.css     # 样式文件
│   └── package.json
└── package.json         # 根项目配置
```

## 技术栈

- **信令服务器**: Node.js + Express + Socket.io
- **被控端**: Node.js + wrtc (WebRTC) + robotjs (输入模拟)
- **前端**: React + Socket.io-client + WebRTC API

## 支持的输入事件

### 鼠标事件
- mousemove: 鼠标移动
- mousedown/mouseup: 鼠标按键
- click: 点击（包括左键、右键、中键）
- scroll: 滚轮滚动

### 键盘事件
- keydown/keyup: 按键按下/释放
- 支持常用键: 字母、数字、回车、退格、方向键、修饰键等

## H.264 编码说明

WebRTC视频流默认使用浏览器支持的编码方式，Chrome会优先使用H.264硬件编码。视频流通过WebRTC PeerConnection传输，无需额外配置。

## 注意事项

1. 浏览器需要支持WebRTC API（推荐使用Chrome/Edge）
2. 屏幕捕获需要用户授权
3. 键盘事件需要视频区域获得焦点（点击视频区域）
4. 被控端agent需要在图形界面环境下运行
5. 跨网络连接可能需要配置TURN服务器

## 故障排查

### Agent启动失败
- 检查Node.js版本（建议 v16+）
- 确保robotjs编译成功
- 检查信令服务器是否可访问

### 无法建立WebRTC连接
- 检查防火墙设置
- 确保STUN服务器可访问（默认使用Google STUN）
- 跨网络可能需要配置TURN服务器

### 控制无响应
- 检查DataChannel状态
- 确保agent在前台运行（某些系统后台运行可能无法模拟输入）

## 许可证

MIT
