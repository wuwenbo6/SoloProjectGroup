# 跨平台系统资源监控桌面应用

基于 Electron + React + Node.js 开发的跨平台系统资源监控工具。

## 功能特性

### 前端 UI
- CPU、内存、磁盘、网络的实时监控面板
- 支持自定义监控指标（进程 CPU 占用、磁盘读写速度）
- 监控数据以折线图、柱状图展示（使用 Recharts）
- 支持数据刷新频率配置（1秒/5秒/10秒）
- 进程过滤搜索功能

### 后端采集服务
- 基于 Node.js + systeminformation 实现系统数据采集
- 支持按进程过滤 CPU / 内存占用
- 采集数据通过 IPC 通道发送给前端
- 支持后台运行，托盘图标显示当前 CPU 使用率
- 右键菜单可打开面板 / 退出应用

### 数据持久化模块
- 监控数据写入 SQLite 数据库
- 支持按时间范围查询历史监控数据
- 生成 CSV 格式的监控报告
- 支持设置数据保留天数，自动清理过期数据

## 项目结构

```
system-monitor/
├── electron-app/                 # Electron 主应用
│   ├── src/
│   │   ├── main/                 # 主进程代码
│   │   │   ├── collector.js      # 系统数据采集器
│   │   │   └── tray.js           # 系统托盘功能
│   │   ├── renderer/             # 渲染进程代码
│   │   │   ├── components/       # React 组件
│   │   │   │   ├── CpuChart.js   # CPU 图表
│   │   │   │   └── MemoryChart.js # 内存/磁盘/网络图表
│   │   │   ├── App.js            # 主应用组件
│   │   │   └── index.html        # HTML 入口
│   │   └── index.js              # Electron 主进程入口
│   ├── assets/                   # 资源文件（图标）
│   └── package.json
└── data-service/                 # 数据服务模块
    ├── src/
    │   ├── db.js                 # SQLite 数据库操作
    │   └── reporter.js           # CSV 报告生成
    └── package.json
```

## 安装与运行

### 1. 安装依赖

```bash
# 安装 data-service 依赖
cd data-service
npm install

# 安装 electron-app 依赖
cd ../electron-app
npm install
```

### 2. 运行应用

```bash
cd electron-app
npm start
```

### 3. 开发模式（打开开发者工具）

```bash
npm run dev
```

### 4. 构建打包

```bash
npm run build
```

## 使用说明

### 实时监控
- 应用启动后自动开始采集系统数据
- 顶部显示四大指标的实时数据卡片
- 下方四个图表展示各指标的历史趋势

### 刷新频率配置
- 在顶部控制面板选择刷新频率：1秒、5秒或10秒

### 进程过滤
- 在进程过滤输入框中输入进程名进行筛选
- 支持模糊匹配

### 数据导出
1. 选择开始时间和结束时间
2. 点击"导出系统报告"或"导出进程报告"
3. 选择保存位置，CSV 文件将自动生成

### 数据清理
1. 选择数据保留天数（1天/7天/30天/90天）
2. 点击"清理过期数据"按钮

## 技术栈

- **Electron**: 跨平台桌面应用框架
- **React 18**: 前端 UI 框架
- **Recharts**: 图表库
- **Node.js**: 后端运行时
- **systeminformation**: 系统信息采集库
- **better-sqlite3**: SQLite 数据库驱动
- **csv-writer**: CSV 文件生成

## 支持平台

- Windows
- macOS
- Linux
