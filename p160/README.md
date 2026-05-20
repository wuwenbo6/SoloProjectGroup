# Knowledge Graph Studio

一个全栈知识图谱应用，支持从文本中抽取实体、构建知识图谱、AI辅助生成关系和事件、3D可视化展示。

## 功能特性

- **实体抽取**: 使用 spaCy 从文本中自动识别人物(PERSON)、地点(GPE)、组织(ORG)等实体
- **知识图谱存储**: 使用 Neo4j 图数据库存储实体和关系
- **3D 可视化**: 使用 3D 力导向图展示知识图谱
- **AI 辅助功能**: 
  - GPT 自动生成实体间关系
  - AI 生成故事事件
  - 世界设定智能扩展
  - 关系自动补全
- **导出功能**: 支持导出为 JSON 和 Markdown 格式
- **世界设定管理**: 存储和管理虚构世界的设定信息

## 技术栈

### 后端
- Python 3.9+
- FastAPI - Web 框架
- spaCy - NLP 实体抽取
- Neo4j - 图数据库
- OpenAI GPT API - AI 生成

### 前端
- React 18
- Material-UI - UI 组件库
- 3D Force Graph - 3D 力导向图
- Three.js - 3D 渲染

## 快速开始

### 前置要求

1. 安装 Neo4j 数据库并启动
2. 获取 OpenAI API Key
3. 安装 Node.js 16+ 和 Python 3.9+

### 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并配置:

```bash
cd backend
cp .env.example .env
```

编辑 `.env`:
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
```

### 启动后端服务

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档将在 http://localhost:8000/docs 可用

### 安装前端依赖

```bash
cd frontend
npm install
```

### 启动前端开发服务器

```bash
cd frontend
npm start
```

应用将在 http://localhost:3000 打开

## 使用说明

### 1. 实体抽取

1. 在左侧面板的 "Text Input & Entity Extraction" 区域输入文本
2. 点击 "Extract Entities" 按钮
3. 系统将识别并显示人物、地点、组织等实体
4. 点击 "Add to Graph" 将实体添加到知识图谱

### 2. AI 生成关系

1. 抽取实体后，点击 "AI Generate Relationships"
2. 系统将使用 GPT 生成实体间的合理关系
3. 点击 "Add to Graph" 将关系添加到图谱中

### 3. 手动创建实体和关系

- 使用 "Add Entity Manually" 面板手动添加实体
- 使用 "Create Relationship" 面板创建实体间的关系
- 点击 ✨ 按钮可以让 AI 自动补全关系名称

### 4. 世界构建

1. 切换到 "World" 标签页
2. 添加世界设定（名称和描述）
3. 使用 "AI Expand" 功能让 GPT 丰富世界设定
4. 点击 "Generate Events" 基于当前实体和设定生成故事事件

### 5. 3D 图谱操作

- 鼠标拖拽旋转视角
- 滚轮缩放
- 点击节点查看详情
- 拖拽节点调整位置
- 使用右上角按钮:
  - 🔍 自适应视图
  - 🔄 刷新图谱
  - 🗑️ 删除选中节点

### 6. 数据导入导出

切换到 "Export" 标签页:
- 导出为 JSON 格式（完整数据）
- 导出为 Markdown 格式（可读文档）
- 从 JSON 文件导入数据
- 清空所有数据

## API 接口

### 实体抽取
- `POST /extract/entities` - 抽取实体
- `POST /extract/relationships` - 抽取关系
- `POST /extract/all` - 抽取实体和关系

### 图谱操作
- `GET /graph` - 获取完整图谱数据
- `POST /entities` - 添加实体
- `DELETE /entities` - 删除实体
- `POST /relationships` - 添加关系
- `DELETE /relationships` - 删除关系

### AI 生成
- `POST /generate/relationships` - 生成关系
- `POST /generate/events` - 生成事件
- `POST /generate/expand-world` - 扩展世界设定
- `POST /generate/autocomplete-relation` - 关系补全

### 世界设定
- `GET /world-settings` - 获取所有设定
- `POST /world-settings` - 添加设定

### 导入导出
- `GET /export/json` - 导出 JSON
- `GET /export/markdown` - 导出 Markdown
- `POST /import/json` - 导入 JSON

## 项目结构

```
p160/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 主应用
│   │   ├── entity_extractor.py  # spaCy 实体抽取
│   │   ├── neo4j_db.py          # Neo4j 数据库操作
│   │   ├── gpt_generator.py     # GPT API 集成
│   │   └── exporter.py          # 导出功能
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GraphView.js         # 3D 图谱视图
│   │   │   ├── EntityPanel.js       # 实体操作面板
│   │   │   ├── WorldSettingPanel.js # 世界设定面板
│   │   │   └── ExportPanel.js       # 导出面板
│   │   ├── services/
│   │   │   └── api.js               # API 服务
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── README.md
```

## 注意事项

1. 确保 Neo4j 数据库已启动并可访问
2. OpenAI API Key 需要有足够的额度
3. 首次运行会自动下载 spaCy 模型
4. 大型图谱可能需要更多内存
5. 建议使用现代浏览器以获得最佳 3D 体验

## 许可证

MIT License
