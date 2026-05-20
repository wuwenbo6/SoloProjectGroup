# Tape Digitizer Pro - 老式磁带数字化转录系统

基于 Qt 开发的跨平台桌面应用，专为复古影音介质数字化设计。

## 项目架构

```
TapeDigitizer/
├── TapeDigitizer.pro              # Qt 项目配置文件
├── resources/
│   └── resources.qrc               # 资源文件
└── src/
    ├── main.cpp                    # 程序入口
    ├── mainwindow.h/cpp            # 主窗口界面
    ├── hardware/
    │   ├── HardwareDriver.h        # 硬件驱动接口
    │   └── HardwareDriver.cpp      # 串口通信协议实现
    ├── audio/
    │   ├── AudioWaveformParser.h   # 音频波形解析器
    │   └── AudioWaveformParser.cpp # PCM 数据分析
    ├── video/
    │   ├── VideoNoiseReducer.h     # 视频降噪处理器
    │   └── VideoNoiseReducer.cpp   # 噪点检测与降噪算法
    ├── config/
    │   ├── TranscriptionConfig.h   # 转录参数配置管理
    │   └── TranscriptionConfig.cpp # 参数导入导出实现
    ├── archive/
    │   ├── MediaArchiveManager.h   # 本地介质档案管理
    │   └── MediaArchiveManager.cpp # SQLite 数据库存储
    ├── widgets/
    │   ├── AudioWaveformWidget.h   # 音频波形显示控件
    │   ├── AudioWaveformWidget.cpp # 实时波形绘制
    │   ├── NoisePreviewWidget.h    # 噪点分布预览控件
    │   └── NoisePreviewWidget.cpp  # 降噪效果对比显示
    └── batch/
        ├── BatchTranscriptionManager.h  # 批量转录管理器
        └── BatchTranscriptionManager.cpp # 批量任务调度
```

## 功能模块

### 1. 硬件驱动对接模块
- 串口通信协议实现
- 设备状态实时监控
- 磁带播放/倒带/快进控制
- 实时信号强度检测
- 自定义命令协议封装

### 2. 音频波形解析模块
- PCM 音频数据实时解析
- 左右声道波形显示
- 音频电平动态显示
- 采样率/位深度/声道数配置
- RMS/峰值电平计算

### 3. 画质降噪调试模块
- 亮度/色度降噪强度调节
- 时域/空域降噪算法
- 原始/降噪后画面并排对比
- 噪点分布直方图统计
- 实时噪点强度指示
- 图像锐化增强

### 4. 转录参数配置模块
- 内置多种磁带预设(VHS/Betamax/录音带)
- 自定义预设保存/加载
- 音频参数配置(采样率、位深度)
- 视频参数配置(分辨率、码率、帧率)
- 配置参数 JSON 导入导出

### 5. 本地介质档案管理模块
- SQLite 数据库持久化存储
- 档案元数据管理(名称、描述、标签)
- 转录历史记录查询
- 关键词搜索功能
- 元数据 JSON 导出
- 存储空间统计

### 6. 批量转录功能
- 多任务队列管理
- 实时进度显示
- 暂停/继续/取消控制
- 批量任务状态监控
- 自动归档功能

## 编译运行

### 环境要求
- Qt 5.15+ 或 Qt 6.x
- C++17 编译器
- Qt SerialPort 模块
- Qt SQL 模块 (SQLite 驱动)
- Qt Multimedia 模块

### 编译步骤
```bash
# 创建构建目录
mkdir build && cd build

# qmake 生成 Makefile
qmake ../TapeDigitizer.pro

# 编译
make -j4

# 运行
./TapeDigitizer
```

### 或使用 Qt Creator
1. 打开 TapeDigitizer.pro 文件
2. 配置构建套件(Kit)
3. 点击构建运行

## 通信协议

硬件设备串口通信协议格式：

| 字节 | 含义     | 说明                 |
|------|----------|----------------------|
| 0    | 0xAA     | 帧头标识1            |
| 1    | 0x55     | 帧头标识2            |
| 2    | Length   | 命令+数据总长度     |
| 3    | CmdID    | 命令ID              |
| 4~n  | Data     | 命令数据(可选)      |
| n+1  | Checksum | 校验和(从第2字节开始) |

### 主要命令ID
- 0x01: 获取设备信息
- 0x02: 播放命令
- 0x03: 停止命令
- 0x04: 倒带命令
- 0x05: 快进命令
- 0x07: 获取磁带状态
- 0x80: 音频数据
- 0x81: 视频帧数据

## 使用说明

### 1. 设备连接
1. 将转录硬件通过串口连接电脑
2. 在"硬件控制"选项卡中选择对应串口
3. 点击"连接设备"建立通信
4. 设备连接成功后状态指示灯变绿

### 2. 单盘转录
1. 选择磁带类型预设(VHS/Betamax/录音带)
2. 根据需要调整降噪和色彩校正参数
3. 将磁带放入硬件设备
4. 点击"开始转录"按钮
5. 实时观察音频波形和视频噪点分布
6. 转录完成后自动归档到数据库

### 3. 批量转录
1. 在"批量转录"选项卡点击"添加任务"
2. 依次添加所有需要转录的磁带
3. 设置输出目录
4. 点击"开始批量处理"
5. 实时监控各任务进度
6. 全部完成后自动生成档案

### 4. 参数管理
- 在"参数配置"选项卡调整音频/视频/降噪参数
- 点击"保存为预设"保存自定义配置
- 通过"导出配置"/"导入配置"备份恢复

## 技术特点

1. **模块化架构** - 各功能模块独立封装，接口清晰
2. **跨平台支持** - 基于 Qt 框架，支持 Windows/macOS/Linux
3. **实时处理** - 音频波形和视频降噪实时显示
4. **数据持久化** - SQLite 本地数据库存储所有档案
5. **协议扩展** - 自定义串口协议支持多种硬件设备
6. **性能优化** - 高效的信号处理算法

## 目录与文件说明

### 核心类说明

| 类名                  | 功能描述                       | 文件位置                 |
|-----------------------|--------------------------------|--------------------------|
| HardwareDriver        | 硬件驱动与通信协议            | src/hardware/           |
| AudioWaveformParser   | 音频数据解析与波形计算        | src/audio/              |
| VideoNoiseReducer     | 视频降噪与噪点分析            | src/video/              |
| TranscriptionConfig   | 参数配置管理与预设            | src/config/             |
| MediaArchiveManager   | 媒体档案数据库管理            | src/archive/            |
| BatchTranscriptionManager | 批量转录任务调度         | src/batch/              |
| AudioWaveformWidget   | 音频波形显示控件              | src/widgets/            |
| NoisePreviewWidget    | 视频降噪预览控件              | src/widgets/            |

## 扩展开发

### 添加新的磁带类型预设
在 `TranscriptionConfig.cpp` 的 `initDefaultTapeModels()` 方法中添加新预设。

### 自定义降噪算法
在 `VideoNoiseReducer.cpp` 中扩展降噪算法，添加新的参数控制。

### 硬件协议扩展
在 `HardwareDriver.cpp` 中扩展命令ID和数据解析逻辑。

## 许可证

本项目专为复古媒体数字化场景开发，无通用模板限制。
