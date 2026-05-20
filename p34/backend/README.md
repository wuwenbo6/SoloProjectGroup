# 民族传统服饰纹样数字化平台 - 后端

基于 Node.js + Express + TypeScript + Prisma + MySQL 构建的民族传统服饰纹样数字化平台后端服务。

## 技术栈

- **框架**: Express 4 + TypeScript
- **ORM**: Prisma
- **数据库**: MySQL
- **认证**: JWT + bcryptjs
- **文件上传**: Multer
- **图像处理**: Sharp
- **实时通信**: Socket.io
- **日志**: Winston
- **安全**: Helmet + CORS
- **权限控制**: 基于角色的访问控制 (RBAC)

## 功能模块

### 1. 用户认证与权限模块
- JWT 身份认证
- 用户注册/登录
- 基于角色的权限控制 (RBAC)
- 三级权限系统：ADMIN / DESIGNER / COLLECTOR

### 2. 纹样素材管理模块
- 纹样图片上传 (Multer)
- 图片自动压缩与缩略图生成 (Sharp)
- 素材分类管理
- 按民族、分类、状态筛选
- 素材 CRUD 操作

### 3. 特征提取模块
- 颜色特征提取 (调色板生成)
- 纹理特征分析
- 几何参数提取
- 手动轮廓勾勒数据存储
- 特征数据持久化

### 4. 图案智能生成模块
- 基于 SVG 的图案生成
- 参数化调节 (缩放、旋转、重复、间距)
- 图案导出下载
- 生成历史记录

### 5. 实时协同编辑模块
- Socket.io WebSocket 服务
- 多人会话管理
- 实时光标同步
- 绘制操作同步
- 消息实时推送
- 冲突处理机制

### 6. 操作日志审计模块
- 用户操作记录
- 操作类型分类
- 操作时间戳
- 操作详情存储

## 项目结构

```
src/
├── config/             # 配置文件
│   ├── database.ts     # Prisma 数据库连接
│   └── index.ts        # 应用配置
├── controllers/        # 控制器层
│   ├── AuthController.ts
│   ├── UserController.ts
│   ├── MaterialController.ts
│   ├── FeatureController.ts
│   ├── PatternController.ts
│   └── CategoryController.ts
├── services/           # 服务层
│   ├── AuthService.ts
│   ├── UserService.ts
│   ├── MaterialService.ts
│   ├── FeatureService.ts
│   ├── PatternService.ts
│   ├── CategoryService.ts
│   ├── OperationService.ts
│   └── SocketService.ts
├── repositories/       # 数据访问层
│   ├── BaseRepository.ts
│   ├── UserRepository.ts
│   ├── MaterialRepository.ts
│   ├── FeatureRepository.ts
│   └── PatternRepository.ts
├── middleware/         # 中间件
│   ├── auth.ts         # JWT 认证中间件
│   └── upload.ts       # 文件上传中间件
├── routes/             # 路由配置
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── material.routes.ts
│   ├── feature.routes.ts
│   ├── pattern.routes.ts
│   └── category.routes.ts
├── utils/              # 工具函数
│   ├── logger.ts       # Winston 日志
│   └── response.ts     # 统一响应格式
├── types/              # TypeScript 类型
└── app.ts              # 应用入口
```

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- npm >= 9

### 安装依赖

```bash
cd backend
npm install
```

### 环境配置

复制 `.env.example` 为 `.env` 并配置：

```env
# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/pattern_db"

# JWT 配置
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# 服务端口
PORT=3000

# 环境
NODE_ENV=development

# 上传配置
UPLOADS_PATH="./uploads"
```

### 数据库初始化

```bash
# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev --name init

# 插入种子数据
npx prisma db seed
```

### 开发模式

```bash
npm run dev
```

服务地址: http://localhost:3000

### 生产构建

```bash
npm run build
npm start
```

## API 文档

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息

### 用户接口 (需管理员权限)
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户
- `GET /api/users/:id/operations` - 获取用户操作日志
- `GET /api/users/stats` - 获取用户统计

### 素材接口
- `GET /api/materials` - 获取素材列表
- `GET /api/materials/:id` - 获取素材详情
- `POST /api/materials` - 上传素材 (需认证)
- `GET /api/materials/me/list` - 获取我的素材 (需认证)
- `PUT /api/materials/:id` - 更新素材 (需认证)
- `DELETE /api/materials/:id` - 删除素材 (需认证)

### 特征接口
- `GET /api/features` - 获取特征列表
- `GET /api/features/material/:materialId` - 获取素材特征
- `POST /api/features/extract` - 提取特征 (需认证)
- `GET /api/features/me/list` - 获取我的特征 (需认证)

### 图案接口
- `GET /api/patterns` - 获取图案列表
- `GET /api/patterns/:id` - 获取图案详情
- `POST /api/patterns/generate` - 生成图案 (需认证)
- `GET /api/patterns/me/list` - 获取我的图案 (需认证)
- `PUT /api/patterns/:id` - 更新图案 (需认证)
- `DELETE /api/patterns/:id` - 删除图案 (需认证)

### 分类接口
- `GET /api/categories` - 获取分类列表
- `GET /api/categories/:id` - 获取分类详情
- `POST /api/categories` - 创建分类 (需认证)
- `PUT /api/categories/:id` - 更新分类 (需认证)
- `DELETE /api/categories/:id` - 删除分类 (需认证)

### 健康检查
- `GET /health` - 服务健康状态

## WebSocket 协同编辑

### 连接方式

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' },
  transports: ['websocket'],
});
```

### 事件列表

**客户端发送事件**:
- `join_session` - 加入会话
- `leave_session` - 离开会话
- `cursor_move` - 光标移动
- `draw_start` - 开始绘制
- `draw_move` - 绘制中
- `draw_end` - 结束绘制
- `path_update` - 更新路径
- `path_delete` - 删除路径
- `undo` - 撤销
- `redo` - 重做
- `send_message` - 发送消息

**服务端推送事件**:
- `session_joined` - 加入会话成功
- `user_joined` - 用户加入
- `user_left` - 用户离开
- `cursor_moved` - 光标移动
- `peer_draw_start` - 协作者开始绘制
- `peer_draw_move` - 协作者绘制中
- `peer_draw_end` - 协作者结束绘制
- `peer_path_update` - 协作者更新路径
- `peer_path_delete` - 协作者删除路径
- `peer_undo` - 协作者撤销
- `peer_redo` - 协作者重做
- `message_received` - 收到消息

## 数据库表结构

- **User**: 用户表
- **Category**: 分类表
- **PatternMaterial**: 纹样素材表
- **PatternFeature**: 纹样特征表
- **GeneratedPattern**: 生成图案表
- **UserOperation**: 用户操作表
- **Permission**: 权限表

## 种子数据

执行 `npx prisma db seed` 后生成以下测试账号：

- **管理员**: admin@pattern.com / 123456
- **设计师**: designer@pattern.com / 123456
- **采集员**: collector@pattern.com / 123456

同时预设 5 个民族纹样分类：苗族、侗族、彝族、藏族、壮族。

## 日志

日志文件存储在 `logs/` 目录：
- `error.log` - 错误日志
- `combined.log` - 综合日志
