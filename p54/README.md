# 金石拓片数字化释读平台

传统金石拓片数字化细分场景专用系统，专注于金石拓片图像采集、文字识别、人工释读与多人协同标注。

## 技术架构

### 前端技术栈
- **框架**: Vue 3 + Vite
- **UI组件**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **通信**: Axios + Socket.IO Client
- **图像处理**: Canvas 原生API

### 后端技术栈
- **框架**: Node.js + Koa 2
- **ORM**: Sequelize
- **数据库**: SQLite 3 (可平滑迁移至MySQL/PostgreSQL)
- **图像处理**: Sharp
- **OCR引擎**: Tesseract.js (支持繁体中文识别)
- **实时通信**: Socket.IO
- **认证**: JWT + bcryptjs
- **日志**: Winston

## 核心功能模块

### 1. 拓片图像采集模块 (Rubbing)
- 文件上传导入
- 相机拍照上传
- 图像预处理（灰度化、降噪、锐化、二值化）
- 拓片元数据管理（朝代、作者、出处、分类）

### 2. 文字识别模块 (OCR)
- 基于Tesseract.js的繁体中文OCR识别
- 字符边界框定位
- 识别置信度评估
- 批量文字提取与存储

### 3. 金石文字释读模块 (Annotation)
- 框选文字手动标注
- 拼音、部首、笔画、释义录入
- 异体字关联
- 释读状态流转（草稿→提交→审核→终审）
- 释读进度追踪

### 4. 拓片分类管理模块
- 碑刻、墓志、金文、印玺、砖瓦等分类
- 按朝代/年代筛选
- 关键词检索
- 释读进度统计

### 5. 用户分级权限模块
- **Admin (管理员)**: 系统全权限
- **Expert (专家)**: 释读审核、终审
- **Annotator (标注员)**: 释读标注与提交
- **Viewer (查看者)**: 只读访问

### 6. 多人协同释读模块
- Socket.IO实时通信
- 加入/离开释读房间
- 释读更新实时同步
- 在线用户光标追踪
- 实时聊天协作

## 数据库设计

### 核心数据表
| 表名 | 说明 |
|------|------|
| Users | 用户表（含角色字段） |
| Rubbings | 拓片表（原图、处理图、元数据、进度） |
| Annotations | 释读表（文字、拼音、部首、释义、边界框） |
| OCRResults | OCR识别结果表（识别文字、置信度、边界框） |
| OperationLogs | 操作日志表（用户行为审计） |
| CollaborationSessions | 协同会话表 |

## 项目结构

```
p54/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   │   ├── Login.vue    # 登录页
│   │   │   ├── Register.vue # 注册页
│   │   │   ├── Home.vue     # 首页/概览
│   │   │   ├── Collection.vue # 拓片采集操作台
│   │   │   ├── Annotation.vue # 文字释读页
│   │   │   ├── Compare.vue  # 拓片对比页
│   │   │   └── Users.vue    # 用户管理页
│   │   ├── components/      # 通用组件
│   │   ├── store/           # Pinia状态
│   │   ├── router/          # 路由配置
│   │   ├── services/        # API服务
│   │   └── main.js
│   ├── package.json
│   └── vite.config.js
├── backend/                  # 后端项目
│   ├── src/
│   │   ├── models/          # Sequelize模型
│   │   ├── routes/          # API路由
│   │   │   ├── user.js      # 用户认证与管理
│   │   │   ├── rubbing.js   # 拓片管理
│   │   │   ├── annotation.js # 释读管理
│   │   │   └── ocr.js       # OCR识别
│   │   ├── socket/          # Socket.IO处理
│   │   ├── middleware/      # 中间件
│   │   ├── utils/           # 工具函数
│   │   └── app.js
│   ├── uploads/             # 文件上传目录
│   └── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 启动服务
```bash
# 启动后端服务 (端口 3000)
cd backend
npm start

# 启动前端开发服务器 (端口 5173)
cd ../frontend
npm run dev
```

### 3. 访问系统
- 前端地址: http://localhost:5173
- 后端API: http://localhost:3000

### 4. 初始化管理员账号
系统启动后，可通过注册页面创建账号，首个注册用户自动获得管理员权限。

## API接口概览

### 用户模块
- `POST /api/user/register` - 用户注册
- `POST /api/user/login` - 用户登录
- `GET /api/user/profile` - 获取个人信息
- `GET /api/user/list` - 用户列表 (Admin)
- `PUT /api/user/:id` - 更新用户 (Admin)
- `POST /api/user/:id/disable` - 禁用用户 (Admin)

### 拓片模块
- `POST /api/rubbing/upload` - 上传拓片
- `POST /api/rubbing/:id/process` - 图像处理
- `GET /api/rubbing/list` - 拓片列表
- `GET /api/rubbing/:id` - 拓片详情
- `PUT /api/rubbing/:id` - 更新拓片
- `DELETE /api/rubbing/:id` - 删除拓片 (Admin)

### 释读模块
- `GET /api/annotation/rubbing/:rubbingId` - 拓片释读列表
- `POST /api/annotation` - 添加释读
- `GET /api/annotation/:id` - 释读详情
- `PUT /api/annotation/:id` - 更新释读
- `DELETE /api/annotation/:id` - 删除释读
- `POST /api/annotation/:id/submit` - 提交审核
- `POST /api/annotation/:id/review` - 审核释读 (Expert/Admin)

### OCR模块
- `POST /api/ocr/:rubbingId/recognize` - 启动OCR识别
- `GET /api/ocr/:rubbingId/results` - 获取OCR结果
- `PUT /api/ocr/result/:id` - 校对OCR结果
- `GET /api/ocr/statistics/:rubbingId` - OCR统计

## 特色功能

1. **专业场景**: 专为传统金石拓片数字化设计，避免通用系统冗余
2. **繁体OCR**: 内置繁体中文识别，适配碑刻文字特征
3. **实时协同**: 多人同时释读，进度实时同步
4. **完整工作流**: 上传→预处理→OCR→人工释读→审核→归档
5. **权限分级**: 四级用户角色，符合学术团队协作模式
6. **操作审计**: 完整用户行为日志，支持溯源

## 开发说明

- 数据库使用SQLite，便于快速开发部署，生产环境可迁移至MySQL
- OCR首次启动需下载语言包，可能较慢
- Socket.IO支持房间隔离，不同拓片的协同互不干扰
- 所有图片处理均在服务器端完成，确保一致性

## 技术亮点

1. **前后端完全分离**: 独立部署，支持横向扩展
2. **RESTful API设计**: 规范的接口设计，易于维护和扩展
3. **JWT无状态认证**: 支持分布式部署
4. **ORM数据访问**: 数据库迁移便捷
5. **模块化架构**: 各功能模块解耦，可独立维护
