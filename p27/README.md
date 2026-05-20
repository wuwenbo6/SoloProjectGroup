# 企业级文档问答系统

基于 FastAPI + Vue3 + LayoutLMv3 + Elasticsearch + LLaMA 的智能文档问答系统。

## 功能特性

- 📄 **多格式支持**: 支持 PDF、PNG、JPG、JPEG、TIFF 等多种文档格式
- 🔍 **OCR识别**: 集成 Tesseract OCR，支持中英文文档识别
- 🧠 **版面分析**: 使用 LayoutLMv3 进行文档版面分析和实体抽取
  - 日期抽取 (DATE)
  - 金额抽取 (AMOUNT)
  - 合同号抽取 (CONTRACT)
- 🗄️ **向量检索**: Elasticsearch + FAISS 实现高效向量检索
- 🤖 **智能问答**: 本地部署 LLaMA 模型，基于检索结果生成答案
- 🎨 **现代UI**: Vue3 + Element Plus 打造精美用户界面

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vue3 前端     │───▶│  FastAPI 后端   │───▶│  Elasticsearch  │
│  (Element Plus) │    │   (API 服务)    │    │  (向量存储)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Tesseract OCR  │    │ LayoutLMv3 模型 │    │   LLaMA 模型    │
│   (文本识别)    │    │   (实体抽取)    │    │   (答案生成)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 快速开始

### 方式一：Docker Compose 部署 (推荐)

```bash
# 克隆项目
git clone <repository-url>
cd p27

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 访问前端
open http://localhost

# 访问 API 文档
open http://localhost:8000/docs
```

### 方式二：手动部署

#### 后端部署

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 安装系统依赖 (Ubuntu/Debian)
sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim poppler-utils

# 启动 Elasticsearch
docker run -d \
  -p 9200:9200 \
  -e discovery.type=single-node \
  -e xpack.security.enabled=false \
  elasticsearch:8.11.0

# 启动后端
python main.py
```

#### 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 生产构建
npm run build
```

## 项目结构

```
p27/
├── backend/
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py       # 配置管理
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── models.py         # Pydantic 数据模型
│   ├── services/
│   │   ├── __init__.py
│   │   ├── document_parser.py # 文档解析服务
│   │   ├── ocr_service.py     # OCR 识别服务
│   │   ├── table_detector.py  # 🆕 表格检测服务 (Table Transformer)
│   │   ├── entity_alignment.py # 🆕 实体对齐服务
│   │   ├── layoutlm_service.py # LayoutLM 实体抽取服务 (已重构)
│   │   ├── vector_store.py    # 向量存储服务
│   │   └── rag_pipeline.py    # RAG 问答流水线
│   ├── main.py                # FastAPI 主入口
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── QAPage.vue       # 问答页面
│   │   │   ├── UploadPage.vue   # 上传页面
│   │   │   └── DocumentsPage.vue # 文档管理页面
│   │   ├── router/
│   │   │   └── index.js
│   │   ├── api/
│   │   │   └── index.js
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## Bug 修复说明

### 问题描述
当文档包含多列表格时，LayoutLM 抽取的实体会出现错位问题：
- 金额跑到下一行
- 日期和数值关联错误
- 跨单元格实体被错误拆分

### 根本原因
预处理阶段未保留表格结构信息，导致 LayoutLM 无法理解表格行列关系。

### 解决方案
1. **集成 Table Transformer**: 基于微软的表格检测和结构识别模型
   - 自动检测文档中的表格区域
   - 识别表格的行列结构
   - 单元格级别的精确边界定位

2. **表格/非表格分离处理**:
   - 将 OCR 结果分为表格内和表格外两部分
   - 表格内词语按单元格分组处理
   - 保留原始版面空间关系

3. **实体对齐逻辑重构**:
   - 基于单元格位置的实体分组
   - 表头关键词上下文验证
   - 跨单元格实体合并优化
   - 重复实体去重机制

## API 接口

### 文档上传
```http
POST /api/upload
Content-Type: multipart/form-data

file: <document-file>
```

### 文档问答
```http
POST /api/query
Content-Type: application/json

{
  "query": "合同金额是多少？",
  "document_id": "optional-document-id"
}
```

### 获取文档列表
```http
GET /api/documents
```

### 删除文档
```http
DELETE /api/documents/{document_id}
```

## 配置说明

### 环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```env
# Elasticsearch
ELASTICSEARCH_HOST=http://localhost:9200

# Tesseract
TESSERACT_CMD=/usr/bin/tesseract
TESSERACT_LANG=chi_sim+eng

# LLaMA
LLAMA_MODEL_PATH=models/llama-2-7b-chat.gguf
LLAMA_N_CTX=2048
LLAMA_TEMPERATURE=0.7

# 文件上传
MAX_FILE_SIZE=104857600
ALLOWED_EXTENSIONS=pdf,png,jpg,jpeg,tiff
```

### 模型下载

1. **LayoutLMv3**: 首次运行时自动从 Hugging Face 下载
2. **Embedding 模型**: 首次运行时自动下载
3. **LLaMA 模型**: 需手动下载并放置于 `backend/models/` 目录

## 性能优化建议

1. **GPU 加速**: 安装 CUDA 版本的 PyTorch 可大幅提升推理速度
2. **批量处理**: 大文档可采用批量 OCR 和分批嵌入
3. **缓存策略**: 对高频查询结果进行缓存
4. **模型量化**: 对 LLaMA 进行量化减少内存占用

## 常见问题

### 1. Tesseract 语言包安装失败
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr-chi-sim

# CentOS/RHEL
sudo yum install tesseract-langpack-chi_sim
```

### 2. Elasticsearch 启动失败
确保系统的 `vm.max_map_count` 配置足够：
```bash
sudo sysctl -w vm.max_map_count=262144
```

### 3. 内存不足
- 减小 LLaMA 模型上下文大小 `LLAMA_N_CTX`
- 使用量化后的 LLaMA 模型
- 减小 Elasticsearch 的 JVM 堆内存

## 技术栈

**后端**:
- FastAPI 0.104
- PyTorch 2.1
- Transformers 4.35
- Elasticsearch 8.11
- Tesseract OCR

**前端**:
- Vue 3.3
- Vue Router 4
- Element Plus 2.3
- Axios
- Vite

## 许可证

MIT License
