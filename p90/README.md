# 脸谱纹样采集平台

一个前后端分离的全栈项目，用于脸谱纹样的采集、编辑、分享和评论互动。

## 项目结构

```
p90/
├── frontend/                 # Vue3 前端项目
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   │   ├── Studio.vue   # 纹样采集操作台
│   │   │   ├── Share.vue    # 纹样分享页
│   │   │   └── Works.vue    # 用户作品页
│   │   ├── router/          # 路由配置
│   │   ├── api/             # API接口
│   │   ├── stores/          # Pinia状态管理
│   │   └── main.js          # 入口文件
│   └── package.json
│
└── backend/                  # Spring Boot 后端项目
    ├── src/main/java/com/pattern/
    │   ├── entity/           # 实体类
    │   ├── repository/       # 数据访问层
    │   ├── service/          # 业务逻辑层
    │   ├── controller/       # 控制器层
    │   └── config/           # 配置类
    └── pom.xml
```

## 功能特性

### 前端功能
- **纹样采集操作台**: 支持画布绘图、颜色选择、画笔大小调整、上传底图、保存纹样
- **纹样分享页**: 查看纹样详情、点赞、评论、分享链接、下载图片
- **用户作品页**: 查看所有作品、按条件排序、删除作品、查看作品详情

### 后端功能
- **纹样数据管理**: CRUD操作、点赞/评论/分享计数
- **用户信息管理**: 注册、登录、个人资料管理
- **作品互动管理**: 评论、点赞、分享功能
- **分库存储**: 支持多数据源配置

## 技术栈

### 前端
- Vue 3 + Vite
- Vue Router 4
- Pinia (状态管理)
- Element Plus (UI组件库)
- Axios (HTTP客户端)

### 后端
- Spring Boot 3.x
- Spring Data JPA
- H2 Database (内嵌数据库)
- Lombok

## 快速开始

### 后端启动

```bash
cd backend
# 使用Maven编译运行
mvn spring-boot:run
```

后端服务将在 `http://localhost:8080` 启动

H2控制台: `http://localhost:8080/h2-console`

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

## API接口

### 纹样接口
- `POST /api/patterns` - 创建纹样
- `GET /api/patterns` - 获取所有纹样
- `GET /api/patterns/{id}` - 获取单个纹样
- `PUT /api/patterns/{id}` - 更新纹样
- `DELETE /api/patterns/{id}` - 删除纹样

### 用户接口
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/profile/{id}` - 获取用户信息
- `PUT /api/users/profile/{id}` - 更新用户信息

### 互动接口
- `POST /api/interactions/like` - 点赞
- `DELETE /api/interactions/like` - 取消点赞
- `POST /api/interactions/comment` - 发表评论
- `GET /api/interactions/comments/{patternId}` - 获取评论列表
- `POST /api/interactions/share` - 分享

## 默认测试数据

系统启动时会自动创建测试数据：

- 用户: admin / 123456
- 5个示例脸谱纹样
- 对应的评论数据

## 数据库配置

默认使用H2内嵌数据库，配置位于 `application.yml`

支持分库存储扩展，已配置三个数据源：
- pattern 数据库 (纹样数据)
- user 数据库 (用户信息)
- interaction 数据库 (互动数据)

如需使用MySQL，修改 `application.yml` 中的数据源配置即可。
