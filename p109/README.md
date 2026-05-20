# 古籍数字化平台

一个完整的古籍数字化协作平台，支持扫描件上传、图像倾斜矫正、文字分行识别、断句标注和多人协作校对。

## 功能特性

- 📚 **书籍管理** - 创建和管理古籍书籍
- 📤 **文件上传** - 批量上传古籍扫描件
- 🔧 **图像矫正** - 自动倾斜矫正和透视变换
- 📝 **文字识别** - 自动文字分行和 OCR 识别
- ✏️ **断句标注** - 可视化标注界面，支持标点符号添加
- 👥 **多人协作** - 支持多人同时校对
- 📋 **版本管理** - 完整的标注历史记录

## 技术架构

### 后端服务

| 服务 | 技术栈 | 端口 | 说明 |
|------|---------|------|------|
| 用户服务 | Node.js + Express + PostgreSQL + Redis | 3001 | 用户认证与权限管理 |
| 图像矫正服务 | Python + Flask + OpenCV | 3002 | 图像倾斜矫正和增强 |
| 文字分割服务 | Python + Flask + Tesseract OCR | 3003 | 文字分行和识别 |
| API 网关 | Node.js + Express + MinIO | 3000 | API 路由和文件存储 |

### 前端

- React 18 + React Router
- Vite 构建工具
- Axios HTTP 客户端

### 基础设施

- PostgreSQL - 关系型数据库
- Redis - 缓存和会话管理
- MinIO - 对象存储（存储扫描图像）

## 快速开始

### 环境要求

- Docker
- Docker Compose

### 启动服务

```bash
# 克隆项目并进入目录
cd p109

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端应用 | http://localhost:5173 | 主应用界面 |
| API 网关 | http://localhost:3000 | API 接口 |
| MinIO 控制台 | http://localhost:9001 | 对象存储管理 |
| PostgreSQL | localhost:5432 | 数据库 |
| Redis | localhost:6379 | 缓存 |

### MinIO 登录信息

- 用户名: `minioadmin`
- 密码: `minioadmin`

## 使用流程

### 1. 注册和登录

1. 访问 http://localhost:5173
2. 点击注册，创建新账号
3. 使用注册的账号登录

### 2. 创建书籍

1. 登录后进入书籍列表页面
2. 点击"创建书籍"按钮
3. 填写书籍信息（名称、作者、朝代、描述）
4. 提交创建

### 3. 上传扫描件

1. 进入书籍详情页面
2. 设置起始页码
3. 选择一个或多个图像文件上传
4. 等待上传完成

### 4. 图像矫正

1. 在页面列表中找到"已上传"状态的页面
2. 点击"开始矫正"按钮
3. 等待矫正完成，状态变为"已矫正"

### 5. 文字分割

1. 找到"已矫正"状态的页面
2. 点击"开始分割"按钮
3. 系统自动进行文字分行和 OCR 识别
4. 完成后状态变为"已分割"

### 6. 标注校对

1. 点击"开始标注"进入标注页面
2. 左侧显示原图，右侧显示识别的文字行
3. 点击任意文字行进行编辑
4. 使用标点按钮快速添加句读符号
5. 点击"保存"保存修改

## 项目结构

```
p109/
├── docker-compose.yml          # Docker 编排配置
├── database/
│   └── init/
│       └── 01-init.sql        # 数据库初始化脚本
├── services/
│   ├── api-gateway/            # API 网关服务
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── index.js
│   ├── user-service/           # 用户服务
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── index.js
│   ├── correction-service/     # 图像矫正服务
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── src/
│   │       └── app.py
│   └── segmentation-service/   # 文字分割服务
│       ├── Dockerfile
│       ├── requirements.txt
│       └── src/
│           └── app.py
└── frontend/                   # 前端应用
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── components/
        │   └── Navbar.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── BookList.jsx
            ├── BookDetail.jsx
            └── AnnotationPage.jsx
```

## API 接口

### 用户服务

- `POST /api/users/auth/register` - 用户注册
- `POST /api/users/auth/login` - 用户登录
- `POST /api/users/auth/logout` - 用户登出
- `GET /api/users/auth/me` - 获取当前用户信息

### 书籍管理

- `POST /api/books` - 创建书籍
- `GET /api/books` - 获取书籍列表
- `GET /api/books/:id` - 获取书籍详情
- `POST /api/books/:id/pages/upload` - 上传页面图像

### 页面处理

- `GET /api/books/:id/pages` - 获取书籍页面列表
- `GET /api/pages/:id` - 获取页面详情
- `POST /api/pages/:id/correct` - 执行图像矫正
- `POST /api/pages/:id/segment` - 执行文字分割
- `GET /api/pages/:id/lines` - 获取页面文字行

### 标注管理

- `PUT /api/lines/:lineId/annotate` - 保存标注
- `GET /api/annotations/:annotationId/versions` - 获取标注历史版本

## 数据库表结构

### users
用户信息表，存储系统用户的基本信息和权限

### books
书籍信息表，存储古籍的元数据

### book_pages
书籍页面表，存储每个页面的图像信息和处理状态

### text_lines
文字行表，存储识别出的文字行及其位置信息

### annotations
标注表，存储用户的标注内容

### annotation_versions
标注版本表，存储标注的历史版本

### collaborations
协作者表，管理书籍的协作权限

## 开发说明

### 添加新的处理服务

1. 在 `services/` 目录下创建新服务目录
2. 创建 Dockerfile 和必要的配置文件
3. 在 `docker-compose.yml` 中添加服务配置
4. 在 API 网关中添加路由转发

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发

每个服务可以独立开发和重启：

```bash
# 用户服务
cd services/user-service
npm install
npm run dev

# Python 服务
cd services/correction-service
pip install -r requirements.txt
python src/app.py
```

## 注意事项

1. 首次启动时，PostgreSQL 会自动执行初始化脚本
2. MinIO 需要手动创建 `ancient-books` bucket 并设置公开访问权限
3. Tesseract OCR 对中文的识别效果取决于训练数据的质量
4. 建议使用高质量的扫描图像以获得最佳识别效果

## 许可证

MIT License
