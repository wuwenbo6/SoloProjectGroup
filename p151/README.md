# 舆情监控系统

基于Python + FastAPI + Elasticsearch + Redis的社交媒体舆情监控系统，支持Twitter、Reddit、Telegram等平台的数据采集和分析。

## 功能特性

### 数据采集
- 🌐 **多平台支持**: Twitter、Reddit、Telegram
- 🔍 **关键词搜索**: 自定义关键词采集
- ⚡ **实时爬取**: 按需触发数据采集

### NLP分析
- 🎭 **情感分析**: 正面/中性/负面情感识别
- 🏷️ **实体提取**: 自动识别帖子中的关键词实体
- 📊 **智能分类**: 基于内容的自动标签

### 数据可视化
- 📈 **舆情趋势图**: 时间序列分析，展示舆情变化趋势
- ☁️ **词云**: 热门关键词可视化
- 🌍 **地理分布**: 基于位置的数据分布
- 📊 **平台分布**: 各平台数据占比统计
- 🎯 **情感分布**: 饼图展示情感比例

### 监控报警
- 🔔 **关键词监控**: 自定义监控关键词
- 🚨 **实时报警**: 阈值触发报警机制
- 👤 **用户管理**: 基于OAuth的用户认证

### 高级分析功能
- 🕵️ **谣言检测**: 基于传播网络分析的谣言识别，多维度风险评估
  - 网络结构分析: 节点度、连通性、聚类系数
  - 传播速度检测: 爆炸性增长识别
  - 跨平台扩散追踪
  - 关键传播节点识别
  - 内容模式匹配（耸人听闻语言、模糊来源等）

- 📊 **影响力量化**: 粉丝数 × 参与度模型，多维度影响力评估
  - 覆盖人数预估
  - 曝光量计算
  - 互动率统计
  - 病毒传播指数
  - 影响力等级分类（本地/区域/全国/全球）
  - 平台贡献度分解
  - 关键影响者识别

- 📄 **PDF报告生成**: 一键生成专业分析报告，包含完整可视化
  - 执行摘要与风险评级
  - 传播趋势图表
  - 情感分布分析
  - 平台分布统计
  - 谣言风险仪表盘
  - 关键传播者列表
  - 建议与行动方案

## 技术栈

### 后端
- **FastAPI**: 高性能Web框架
- **Elasticsearch**: 全文搜索和分析引擎
- **Redis**: 缓存和会话存储
- **TextBlob/NLTK**: 自然语言处理
- **VADER**: 社交媒体情感分析
- **NetworkX**: 传播网络分析与图算法
- **ReportLab**: PDF报告生成
- **Matplotlib**: 数据可视化图表

### 前端
- **HTML5 + Tailwind CSS**: 现代化UI
- **Chart.js**: 数据可视化图表
- **原生JavaScript**: 轻量无依赖

### 基础设施
- **Docker**: 容器化部署
- **Docker Compose**: 服务编排

## 快速开始

### 环境要求
- Docker & Docker Compose
- Python 3.9+
- pip

### 启动方式

#### 方式一：一键启动（推荐）
```bash
chmod +x start.sh
./start.sh
```

#### 方式二：手动启动
1. **启动基础设施**
```bash
docker-compose up -d
```

2. **安装Python依赖**
```bash
pip install -r requirements.txt
```

3. **启动后端服务**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问地址
- 🌐 **管理后台**: http://localhost:8000/dashboard
- 📚 **API文档**: http://localhost:8000/docs
- 🔍 **Elasticsearch**: http://localhost:9200

## API接口

### 认证
- `POST /api/auth/token`: 获取访问令牌
- `GET /api/auth/me`: 获取当前用户信息

### 帖子管理
- `POST /api/posts/`: 创建帖子
- `GET /api/posts/{id}`: 获取帖子详情
- `GET /api/posts/`: 搜索帖子（支持关键词、平台、情感筛选）

### 数据采集
- `POST /api/crawlers/crawl`: 触发爬虫采集
- `GET /api/crawlers/status/{platform}`: 获取爬虫状态

### 分析接口
- `GET /api/analytics/trends`: 获取舆情趋势数据
- `GET /api/analytics/wordcloud`: 获取词云数据
- `GET /api/analytics/geography`: 获取地理分布数据

### 报警管理
- `POST /api/alerts/keywords`: 添加监控关键词
- `GET /api/alerts/keywords/{user_id}`: 获取用户监控关键词
- `DELETE /api/alerts/keywords/{id}`: 删除监控关键词
- `GET /api/alerts/{user_id}`: 获取报警列表

## 项目结构

```
p151/
├── backend/
│   └── app/
│       ├── api/              # API路由
│       │   ├── auth.py       # 认证接口
│       │   ├── posts.py      # 帖子管理
│       │   ├── crawlers.py   # 爬虫控制
│       │   ├── analytics.py  # 数据分析
│       │   └── alerts.py     # 报警管理
│       ├── core/             # 核心模块
│       │   ├── config.py     # 配置管理
│       │   ├── database.py   # 数据库连接
│       │   └── security.py   # 安全认证
│       ├── crawlers/         # 爬虫模块
│       │   ├── base.py       # 爬虫基类
│       │   ├── twitter.py    # Twitter爬虫
│       │   ├── reddit.py     # Reddit爬虫
│       │   └── telegram.py   # Telegram爬虫
│       ├── nlp/              # NLP处理
│       │   └── processor.py  # 文本处理器
│       ├── schemas/          # 数据模型
│       │   ├── post.py       # 帖子模型
│       │   └── alert.py      # 报警模型
│       └── main.py           # 应用入口
├── static/                   # 前端静态文件
│   ├── index.html            # 主页面
│   ├── css/                  # 样式文件
│   └── js/                   # JavaScript文件
├── docker-compose.yml        # Docker编排
├── requirements.txt          # Python依赖
├── .env.example             # 环境变量示例
└── start.sh                 # 启动脚本
```

## 配置说明

复制 `.env.example` 为 `.env` 并配置相关参数：

```env
# API密钥配置
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret

REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash

# 邮件报警配置
ALERT_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_email_password
```

**注意**: 系统已内置模拟数据生成器，无需配置真实API密钥即可演示功能。

## 使用说明

1. **数据采集**: 在管理后台选择平台，输入关键词，点击"开始采集"
2. **查看趋势**: 仪表盘自动展示最新的舆情趋势和情感分布
3. **添加监控**: 在关键词监控区域输入需要监控的关键词
4. **浏览数据**: 页面底部展示最新采集的帖子列表，包含情感标签

## 开发计划

- [ ] 集成更多社交媒体平台
- [ ] 高级NLP分析（主题建模、情感强度）
- [ ] 实时数据推送（WebSocket）
- [ ] 数据导出功能
- [ ] 报警通知（邮件、短信、Webhook）
- [ ] 用户权限管理
- [ ] 历史数据回溯

## 许可证

MIT License
