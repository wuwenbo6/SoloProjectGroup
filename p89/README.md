# 酿造工艺记录平台

一个前后端分离的全栈应用，用于记录、分享和交流酿造工艺。

## 技术栈

### 后端
- Node.js + Express
- MongoDB (分库存储)
- Mongoose ODM
- JWT 认证
- Multer 文件上传

### 前端
- React 18
- React Router
- Axios
- Vite

## 项目结构

```
p89/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── middleware/     # 中间件
│   │   └── server.js       # 服务器入口
│   ├── uploads/            # 上传文件目录
│   ├── package.json
│   └── .env
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── context/        # 状态管理
│   │   ├── services/       # API服务
│   │   ├── App.jsx         # 主应用
│   │   ├── main.jsx        # 入口
│   │   └── index.css       # 样式
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 数据库设计

采用分库存储策略：

1. **brewing_process** - 工艺记录数据库
   - Process 模型：存储工艺详情、原料、步骤、图片等

2. **brewing_user** - 用户信息数据库
   - User 模型：用户账号、个人信息、收藏列表

3. **brewing_interaction** - 互动数据数据库
   - Comment 模型：评论
   - Favorite 模型：收藏
   - Like 模型：点赞

## 功能特性

- ✅ 用户注册/登录（JWT认证）
- ✅ 工艺记录发布（支持图片上传）
- ✅ 工艺记录编辑/删除
- ✅ 工艺分类筛选（啤酒、葡萄酒、威士忌、清酒等）
- ✅ 工艺详情查看
- ✅ 评论功能
- ✅ 点赞功能
- ✅ 收藏功能
- ✅ 用户主页（个人信息、收藏列表）
- ✅ 浏览量统计

## 快速开始

### 前置要求

- Node.js >= 16
- MongoDB >= 4.4

### 启动后端

```bash
cd backend
npm install
npm run dev
```

后端服务将在 http://localhost:5000 启动

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端应用将在 http://localhost:3000 启动

## API 接口文档

### 用户相关

- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/profile` - 获取当前用户信息
- `GET /api/users/:id` - 获取指定用户信息
- `PUT /api/users/profile` - 更新用户信息

### 工艺记录相关

- `POST /api/process` - 发布新工艺（支持多图上传）
- `GET /api/process` - 获取工艺列表（支持分页、分类筛选）
- `GET /api/process/my` - 获取当前用户的工艺列表
- `GET /api/process/:id` - 获取工艺详情
- `PUT /api/process/:id` - 更新工艺记录
- `DELETE /api/process/:id` - 删除工艺记录

### 互动相关

- `POST /api/interaction/comment/:processId` - 发表评论
- `GET /api/interaction/comments/:processId` - 获取工艺评论
- `DELETE /api/interaction/comment/:commentId` - 删除评论
- `POST /api/interaction/favorite/:processId` - 收藏工艺
- `DELETE /api/interaction/favorite/:processId` - 取消收藏
- `GET /api/interaction/favorites/my` - 获取我的收藏
- `GET /api/interaction/favorites/check/:processId` - 检查是否已收藏
- `POST /api/interaction/like/:processId` - 点赞工艺
- `DELETE /api/interaction/like/:processId` - 取消点赞
- `GET /api/interaction/likes/check/:processId` - 检查是否已点赞

## 使用说明

1. 注册账号并登录
2. 在首页浏览公开的工艺记录
3. 点击"发布工艺"创建自己的工艺记录
4. 在工艺详情页可以评论、点赞、收藏
5. 在个人主页查看自己发布的工艺和收藏

## 开发说明

### 后端环境变量

创建 `backend/.env` 文件：

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET=brewing_jwt_secret_key_2024
UPLOADS_DIR=./uploads
```

### 前端代理配置

前端通过 Vite 代理将 `/api` 和 `/uploads` 请求转发到后端服务。

## License

MIT
