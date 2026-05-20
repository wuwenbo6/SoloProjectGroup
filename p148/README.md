# SDR Radio Receiver - Electron 应用

一个基于Electron的软件定义无线电（SDR）接收应用，支持FM/AM解调、频谱分析和录音功能。

## 功能特性

- 📻 **FM/AM解调** - 支持调频（FM）和调幅（AM）信号接收
- 📊 **频谱图** - 实时FFT频谱可视化
- 🌊 **水瀑布图** - 时间-频率热力图显示
- 📈 **IQ波形显示** - 同相/正交分量时域波形
- 🎛️ **参数调节** - 频率、增益、滤波器带宽可调节
- ⏺ **WAV录音** - 保存解调音频为WAV格式
- 🧵 **多线程处理** - 使用Worker Threads处理IQ数据流

## 项目结构

```
p148/
├── package.json              # 项目配置
├── src/
│   ├── main.js              # Electron主进程
│   ├── index.html           # 渲染进程UI
│   └── workers/
│       └── sdr-worker.js    # SDR处理工作线程
└── README.md
```

## 安装依赖

```bash
npm install
```

## 运行应用

```bash
npm start
```

开发模式（带DevTools）：
```bash
npm run dev
```

## RTL-SDR设备支持

### 前置要求

1. 安装RTL-SDR驱动和工具：

**macOS:**
```bash
brew install librtlsdr
```

**Ubuntu/Debian:**
```bash
sudo apt-get install rtl-sdr
```

**Windows:**
- 从 [rtl-sdr.com](https://www.rtl-sdr.com/) 下载预编译二进制文件

2. 连接RTL-SDR设备到USB端口

### 设备检测

运行以下命令检测设备：
```bash
rtl_test
```

## 使用说明

### 1. 启动应用
点击"开始接收"按钮启动SDR接收。如果没有RTL-SDR设备，应用会自动进入模拟模式，生成测试信号用于演示。

### 2. 调节参数
- **解调模式**: 在FM和AM之间切换
- **中心频率**: 24 MHz - 1700 MHz范围可调
- **增益**: 0-50 dB可调
- **滤波器带宽**: 5-50 kHz可调

### 3. 可视化
- **频谱图**: 显示当前频率的能量分布
- **水瀑布图**: 显示频谱随时间的变化
- **IQ波形**: 显示原始I/Q分量波形

### 4. 录音
点击"开始录音"按钮，选择保存位置，即可将解调后的音频保存为WAV文件。

## 技术架构

### 主进程 (main.js)
- Electron窗口管理
- IPC通信处理
- Worker线程管理
- WAV文件写入

### 工作线程 (sdr-worker.js)
- RTL-SDR子进程spawn
- IQ数据缓冲处理
- FM/AM解调算法
- FFT计算
- 模拟信号生成（无设备时）

### 渲染进程 (index.html)
- Canvas频谱可视化
- Web Audio API音频播放
- 用户界面控制
- 状态显示

## 信号处理流程

```
RTL-SDR设备 → IQ数据流 → Worker线程处理
    ↓
┌─────────────────────────┐
│ IQ缓冲区 (8192 samples) │
└─────────────────────────┘
    ↓
┌─────────────┬─────────────┬─────────────┐
│  FM/AM解调  │   FFT计算    │  IQ波形输出  │
└─────────────┴─────────────┴─────────────┘
    ↓             ↓             ↓
  音频数据     频谱数据     IQ数据
    ↓             ↓             ↓
Web Audio    Canvas绘制    Canvas绘制
```

## FM解调算法

使用相位差解调：
```
FM_output = arctan2(Q[i] * I[i-1] - I[i] * Q[i-1], I[i] * I[i-1] + Q[i] * Q[i-1])
```

## AM解调算法

使用幅度检测：
```
AM_output = sqrt(I[i]^2 + Q[i]^2)
```

## 构建发布

```bash
# macOS
npm run build

# Windows (需要在Windows环境)
npm run build

# Linux (需要在Linux环境)
npm run build
```

## 系统要求

- **操作系统**: macOS 10.13+, Windows 10+, Ubuntu 18.04+
- **Node.js**: 14.0+
- **内存**: 至少512MB
- **存储**: 100MB可用空间
- **USB端口**: 用于连接RTL-SDR设备（可选）

## 故障排除

### 设备未找到
- 检查USB连接
- 确认驱动已正确安装
- 尝试运行 `rtl_test` 命令
- 无设备时应用会进入模拟模式

### 音频卡顿
- 降低滤波器带宽
- 检查系统CPU使用率
- 确认采样率设置正确

### 没有声音
- 检查系统音量设置
- 确认音频输出设备选择正确
- 尝试调节频率到已知电台

## 开发说明

### 添加新的解调模式
在 `sdr-worker.js` 中添加新的解调函数，并在processIQData中处理。

### 自定义可视化
在 `index.html` 中修改Canvas绘制函数，添加新的显示效果。

## 许可证

MIT License
