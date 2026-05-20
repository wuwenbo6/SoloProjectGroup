# 刺绣针法教学操作台

一个完整的全栈刺绣教学平台，支持针法演示、视频播放、学员互动和教师管理功能。

## 技术栈

### 前端
- Vue 3 - 渐进式JavaScript框架
- Vue Router - 路由管理
- Pinia - 状态管理
- Element Plus - UI组件库
- Socket.IO Client - 实时通信
- Axios - HTTP客户端
- Vite - 构建工具

### 后端
- Node.js
- Express - Web框架
- Socket.IO - 实时通信
- SQLite - 数据库
- Multer - 文件上传
- JWT - 身份认证
- Bcrypt - 密码加密

## 功能特性

### 学员功能
- 🔐 用户注册/登录
- 📚 针法列表浏览
- 📖 针法步骤分步演示
- 🎬 教学视频播放
- 📝 学习进度记录
- ❓ 提问与问答互动
- 💬 实时聊天交流
- 📊 学习统计

### 教师功能
- 🛠️ 针法管理（增删改查）
- 📝 针法步骤编辑
- 🎥 视频上传管理
- 👥 学员管理
- ✍️ 回答学员问题
- 💬 实时在线答疑

## 项目结构

```
p74/
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── components/   # 组件目录
│   │   ├── views/        # 页面组件
│   │   │   ├── Login.vue
│   │   │   ├── Home.vue
│   │   │   ├── StitchDetail.vue
│   │   │   ├── QA.vue
│   │   │   └── Admin.vue
│   │   ├── router/       # 路由配置
│   │   ├── store/        # 状态管理
│   │   ├── api/          # API接口
│   │   ├── assets/       # 静态资源
│   │   ├── App.vue       # 根组件
│   │   └── main.js       # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/              # 后端项目
│   ├── server.js         # 服务器入口
│   ├── database/         # 数据库
│   │   └── db.js         # 数据库操作
│   ├── routes/           # 路由
│   │   ├── auth.js       # 认证路由
│   │   ├── stitches.js   # 针法路由
│   │   ├── progress.js   # 进度路由
│   │   ├── qa.js         # 问答路由
│   │   └── videos.js     # 视频/反馈路由
│   ├── uploads/          # 上传文件目录
│   └── package.json
│
└── README.md
```

## 快速开始

### 1. 安装依赖

#### 后端
```bash
cd backend
npm install
```

#### 前端
```bash
cd frontend
npm install
```

### 2. 启动服务

#### 启动后端服务（端口3000）
```bash
cd backend
npm start
```

#### 启动前端开发服务（端口5173）
```bash
cd frontend
npm run dev
```

### 3. 访问应用

打开浏览器访问：http://localhost:5173

### 默认账号

系统初始化时会自动创建以下测试账号：

- **教师账号**：`teacher` / `123456`
- **学员账号**：`student` / `123456`

## API接口

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/users` - 获取用户列表

### 针法接口
- `GET /api/stitches` - 获取针法列表
- `GET /api/stitches/:id` - 获取针法详情
- `POST /api/stitches` - 创建针法
- `POST /api/stitches/:id/steps` - 添加针法步骤
- `DELETE /api/stitches/:id` - 删除针法

### 进度接口
- `GET /api/progress/:userId` - 获取学习进度
- `POST /api/progress` - 更新学习进度
- `GET /api/progress/stats/:userId` - 获取学习统计

### 问答接口
- `GET /api/qa` - 获取问题列表
- `GET /api/qa/:id` - 获取问题详情
- `POST /api/qa` - 发布问题
- `POST /api/qa/:id/answers` - 提交回答

### 视频/反馈接口
- `GET /api/videos` - 获取视频列表
- `POST /api/videos` - 上传视频
- `POST /api/videos/feedback` - 提交反馈
- `GET /api/videos/feedback/:stitchId` - 获取针法反馈

## 实时通信

Socket.IO事件：
- `join` - 用户加入
- `userOnline` - 在线用户列表
- `sendMessage` - 发送消息
- `newMessage` - 接收新消息
- `teacherAnswer` - 教师回答
- `newAnswer` - 接收新回答

## 数据库表结构

- `users` - 用户表
- `stitches` - 针法表
- `stitch_steps` - 针法步骤表
- `videos` - 视频表
- `student_progress` - 学习进度表
- `questions` - 问题表
- `answers` - 回答表
- `feedback` - 反馈表

## 开发说明

### 前后端联调
前端通过Vite代理 `/api` 和 `/uploads` 请求到后端的3000端口，配置在 `vite.config.js` 中。

### 身份认证
使用JWT令牌进行身份认证，令牌存储在localStorage中。

### 实时功能
使用Socket.IO实现实时聊天和问答通知功能。

## License

MIT
