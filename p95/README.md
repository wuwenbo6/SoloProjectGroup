# 刺绣针法采集平台

一个前后端分离的全栈刺绣针法管理和分享平台，支持针法上传、编辑、作品分享和评论互动。

## 技术栈

### 后端
- Python 3.x
- FastAPI - Web框架
- SQLAlchemy - ORM
- SQLite - 数据库
- JWT - 身份认证

### 前端
- React 18
- Vite - 构建工具
- React Router - 路由管理
- MUI (Material-UI) - UI组件库
- Axios - HTTP客户端

## 项目结构

```
p95/
├── backend/
│   ├── main.py              # FastAPI主应用
│   ├── requirements.txt     # Python依赖
│   ├── embroidery_platform.db  # SQLite数据库(自动创建)
│   ├── uploads/             # 上传文件目录(自动创建)
│   └── app/
│       ├── __init__.py
│       ├── db/              # 数据库连接
│       ├── models/          # 数据模型
│       ├── schemas/         # Pydantic模式
│       ├── api/             # API路由
│       └── core/            # 核心功能(安全、JWT等)
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx         # 应用入口
        ├── App.jsx          # 主应用组件
        ├── contexts/        # React上下文(认证等)
        ├── services/        # API服务
        ├── components/      # 通用组件
        └── pages/           # 页面组件
```

## 功能特性

### 用户管理
- 用户注册/登录
- JWT令牌认证
- 用户信息管理

### 针法管理
- 针法创建、编辑、删除
- 针法分类和难度标签
- 针法详情展示(材料、步骤、技巧)
- 图片上传
- 公开/私有针法设置

### 作品管理
- 基于针法创建作品
- 作品展示和分享
- 点赞和分享计数
- 作品评论功能

### 互动功能
- 作品评论和回复
- 点赞功能
- 作品分享

## 快速开始

### 后端启动

1. 进入后端目录:
```bash
cd backend
```

2. 安装依赖:
```bash
pip install -r requirements.txt
```

3. 启动服务器:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档: http://localhost:8000/docs

### 前端启动

1. 进入前端目录:
```bash
cd frontend
```

2. 安装依赖:
```bash
npm install
```

3. 启动开发服务器:
```bash
npm start
```

前端访问: http://localhost:3000

## API接口

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 针法
- `GET /api/stitches` - 获取公开针法列表
- `GET /api/stitches/my` - 获取我的针法
- `GET /api/stitches/{id}` - 获取针法详情
- `POST /api/stitches` - 创建针法
- `PUT /api/stitches/{id}` - 更新针法
- `DELETE /api/stitches/{id}` - 删除针法

### 作品
- `GET /api/works` - 获取作品列表
- `GET /api/works/my` - 获取我的作品
- `GET /api/works/{id}` - 获取作品详情
- `POST /api/works` - 创建作品
- `PUT /api/works/{id}` - 更新作品
- `DELETE /api/works/{id}` - 删除作品
- `POST /api/works/{id}/like` - 点赞作品
- `POST /api/works/{id}/share` - 分享作品

### 评论
- `GET /api/comments/work/{work_id}` - 获取作品评论
- `POST /api/comments` - 创建评论
- `DELETE /api/comments/{id}` - 删除评论

### 文件上传
- `POST /api/upload/image` - 上传图片

## 数据库模型

### User
- id, username, email, hashed_password, avatar, bio, created_at

### Stitch
- id, name, description, category, difficulty, image_url, video_url, steps, materials, tips, created_at, updated_at, is_public, owner_id

### Work
- id, title, description, image_url, stitch_id, owner_id, created_at, likes_count, shares_count

### Comment
- id, content, work_id, user_id, created_at, parent_id

## 开发说明

- 后端使用FastAPI自动生成API文档，访问 `/docs` 查看Swagger界面
- 前端使用Vite进行快速开发，支持热更新
- 数据库使用SQLite，会在首次启动时自动创建
- 上传的文件保存在 `backend/uploads` 目录

## 注意事项

- 生产环境请修改 `SECRET_KEY` 为安全的随机字符串
- 生产环境建议使用PostgreSQL或MySQL替代SQLite
- 生产环境请配置适当的CORS策略
- 建议为上传文件配置CDN或云存储服务
