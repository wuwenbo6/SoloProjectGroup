# 打字机数字化系统

基于Qt+Python开发的跨平台桌面应用，专为老式打字机数字化场景设计。

## 功能特性

### 1. 硬件驱动对接模块
- 支持USB/串口连接机械打字机、电动打字机
- 自动检测可用串口设备
- 实时数据读取与传输
- 连接状态监控

### 2. 字符采集模块
- 实时采集打字机敲击字符
- 字符预览与实时显示
- 采集状态监控
- 字符校正功能

### 3. 图像识别模块
- 自动识别字符样式
- 字体类型检测（Courier、Typewriter Classic等）
- 置信度评估
- 笔画宽度、衬线等特征提取

### 4. 数字化转录模块
- 文本编辑与校正
- 批量编辑功能
- 导出为TXT格式
- 导出为PDF格式（保留打字机样式）
- 导出为JSON格式（包含元数据）

### 5. 本地档案管理模块
- SQLite本地数据库存储
- 文档分类管理
- 打字机型号管理
- 文档搜索功能
- 统计信息展示

## 项目结构

```
p53/
├── main.py                          # 应用入口
├── requirements.txt                 # 依赖包
├── README.md                       # 项目说明
├── hardware/
│   ├── __init__.py
│   └── typewriter_driver.py        # 硬件驱动
├── capture/
│   ├── __init__.py
│   └── character_capture.py        # 字符采集
├── recognition/
│   ├── __init__.py
│   └── character_recognizer.py     # 图像识别
├── transcription/
│   ├── __init__.py
│   └── document_exporter.py        # 文档导出
├── database/
│   ├── __init__.py
│   └── models.py                   # 数据库模型
└── ui/
    ├── __init__.py
    ├── main_window.py              # 主窗口
    ├── capture_widget.py           # 采集界面
    ├── transcription_widget.py     # 转录界面
    └── archive_widget.py           # 档案管理界面
```

## 安装与运行

### 环境要求
- Python 3.8+
- PyQt6
- 其他依赖见 requirements.txt

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行应用

```bash
python main.py
```

## 使用说明

### 1. 连接设备
1. 点击"连接设备"按钮
2. 选择对应的串口和波特率
3. 等待连接成功提示

### 2. 字符采集
1. 连接设备后点击"开始采集"
2. 在打字机上输入字符
3. 实时预览采集结果
4. 对识别错误的字符进行校正

### 3. 转录编辑
1. 在"转录编辑"标签页编辑文本
2. 填写文档信息（标题、打字机型号、字体类型等）
3. 选择导出格式（TXT/PDF/JSON）
4. 或保存到本地档案

### 4. 档案管理
1. 在"档案管理"标签页查看所有文档
2. 搜索文档
3. 查看文档详情
4. 添加打字机型号信息

## 技术栈

- **GUI框架**: PyQt6
- **串口通信**: pyserial
- **图像处理**: OpenCV, Pillow
- **数据库**: SQLAlchemy + SQLite
- **PDF生成**: reportlab

## 数据存储

应用数据存储在用户主目录下的 `.typewriter_digitizer` 文件夹中：
- `typewriter.db` - SQLite数据库文件
- 包含文档、字符、打字机型号等数据

## 开发说明

本项目专为老式打字机数字化冷门场景开发，无通用桌面模板。设计考虑了机械打字机的特殊字符样式和输入特性。

### 字体类型支持
- Courier
- Courier Bold
- Times New Roman
- Typewriter Classic
- Mechanical Typewriter
- Electric Typewriter

## 许可证

MIT License
