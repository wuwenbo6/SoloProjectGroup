# 胶片数字化助手 - Film Scanner Desktop

基于 Electron + Python 开发的跨平台桌面端应用，专为老式胶片相机数字化设计。

## 功能模块

### 1. 相机硬件驱动对接模块
- 支持USB设备检测和连接
- 支持串口设备通信
- 实时显示连接状态
- 设备列表管理

### 2. 胶片参数调试模块
- 扫描分辨率配置 (300-4800 dpi)
- 曝光补偿调整
- 色彩校正参数 (对比度、亮度、饱和度、色温)
- 锐化强度调整
- 降噪强度控制
- 划痕修复开关
- 褪色校正开关
- 参数预设管理

### 3. 照片扫描转录模块
- 实时预览扫描画面
- 批量自动扫描
- 单帧捕获功能
- 支持135/120胶片格式
- 扫描进度显示
- 扫描历史记录

### 4. 图像降噪修复模块
- 一键智能修复
- 划痕自动检测与修复
- 智能降噪处理
- 褪色自动校正
- 色彩增强调整
- 对比度增强
- 锐化处理
- 修复前后对比
- 变化率统计

### 5. 本地照片档案管理模块
- 照片导入与存储
- SQLite数据库管理
- 多格式下载 (JPEG/PNG/TIFF)
- 格式转换功能
- 按相机型号、胶片类型筛选
- 标签搜索功能
- 照片详情查看
- 批量导出功能
- 存储统计显示

## 技术栈

### 前端 (Electron + React + TypeScript)
- Electron 28.1.0
- React 18.2.0
- TypeScript 5.2.2
- Vite 5.0.8
- Tailwind CSS 3.3.6

### 后端 (Python + FastAPI + OpenCV)
- FastAPI (API框架)
- OpenCV (图像处理)
- SQLite (数据库)
- NumPy/PIL (图像处理)
- PySerial (串口通信)

## 项目结构

```
p33/
├── src/
│   ├── main.tsx              # React入口文件
│   ├── App.tsx              # 主应用组件
│   ├── index.css            # 全局样式
│   ├── services/
│   │   └── api.ts          # API调用封装
│   └── components/
│       ├── CameraConnection.tsx    # 相机连接模块
│       ├── ParamsTuning.tsx       # 参数调试模块
│       ├── Scanning.tsx            # 扫描转录模块
│       ├── ImageRestoration.tsx   # 图像修复模块
│       └── PhotoArchive.tsx       # 档案管理模块
├── electron/
│   ├── main.ts              # Electron主进程
│   └── preload.ts           # 预加载脚本
├── backend/
│   ├── app.py               # FastAPI主应用
│   ├── models.py            # 数据模型
│   ├── database.py          # 数据库连接
│   ├── camera.py              # 相机驱动
│   ├── scanning.py           # 扫描服务
│   ├── restoration.py        # 图像修复
│   └── archive.py           # 档案管理
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## 安装与运行

### 前端安装

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建打包
npm run build
```

### 后端安装

```bash
cd backend

# 安装Python依赖
pip install -r requirements.txt

# 运行后端服务
python app.py
```

### 开发环境

需要同时运行前端和后端：

1. 终端1: 运行 `npm run dev` 启动前端
2. 终端2: 运行 `npm run start:backend` 启动后端

后端服务默认运行在: http://localhost:8000

## API接口

### 相机连接
- `GET /api/camera/devices` - 获取设备列表
- `POST /api/camera/connect` - 连接设备
- `POST /api/camera/disconnect` - 断开设备
- `GET /api/camera/status` - 获取连接状态

### 参数管理
- `GET /api/params/profiles` - 获取参数配置列表
- `POST /api/params/profiles` - 创建参数配置
- `PUT /api/params/profiles/:id` - 更新参数配置
- `DELETE /api/params/profiles/:id` - 删除参数配置

### 扫描服务
- `POST /api/scanning/start` - 开始扫描
- `POST /api/scanning/stop` - 停止扫描
- `POST /api/scanning/capture` - 单帧捕获
- `GET /api/scanning/status` - 扫描状态
- `WebSocket /ws/scanning` - 实时扫描进度

### 图像修复
- `POST /api/restoration/upload` - 上传图像
- `POST /api/restoration/process` - 处理图像 (自定义参数)
- `POST /api/restoration/quick-restore` - 一键修复
- `POST /api/restoration/remove-scratches` - 划痕修复
- `POST /api/restoration/reduce-noise` - 降噪处理
- `POST /api/restoration/correct-fading` - 褪色校正
- `POST /api/restoration/compare` - 对比处理前后

### 档案管理
- `GET /api/archive/photos` - 获取照片列表
- `GET /api/archive/photos/:id` - 获取照片详情
- `PUT /api/archive/photos/:id` - 更新照片信息
- `DELETE /api/archive/photos/:id` - 删除照片
- `POST /api/archive/import` - 导入照片
- `GET /api/archive/photos/:id/download` - 下载照片
- `GET /api/archive/stats` - 获取统计信息

## 特色功能

1. **专为胶片数字化设计
- 支持135/120等老式胶片格式
- 自定义胶片扫描参数优化
- 专业的划痕和褪色修复算法

2. **跨平台支持**
- Windows
- macOS
- Linux

3. **本地数据安全
- 所有数据本地存储
- 无需网络连接
- SQLite轻量数据库

4. **专业图像处理
- OpenCV专业算法
- 实时预览处理效果
- 可调参数满足专业需求

## 说明

本应用专为老式胶片相机数字化场景设计，无通用桌面模板，所有功能模块均根据胶片扫描的特殊需求定制开发。
