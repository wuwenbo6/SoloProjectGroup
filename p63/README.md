# 金石拓片释读平台

一个前后端分离的金石拓片数字化与协同释读平台，支持拓片拍照上传、扫描导入、图像降噪、文字分割、人工释读、智能校对，以及多人协同释读和实时同步进度。

## 功能特性

### 前端功能
- **拓片采集操作台**: 拍照上传、扫描导入、图像降噪、对比度增强
- **文字释读页**: 文字分割、人工释读、智能校对、历史记录追溯
- **对比页**: 多拓片并排对比、差异分析、进度对比

### 后端功能
- **拓片图像采集模块**: 图像处理、存储管理、文件上传
- **文字识别模块**: OCR文字提取、文字分割、置信度评估
- **金石文字释读模块**: 智能释读建议、校对辅助、释读历史
- **权限管理模块**: 用户认证、角色权限、JWT令牌
- **多人协同释读**: 实时同步进度、光标位置共享、编辑状态同步
- **数据库存储**: 原始拓片、识别文字、释读记录

## 技术栈

### 前端
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **UI组件库**: Element Plus
- **实时通信**: Socket.io-client
- **HTTP请求**: Axios
- **图标库**: @element-plus/icons-vue

### 后端
- **运行时**: Node.js
- **框架**: Express
- **数据库**: MongoDB + Mongoose ODM
- **认证**: JWT (jsonwebtoken) + bcryptjs密码加密
- **实时通信**: Socket.io
- **文件上传**: Multer
- **图像处理**: Sharp
- **OCR识别**: Tesseract.js
- **安全**: Helmet、Express Rate Limit
- **CORS**: cors

## 项目结构

```
p63/
├── backend/                      # 后端服务
│   ├── src/
│   │   ├── config/              # 配置文件
│   │   │   └── database.js      # 数据库连接
│   │   ├── models/              # 数据模型
│   │   │   ├── User.js          # 用户模型
│   │   │   ├── Rubbing.js       # 拓片模型
│   │   │   └── InterpretationRecord.js  # 释读记录模型
│   │   ├── routes/              # 路由
│   │   │   ├── authRoutes.js    # 认证路由
│   │   │   └── rubbingRoutes.js # 拓片路由
│   │   ├── controllers/         # 控制器
│   │   │   ├── authController.js
│   │   │   └── rubbingController.js
│   │   ├── middleware/          # 中间件
│   │   │   └── auth.js          # 认证中间件
│   │   ├── services/            # 业务服务
│   │   │   └── imageService.js  # 图像处理服务
│   │   ├── sockets/             # WebSocket处理
│   │   │   └── collaborationSocket.js
│   │   └── server.js            # 服务器入口
│   ├── uploads/                 # 上传文件目录（自动创建）
│   ├── package.json
│   └── .env.example
├── frontend/                     # 前端应用
│   ├── src/
│   │   ├── components/           # 组件目录
│   │   ├── views/               # 页面组件
│   │   │   ├── Login.vue        # 登录页
│   │   │   ├── Register.vue     # 注册页
│   │   │   ├── Dashboard.vue    # 工作台/首页
│   │   │   ├── Capture.vue      # 拓片采集操作台
│   │   │   ├── RubbingDetail.vue  # 拓片详情
│   │   │   ├── Interpretation.vue # 文字释读
│   │   │   └── Compare.vue      # 拓片对比
│   │   ├── layouts/             # 布局组件
│   │   │   └── MainLayout.vue   # 主布局
│   │   ├── store/               # 状态管理
│   │   │   └── auth.js          # 认证状态
│   │   ├── router/              # 路由
│   │   │   └── index.js
│   │   ├── api/                 # API接口
│   │   │   └── index.js
│   │   ├── App.vue
│   │   └── main.js
│   ├── public/                  # 静态资源
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 16.x
- MongoDB >= 4.4 (本地安装或使用MongoDB Atlas)

### 1. 克隆项目

```bash
git clone <repository-url>
cd p63
```

### 2. 安装后端依赖

```bash
cd backend
npm install
```

### 3. 配置后端环境变量

在 `backend` 目录下创建 `.env` 文件:

```env
# 服务端口
PORT=3000

# MongoDB连接地址
MONGODB_URI=mongodb://localhost:27017/rubbing_db

# JWT密钥 (请修改为随机字符串)
JWT_SECRET=your-secret-key-change-this-in-production

# 运行环境
NODE_ENV=development
```

### 4. 启动后端服务

```bash
npm run dev
```

后端服务将运行在 http://localhost:3000

### 5. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 6. 启动前端开发服务器

```bash
npm run dev
```

前端服务将运行在 http://localhost:5173

### 7. 访问应用

打开浏览器访问 http://localhost:5173

## 主要功能使用说明

### 用户认证
1. 访问应用后，首次使用请点击"立即注册"创建账号
2. 使用邮箱和密码登录系统
3. 系统支持记住登录状态，退出登录点击右上角头像选择"退出登录"

### 拓片采集
1. 登录后点击左侧菜单"拓片采集"
2. 点击上传区域或拖拽拓片图片到上传区域
3. 填写拓片标题、描述、朝代、出土地点等信息
4. 点击"保存拓片"上传图片
5. 可对上传的图片进行降噪处理、对比度增强
6. 点击"文字识别"自动进行OCR识别和文字分割

### 文字释读
1. 在工作台点击拓片列表中的"释读"按钮
2. 左侧显示拓片图像和文字框，不同颜色代表不同状态：
   - 蓝色：待释读
   - 绿色：已确认
   - 橙色：有争议
3. 点击任意文字框，右侧显示该文字的详细信息
4. 在右侧编辑器中输入释读文字，点击"保存释读"
5. 确认文字正确可点击"确认正确"
6. 有疑问的文字可标记为"有争议"
7. 底部显示该文字的释读历史记录

### 多人协同释读
1. 多个用户同时打开同一个拓片的释读页面
2. 当有新用户加入时会收到提示通知
3. 任何用户的释读修改会实时同步给其他在线用户
4. 所有用户能看到当前释读进度和各文字状态

### 拓片对比
1. 点击左侧菜单"拓片对比"
2. 分别选择左侧和右侧要对比的拓片
3. 系统会并排显示两张拓片的图像和信息
4. 底部显示对比分析：文字数量对比、释读进度对比、基本信息

### 拓片管理
1. 工作台显示所有可用的拓片列表
2. 卡片显示拓片标题、描述、进度、状态等信息
3. 点击拓片标题查看详情
4. 顶部统计卡片显示拓片总数、处理中、待释读、已完成数量

## API 接口文档

### 认证接口

#### 注册
- **POST** `/api/auth/register`
- **Body**: `{ username, email, password }`
- **返回**: `{ token, user }`

#### 登录
- **POST** `/api/auth/login`
- **Body**: `{ email, password }`
- **返回**: `{ token, user }`

#### 获取当前用户
- **GET** `/api/auth/me`
- **Headers**: `Authorization: Bearer <token>`

### 拓片接口

#### 创建拓片
- **POST** `/api/rubbings`
- **Content-Type**: `multipart/form-data`
- **Body**: `image, title, description, dynasty, location, material, tags`

#### 获取拓片列表
- **GET** `/api/rubbings?page=1&limit=10&status=ready`
- **参数**: page, limit, status, search

#### 获取单个拓片详情
- **GET** `/api/rubbings/:id`

#### 更新拓片信息
- **PUT** `/api/rubbings/:id`
- **Body**: `{ title, description, dynasty, ... }`

#### 处理拓片图像
- **POST** `/api/rubbings/:id/process`
- **Body**: `{ operations: [{ type: 'denoise' }] }`

#### 文字识别
- **POST** `/api/rubbings/:id/recognize`

#### 更新文字释读
- **PUT** `/api/rubbings/:id/characters`
- **Body**: `{ charId, interpretText, status }`

#### 获取释读历史
- **GET** `/api/rubbings/:id/history?charId=xxx`

## WebSocket 事件

### 客户端发送事件
- `join-rubbing`: 加入拓片协作
  - 数据: `{ rubbingId, userId, username }`
- `leave-rubbing`: 离开拓片协作
  - 数据: `{ rubbingId, userId, username }`
- `character-update`: 更新文字释读
  - 数据: `{ rubbingId, characterId, data, userId, username }`
- `cursor-position`: 同步光标位置
  - 数据: `{ rubbingId, userId, username, position }`
- `start-editing`: 开始编辑某个文字
- `stop-editing`: 停止编辑某个文字

### 服务端发送事件
- `user-joined`: 用户加入通知
- `user-left`: 用户离开通知
- `character-updated`: 文字更新通知
- `cursor-moved`: 光标移动通知
- `editing-started`: 开始编辑通知
- `editing-stopped`: 停止编辑通知

## 数据库模型

### User (用户)
- `_id`: ObjectId
- `username`: 用户名
- `email`: 邮箱
- `password`: 加密后的密码
- `role`: 角色 (user, editor, admin)
- `avatar`: 头像URL
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

### Rubbing (拓片)
- `_id`: ObjectId
- `title`: 标题
- `description`: 描述
- `originalImage`: 原始图片URL
- `processedImage`: 处理后图片URL
- `characters`: 文字数组 ([{ charId, boundingBox, recognizedText, interpretText, confidence, status, interpreter }])
- `status`: 状态 (uploaded, processing, ready, completed)
- `uploadedBy`: 上传用户ID
- `collaborators`: 协作用户ID数组
- `dynasty`: 朝代
- `location`: 出土地点
- `material`: 材质
- `dimensions`: 尺寸 ({ width, height })
- `tags`: 标签数组
- `progress`: 释读进度 (百分比)
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

### InterpretationRecord (释读记录)
- `_id`: ObjectId
- `rubbing`: 拓片ID
- `characterId`: 文字ID
- `user`: 用户ID
- `originalText`: 原始文字
- `newText`: 新文字
- `action`: 操作类型 (recognize, interpret, revise, confirm, reject)
- `timestamp`: 时间戳

## 生产部署

### 后端部署
1. 确保环境变量正确配置
2. 设置 `NODE_ENV=production`
3. 使用 PM2 或类似工具管理进程
4. 配置 Nginx 反向代理

```bash
# 安装 PM2
npm install -g pm2

# 启动生产服务
cd backend
pm2 start src/server.js --name rubbing-backend
```

### 前端部署
1. 构建生产版本
```bash
cd frontend
npm run build
```
2. 将 `dist` 目录部署到静态文件服务器 (Nginx, Apache, Vercel, Netlify 等)
3. 配置 API 代理或修改 API 基础地址

## 开发说明

### 添加新功能
1. 后端：先定义模型，然后创建控制器，添加路由，必要时添加中间件
2. 前端：创建API接口，添加页面组件，配置路由

### 代码规范
- 使用 ES6+ 语法
- 后端: 遵循 Express 最佳实践
- 前端: 遵循 Vue 3 Composition API 规范
- 使用语义化的变量和函数命名

## 常见问题

### MongoDB 连接失败
- 确保 MongoDB 服务正在运行
- 检查 `MONGODB_URI` 配置是否正确
- 如使用远程 MongoDB，检查网络连接和认证信息

### 图片上传失败
- 检查 `uploads` 目录是否有写入权限
- 检查图片大小是否超过限制 (默认 10MB)
- 检查文件格式是否支持 (jpg, png, gif, webp)

### 实时同步不工作
- 检查 Socket.io 连接，确认 ws 协议正常
- 检查 CORS 配置
- 检查后端服务状态

### OCR 识别不准确
- Tesseract.js 的中文识别需要训练数据，首次运行会自动下载
- 建议使用高清扫描件
- 可通过图像处理（降噪、增强对比度）提高准确率

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
