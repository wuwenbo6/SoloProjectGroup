# 🎎 民俗活动记录平台

一个前后端分离的全栈项目，用于记录、分享和互动民俗文化活动。

## 项目架构

```
p97/
├── backend/          # Node.js 后端服务
│   ├── server.js     # 服务器入口
│   ├── config/       # 配置文件（数据库）
│   ├── routes/       # API 路由
│   ├── data/         # SQLite 数据库文件
│   └── uploads/      # 图片上传目录
└── frontend/         # React 前端应用
    ├── src/
    │   ├── pages/    # 页面组件
    │   ├── services/ # API 服务
    │   └── index.css # 全局样式
    └── public/       # 静态资源
```

## 功能特性

### 🚀 核心功能
- **活动管理**：发布、编辑、删除民俗活动记录
- **图片上传**：支持多图上传预览
- **分类浏览**：按节日庆典、传统技艺、民俗表演、美食文化等分类筛选
- **评论互动**：用户可以对活动进行评论
- **收藏功能**：收藏感兴趣的活动
- **用户系统**：注册、登录、个人资料管理
- **分享功能**：一键分享活动链接

### 📱 前端页面
1. **活动广场**：浏览所有活动，支持分类筛选
2. **操作台**：管理自己发布的活动，发布新活动
3. **活动详情页**：查看活动详情，评论、收藏
4. **用户主页**：查看用户信息、发布的活动、收藏的活动
5. **登录/注册**：用户认证页面

### 💾 后端服务
- **用户服务**：注册、登录、个人资料管理
- **活动服务**：CRUD 操作，图片上传
- **互动服务**：评论、收藏功能
- **分库设计**：用户库、活动库、互动库分离

## 技术栈

### 前端
- **React 18**：用户界面框架
- **React Router 6**：路由管理
- **Axios**：HTTP 客户端
- **CSS3**：响应式样式设计

### 后端
- **Node.js**：运行环境
- **Express.js**：Web 框架
- **SQLite3**：数据库（分库设计）
- **Multer**：文件上传处理
- **bcryptjs**：密码加密
- **uuid**：唯一ID生成

## 快速开始

### 前置要求
- Node.js >= 14.x
- npm 或 yarn

### 安装步骤

#### 1. 安装后端依赖
```bash
cd backend
npm install
```

#### 2. 启动后端服务
```bash
npm start
# 或开发模式（需要 nodemon）
npm run dev
```
后端服务运行在 `http://localhost:3001`

#### 3. 安装前端依赖（新开终端）
```bash
cd frontend
npm install
```

#### 4. 启动前端开发服务器
```bash
npm start
```
前端应用运行在 `http://localhost:3000`

## API 接口文档

### 用户接口 `POST /api/users/register`
- 注册新用户
- 请求体：`{ username, email, password }`

`POST /api/users/login`
- 用户登录
- 请求体：`{ email, password }`

`GET /api/users/:id`
- 获取用户信息

`PUT /api/users/:id`
- 更新用户信息

### 活动接口 `POST /api/activities`
- 创建新活动（支持图片上传）
- multipart/form-data 格式

`GET /api/activities`
- 获取活动列表
- 支持查询参数：`userId`, `category`

`GET /api/activities/:id`
- 获取活动详情

`DELETE /api/activities/:id`
- 删除活动

### 互动接口 `POST /api/interactions/comments`
- 添加评论
- 请求体：`{ activityId, userId, content }`

`GET /api/interactions/comments/:activityId`
- 获取活动的评论列表

`POST /api/interactions/favorites`
- 添加收藏
- 请求体：`{ activityId, userId }`

`DELETE /api/interactions/favorites`
- 取消收藏
- 请求体：`{ activityId, userId }`

`GET /api/interactions/favorites/:userId`
- 获取用户的收藏列表

## 数据库设计

### users.db - 用户数据库
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### activities.db - 活动数据库
```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  date TEXT,
  images TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0
)
```

### interactions.db - 互动数据库
```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, user_id)
)
```

## 使用说明

1. **注册账号**：首次使用请先注册账号
2. **发布活动**：登录后进入操作台，点击"发布新活动"
3. **浏览活动**：在活动广场可以浏览所有活动，支持分类筛选
4. **互动操作**：查看活动详情可以评论和收藏
5. **个人主页**：查看自己发布的活动和收藏的活动

## 项目特色

✅ **前后端分离**：清晰的架构设计，易于维护和扩展  
✅ **分库设计**：用户、活动、互动数据分离存储  
✅ **响应式设计**：适配不同屏幕尺寸  
✅ **图片上传**：支持多图上传和预览  
✅ **用户认证**：安全的密码加密存储  
✅ **RESTful API**：规范的接口设计  
✅ **本地存储**：无需额外安装数据库服务

## 开发建议

- 生产环境建议使用 MySQL 或 PostgreSQL 替代 SQLite
- 添加 JWT 令牌认证增强安全性
- 实现图片压缩和CDN加速
- 添加搜索和推荐功能
- 接入第三方分享平台

## 许可证

MIT License
