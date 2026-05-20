# Audio-Video Sync Evaluator

一个专业的音视频同步评测系统，基于唇形识别和音频分析来检测视频和音频的同步偏移量。

## 功能特性

- 🎬 **唇形识别**: 使用 face_recognition 库检测每一帧的嘴部关键点
- 🔊 **音频分析**: 使用 librosa 提取音频特征，计算能量包络
- 📊 **同步检测**: 通过互相关分析计算音频-视频偏移量（帧为单位）
- ⭐ **评分系统**: 0-100分的同步质量评分
- 📈 **可视化图表**: 显示音频波形、唇形活动曲线、同步评分曲线
- 📄 **PDF报表**: 自动生成详细的分析报告
- 🎥 **视频播放器**: 集成 video.js 播放视频和波形图

## 项目结构

```
p44/
├── backend/
│   ├── audio_vad/          # 音频处理模块
│   │   ├── __init__.py
│   │   └── audio_processor.py
│   ├── lip_detector/       # 唇形检测模块
│   │   ├── __init__.py
│   │   └── lip_detector.py
│   ├── sync_evaluator/     # 同步评测模块
│   │   ├── __init__.py
│   │   └── sync_evaluator.py
│   ├── reporter/           # 报表生成模块
│   │   ├── __init__.py
│   │   └── report_generator.py
│   ├── main.py             # FastAPI 主服务
│   └── requirements.txt    # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── App.vue         # 主应用组件
│   │   └── main.js         # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── uploads/                # 上传文件目录
└── results/                # 结果文件目录
```

## 安装和运行

### 后端安装

```bash
cd backend

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 注意：安装 dlib 和 face_recognition 可能需要额外的系统依赖
# macOS: brew install dlib
# Ubuntu: sudo apt-get install build-essential cmake libopenblas-dev liblapack-dev
```

### 运行后端

```bash
cd backend
python main.py
```

后端服务将在 http://localhost:8000 启动

### 前端安装

```bash
cd frontend
npm install
```

### 运行前端

```bash
cd frontend
npm run dev
```

前端服务将在 http://localhost:3000 启动

## API 端点

### 单文件评测
- `POST /api/evaluate` - 上传视频和音频文件进行同步评测
  - 参数: `video` (视频文件), `audio` (音频文件)

### 批量评测
- `POST /api/batch-evaluate` - 批量处理多个视频和音频文件
  - 参数: `videos` (视频文件列表), `audios` (音频文件列表)

### 报表生成
- `POST /api/generate-report` - 生成单文件PDF报告
- `POST /api/generate-batch-report` - 生成批量PDF报告
- `GET /api/download-report/{filename}` - 下载生成的报告

### 其他
- `GET /health` - 健康检查
- `GET /api/results` - 列出所有生成的结果文件

## 技术栈

### 后端
- **FastAPI**: Web 框架
- **librosa**: 音频处理和特征提取
- **face_recognition**: 人脸和唇形关键点检测
- **dlib**: 机器学习算法库
- **OpenCV**: 视频帧处理
- **SciPy**: 信号处理和互相关分析
- **ReportLab**: PDF 报表生成
- **Matplotlib**: 图表绘制

### 前端
- **Vue 3**: 前端框架
- **Vite**: 构建工具
- **Chart.js**: 图表可视化
- **Video.js**: 视频播放器
- **Axios**: HTTP 客户端
- **Wavesurfer.js**: 音频波形可视化

## 评分标准

| 分数范围 | 等级 | 说明 |
|---------|------|------|
| 85-100 | Excellent (优秀) | 音视频完全同步 |
| 70-84 | Good (良好) | 轻微偏移，不影响观看体验 |
| 50-69 | Fair (一般) | 明显偏移，需要注意 |
| 0-49 | Poor (较差) | 严重不同步，需要修复 |

## 使用说明

1. 启动后端服务和前端服务
2. 在浏览器中打开 http://localhost:3000
3. 上传视频文件和对应的音频文件
4. 点击 "Start Evaluation" 开始评测
5. 查看评测结果和可视化图表
6. 点击 "Generate PDF Report" 生成详细报告

## 注意事项

1. **依赖安装**: dlib 和 face_recognition 的安装可能需要较长时间和较多系统资源
2. **处理时间**: 视频处理时间取决于视频长度和帧率，长视频可能需要几分钟
3. **人脸检测**: 需要视频中清晰可见说话者的面部才能准确检测唇形
4. **文件大小**: 建议上传 1080p 分辨率、30fps、时长 1-5 分钟的视频以获得最佳效果

## GPU 显存管理

为了解决批量处理视频时的显存泄漏问题，系统内置了多层显存清理机制：

### 清理策略
| 触发时机 | 清理内容 |
|---------|---------|
| 单个视频处理中（每100帧）| 帧数据缓存 + Python GC |
| 单个视频处理完成 | PyTorch CUDA 缓存 + Python GC |
| 每处理 3 个视频 | 深度 CUDA 缓存清理 |
| 批量处理完成 | 全量清理 + 计数器重置 |
| API 请求结束 | 自动清理（evaluate/align）|

### 显存管理 API
```bash
# 查看GPU显存使用情况
GET /api/gpu-memory

# 手动触发显存清理
POST /api/cleanup-memory?force=true
```

### 测试脚本
```bash
cd backend
python test_memory_cleanup.py
```

### 预期效果
- 批量处理 10 个视频时，显存占用保持稳定
- 每个视频处理后释放约 150-200MB 显存
- 不会出现 OOM（内存不足）错误

## License

MIT
