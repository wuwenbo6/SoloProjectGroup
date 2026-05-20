# 陶瓷工艺记录平台

一个基于 React + Node.js 的前后端分离全栈项目，用于记录和分享陶瓷烧制工艺。

## 项目结构

```
p93/
├── backend/          # Node.js 后端
│   ├── src/
│   │   ├── models/       # 数据模型
│   │   ├── controllers/  # 控制器
│   │   ├── routes/       # 路由
│   │   └── server.js     # 服务器入口
│   ├── data/         # 数据存储目录
│   ├── uploads/      # 图片上传目录
│   └── package.json
└── frontend/         # React 前端
    ├── src/
    │   ├── pages/        # 页面组件
    │   ├── components/   # 公共组件
    │   ├── services/     # API 服务
    │   └── store/        # 状态管理
    └── package.json
```

## 功能特性

### 后端功能
- 用户信息管理（创建、更新、查询）
- 工艺记录 CRUD（创建、读取、更新、删除）
- 评论互动管理（发布、删除、查询）
- 收藏功能（添加、取消、查询）
- 图片上传

### 前端页面
- **首页**：发现和浏览公开的工艺记录
- **工艺操作台**：创建和编辑工艺记录，包括材料清单、制作步骤、烧制参数等
- **工艺分享页**：查看工艺详情、点赞、收藏、发表评论
- **用户主页**：查看个人资料、我的工艺、我的收藏

## 快速开始

### 启动后端

```bash
cd backend
npm install
npm start
# 后端运行在 http://localhost:5000
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:3000
```

## 技术栈

### 后端
- Node.js + Express
- 文件系统存储（JSON 文件）
- Multer 处理文件上传

### 前端
- React 18
- React Router 6
- Vite 构建工具
- 原生 CSS

## API 接口

### 用户相关
- `POST /api/users` - 创建/登录用户
- `GET /api/users/:id` - 获取用户信息
- `PUT /api/users/:id` - 更新用户信息

### 工艺相关
- `GET /api/crafts` - 获取工艺列表（支持筛选）
- `GET /api/crafts/:id` - 获取工艺详情
- `POST /api/crafts` - 创建工艺
- `PUT /api/crafts/:id` - 更新工艺
- `DELETE /api/crafts/:id` - 删除工艺
- `POST /api/crafts/:id/like` - 点赞工艺

### 评论相关
- `GET /api/comments/craft/:craftId` - 获取工艺的评论
- `POST /api/comments` - 发表评论
- `DELETE /api/comments/:id` - 删除评论

### 收藏相关
- `GET /api/favorites/user/:userId` - 获取用户收藏列表
- `GET /api/favorites/check/:userId/:craftId` - 检查是否已收藏
- `POST /api/favorites/toggle` - 切换收藏状态
