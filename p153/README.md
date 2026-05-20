# 维吾尔语-汉语翻译系统

基于 PyTorch Transformer 的维吾尔语到汉语神经网络翻译系统，包含 Chrome 浏览器插件和 REST API。

## 功能特性

### 🧠 后端模型
- **Transformer 架构**: 基于 PyTorch 的 Transformer 编码器-解码器架构
- **回译数据增强**: 支持数据增强技术提高翻译质量
- **ONNX 量化**: 支持导出为 ONNX 格式并量化，支持离线部署

### 🌐 REST API
- **FastAPI 后端**: 高性能异步 API 服务
- **翻译接口**: POST /translate - 维吾尔语到汉语翻译
- **反馈接口**: POST /feedback - 用户反馈收集
- **健康检查**: GET /health - 服务状态检查

### 🔌 Chrome 浏览器插件
- **自动高亮**: 自动识别并高亮网页中的维吾尔语文本
- **悬浮气泡**: 点击高亮文本显示翻译气泡
- **快捷翻译**: 插件弹窗内支持快速翻译
- **自定义设置**: 可自定义高亮颜色、开关功能

### 💾 数据库
- **SQLite 存储**: 轻量级数据库存储用户反馈
- **评分系统**: 用户可对翻译质量进行 1-5 星评分

## 项目结构

```
p153/
├── backend/                    # 后端代码
│   ├── api/                    # API 服务
│   │   └── main.py            # FastAPI 主程序
│   ├── model/                  # 翻译模型
│   │   ├── transformer.py     # Transformer 模型定义
│   │   ├── tokenizer.py       # 分词器
│   │   ├── train.py           # 训练器
│   │   ├── back_translation.py # 数据增强
│   │   └── onnx_export.py     # ONNX 导出
│   ├── train_model.py         # 训练脚本
│   ├── export_onnx.py         # ONNX 导出脚本
│   ├── run_api.sh             # API 启动脚本
│   └── requirements.txt       # Python 依赖
├── frontend/                   # 前端代码
│   └── chrome-extension/      # Chrome 插件
│       ├── manifest.json      # 插件配置
│       ├── popup.html         # 弹窗页面
│       ├── popup.js           # 弹窗逻辑
│       ├── content.js         # 内容脚本
│       ├── content.css        # 内容样式
│       ├── background.js      # 后台脚本
│       └── icons/             # 图标目录
├── model/                      # 模型存储
│   ├── checkpoints/           # PyTorch 模型
│   └── onnx/                  # ONNX 模型
└── README.md
```

## 快速开始

### 1. 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 训练翻译模型

```bash
cd backend
python train_model.py
```

### 3. 启动 API 服务

```bash
cd backend
bash run_api.sh
```

API 服务将在 `http://localhost:8000` 启动

### 4. 安装 Chrome 插件

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `frontend/chrome-extension` 目录

## API 文档

启动服务后访问 `http://localhost:8000/docs` 查看完整的 API 文档。

### 翻译接口

```bash
curl -X POST "http://localhost:8000/translate" \
     -H "Content-Type: application/json" \
     -d '{"text": "سالام", "source_lang": "ug", "target_lang": "zh"}'
```

响应:
```json
{
  "original_text": "سالام",
  "translated_text": "你好",
  "source_lang": "ug",
  "target_lang": "zh"
}
```

### 提交反馈

```bash
curl -X POST "http://localhost:8000/feedback" \
     -H "Content-Type: application/json" \
     -d '{
       "original_text": "سالام",
       "translated_text": "你好",
       "rating": 5,
       "comment": "翻译准确",
       "source_type": "web"
     }'
```

### 查看反馈

```bash
curl "http://localhost:8000/feedback"
```

## 导出 ONNX 模型

```bash
cd backend
python export_onnx.py
```

模型将导出到 `model/onnx/` 目录，包含:
- `encoder.onnx` - 编码器
- `decoder.onnx` - 解码器
- `full_model.onnx` - 完整模型

## 技术栈

**后端**:
- PyTorch 2.0 - 深度学习框架
- FastAPI - Web 框架
- Uvicorn - ASGI 服务器
- SQLAlchemy - ORM
- ONNX Runtime - 推理引擎

**前端**:
- JavaScript (ES6+)
- Chrome Extension API
- CSS3

## 注意事项

1. 本项目使用字符级别的简单分词器，如需更好效果可接入专业分词工具
2. 提供的样例数据仅用于演示，实际使用需要大量平行语料训练
3. 建议使用 GPU 进行模型训练以获得更好的性能
4. 生产环境部署时请使用适当的安全配置

## License

MIT License
