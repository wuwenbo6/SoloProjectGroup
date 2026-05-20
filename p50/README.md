# 方言语音合成系统

> 小众方言保护项目 - 采用"前端交互控制台+后端模型服务+本地推理模块"多层架构

## 项目架构

```
p50/
├── frontend/                 # 前端Vue3+Element Plus
│   ├── src/
│   │   ├── views/      # 页面组件
│   │   ├── router/     # 路由配置
│   │   └── utils/      # 工具函数
│   └── package.json
├── backend/              # 后端FastAPI服务
│   ├── api/           # API路由
│   ├── models/        # 数据模型
│   ├── services/      # 核心服务
│   ├── config/        # 配置文件
│   └── requirements.txt
├── local_inference/    # 本地推理模块
│   └── offline_synthesizer.py
└── database/           # 数据库文件
```

## 功能模块

### 1. 语音采集模块
- 音频文件上传支持（WAV、MP3等格式
- 语料元数据管理（文本、说话人、方言ID）
- 音频预览和验证

### 2. 语调特征提取模块
- MFCC特征提取
- 基频(F0)轮廓分析
- 能量特征提取
- 语速和韵律分析
- 语谱图生成

### 3. Transformer合成模型
- 基于Transformer的TTS模型
- 方言风格迁移
- 情感参数调节（情感、语速、音调）
- 实时合成任务队列

### 4. 语音修复模块
- 噪声抑制
- 平滑过渡
- 清晰度增强
- 音量归一化
- 静音填充
- 质量评估

### 5. 方言知识库模块
- 闽语分支（福州话、厦门话、莆田话等）
- 湘语分支（长沙话、双峰话等）
- 语调模式库
- 方言元数据管理

## 快速开始

### 方式一：一键启动

```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

**后端服务：**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**前端服务：**

```bash
cd frontend
npm install
npm run dev
```

## 访问地址

- 前端界面: http://localhost:3000
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs

## 功能页面

1. **语音合成** - 选择方言，输入文本，调节参数合成语音
2. **音频采集** - 上传方言语料，提取特征
3. **方言知识库** - 管理方言信息和语调模式
4. **语音修复** - 上传音频进行质量优化
5. **任务列表** - 查看合成任务状态

## 本地推理使用

```python
from local_inference.offline_synthesizer import OfflineSynthesizer

synthesizer = OfflineSynthesizer()
synthesizer.load_model()

result = synthesizer.synthesize(
    text="你好，这是福州话",
    dialect_id=1,
    output_path="output.wav"
)
```

## 技术栈

**前端：**
- Vue 3
- Element Plus
- Vue Router
- Axios

**后端：**
- FastAPI
- SQLAlchemy
- PyTorch / Transformers
- Librosa
- NumPy / SciPy

**本地推理：**
- 轻量级推理引擎
- 支持离线运行
- 适配低配置设备

## 数据库

SQLite数据库，包含以下表：
- dialects - 方言信息
- corpora - 方言语料
- audio_features - 音频特征
- intonation_patterns - 语调模式
- synthesis_tasks - 合成任务
- repair_records - 修复记录

## 支持的小众方言

1. **闽语分支**
   - 福州话 (闽东语)
   - 厦门话 (闽南语)
   - 莆田话 (莆仙语)

2. **湘语分支**
   - 长沙话 (长益片)
   - 双峰话 (娄邵片)

## 开发说明

- 项目采用模块化设计，各模块独立可扩展
- 支持添加新的方言和语调模式
- 本地推理模块可独立部署
- 支持批量处理和任务队列机制
- 完善的API接口文档
