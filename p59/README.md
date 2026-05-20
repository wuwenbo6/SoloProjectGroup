# 胶片转录修复工具

跨平台桌面工具，适配老式手摇放映机的USB/串口连接，支持实时采集胶片视频与音频，自动去除划痕、褪色、杂音。

## 功能特性

### 1. 硬件驱动模块 (`hardware/`)

- **多型号放映机识别**: 支持 Bell & Howell、Kodak Pageant、Eumig Super8、Bauer T1 等主流型号
- **双连接协议**: 支持 USB 和串口通信，自动检测连接类型
- **协议适配**: 内置多种放映机通信协议处理器，自动识别匹配
- **实时状态监控**: 监控设备连接状态、电机速度、温度等参数

### 2. 视频色彩校正模块 (`video/`)

- **胶片专用参数**: 预设 Kodachrome、Ektachrome、Fujichrome 等胶片类型色彩参数
- **多通道校正**: 独立的 R/G/B 通道增益、偏移、Gamma 调节
- **自动白平衡**: 基于灰度世界算法的自动白平衡
- **曝光校正**: 自动调整曝光与对比度
- **褪色修复**: LAB 色彩空间的色偏智能修复

### 3. 划痕修复算法 (`restoration/`)

- **多尺度检测**: 3级金字塔多尺度划痕检测
- **方向感知检测**: 垂直/水平方向的专门检测卷积核
- **霍夫变换检测**: 线性划痕的精准定位
- **智能修复**: 结合边缘感知的图像修复算法
- **划痕类型分类**: 识别直线划痕、卷曲、斑点、毛发等不同类型

### 4. 批量转录模块 (`transcription/`)

- **进程监控**: 实时监控处理进程，超时自动检测
- **异常捕获**: 完整的异常处理机制，防止程序崩溃
- **自动重试**: 失败任务自动重试，指数退避策略
- **断点续传**: 支持检查点保存与恢复
- **输出验证**: 自动验证输出文件完整性
- **进度回调**: 实时进度通知机制

### 5. 音频降噪修复 (`audio/`)

- **多类型噪声去除**: 磁带嘶嘶声、交流哼声、咔嗒声、爆音
- **频谱降噪**: 基于 FFT 的谱减法降噪
- **点击检测与修复**: 智能检测并插值修复音频咔嗒声
- **动态范围压缩**: 自动音量平衡与压缩
- **波形处理**: 静音去除、淡入淡出、音量调节

### 6. 本地档案管理 (`database/`)

- **放映机配置管理**: 保存不同型号的转录参数配置
- **转录记录**: 完整的任务记录与状态追踪
- **胶片库存管理**: 胶片信息、数字化状态、存储位置
- **统计分析**: 数字化进度、存储空间、质量统计
- **数据导入导出**: 配置的 JSON 备份与恢复

## 项目结构

```
p59/
├── hardware/
│   ├── __init__.py
│   └── projector_driver.py    # 放映机驱动与通信
├── video/
│   ├── __init__.py
│   └── color_correction.py    # 色彩校正与修复
├── restoration/
│   ├── __init__.py
│   └── scratch_removal.py     # 划痕检测与修复
├── transcription/
│   ├── __init__.py
│   └── batch_processor.py     # 批量转录与任务管理
├── audio/
│   ├── __init__.py
│   └── noise_reduction.py     # 音频降噪处理
├── database/
│   ├── __init__.py
│   └── archive_manager.py     # 本地档案数据库管理
├── main.py                     # 主入口文件
├── requirements.txt            # Python 依赖
└── README.md                   # 本文件
```

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 基本使用

```python
from main import main

# 初始化所有模块
modules = main()

# 访问各模块
archive = modules['archive_manager']
projector = modules['projector_driver']
color = modules['color_corrector']
scratch = modules['scratch_detector']
audio = modules['audio_reducer']
batch = modules['batch_processor']
```

### 放映机连接示例

```python
from hardware.projector_driver import ProjectorDriver

driver = ProjectorDriver()

# 检测设备
projectors = driver.detect_projectors()
print(f"找到 {len(projectors)} 台设备")

# 连接第一台设备
if projectors:
    driver.connect(projectors[0])
    status = driver.get_status()
    print(f"设备状态: {status}")

    # 开始采集
    driver.start_motor()
    driver.lamp_on()
```

### 色彩校正示例

```python
from video.color_correction import FilmColorCorrector, FilmStock
import cv2

corrector = FilmColorCorrector()

# 设置胶片类型
corrector.set_film_stock(FilmStock.KODACHROME)

# 处理一帧图像
frame = cv2.imread("film_frame.jpg")
corrected = corrector.correct_frame(frame)

# 自动白平衡
params = corrector.auto_white_balance(frame)
print(f"自动参数: {params}")
```

### 划痕修复示例

```python
from restoration.scratch_removal import MultiScaleScratchDetector, ScratchDetectionParams
import cv2

detector = MultiScaleScratchDetector()

# 设置检测参数
params = ScratchDetectionParams(
    sensitivity=0.6,
    multi_scale_levels=3,
    enable_hough_transform=True
)
detector.set_detection_params(params)

# 处理图像
frame = cv2.imread("scratched_frame.jpg")
restored, scratches, mask = detector.detect_and_remove(frame)

print(f"检测到 {len(scratches)} 处划痕")
```

### 批量转录示例

```python
from transcription.batch_processor import BatchTranscriptionProcessor, ProcessingOptions

processor = BatchTranscriptionProcessor(output_dir="./output")

# 添加任务
processor.add_task("input_video1.mp4")
processor.add_task("input_video2.mp4")

# 设置处理选项
options = ProcessingOptions(
    enable_color_correction=True,
    enable_scratch_removal=True,
    enable_audio_denoise=True,
    output_resolution=(1920, 1080),
    fps=24.0
)

# 开始批量处理
results = processor.process_all(options)
processor.save_report("./report.json")
```

## 支持的放映机型号

| 型号 | 连接类型 | 协议 | 速度范围 |
|------|---------|------|---------|
| Bell & Howell 16mm | USB/Serial | 二进制协议 | 12-24 fps |
| Kodak Pageant | USB/Serial | 二进制协议 | 16-30 fps |
| Eumig Super8 | Serial | ASCII 协议 | 18-24 fps |
| Bauer T1 | USB | 二进制协议 | 18-25 fps |

## 支持的胶片类型

- Kodachrome (彩色正片)
- Ektachrome (彩色正片)
- Fujichrome (彩色正片)
- Agfacolor (彩色正片)
- 黑白胶片

## 数据存储

本地数据库默认位置: `./data/film_archive.db` (SQLite)

包含以下数据表:
- `projector_configs`: 放映机配置
- `transcription_records`: 转录记录
- `film_inventory`: 胶片库存
- `batch_jobs`: 批量任务

## 技术栈

- **OpenCV**: 图像处理与计算机视觉
- **NumPy**: 数值计算
- **PySerial**: 串口通信
- **PyUSB**: USB 通信
- **SQLite**: 本地数据库

## 许可证

本项目仅供学习与研究使用。
