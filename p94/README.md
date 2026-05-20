# 皮影道具采集系统 - 前后端分离全栈项目

## 项目简介

这是一个基于Vue3 + Spring Boot的皮影道具采集管理系统，采用分库设计实现数据隔离，支持道具上传展示、工艺说明管理、多人协同采集等功能。

## 技术栈

### 前端
- Vue 3.x (Composition API)
- Vue Router 4.x
- Element Plus
- Axios

### 后端
- Spring Boot 2.7.x
- MyBatis Plus
- MySQL (多数据源)

### 数据库
- shadow_prop_db (道具库)
- shadow_craft_db (工艺库)
- shadow_user_db (用户库)

## 项目结构

```
p94/
├── frontend/                 # 前端Vue项目
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   ├── router/          # 路由配置
│   │   ├── api/             # API封装
│   │   └── utils/           # 工具类
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/                  # 后端Spring Boot项目
│   ├── src/main/java/com/shadowpuppet/backend/
│   │   ├── config/          # 配置类
│   │   ├── datasources/     # 多数据源配置
│   │   ├── controller/      # 控制器
│   │   ├── service/         # 业务层
│   │   ├── entity/          # 实体类
│   │   ├── mapper/          # 数据访问层
│   │   └── util/            # 工具类
│   └── src/main/resources/
│       └── application.yml
├── database/                 # 数据库脚本
│   ├── 01_init_prop_db.sql
│   ├── 02_init_craft_db.sql
│   └── 03_init_user_db.sql
└── README.md
```

## 功能模块

### 1. 用户管理
- 用户登录/登出
- 角色权限管理 (管理员/采集员/专家/普通用户)

### 2. 道具采集操作台
- 道具信息录入
- 图片上传
- 分类管理
- 草稿/审核状态管理

### 3. 道具展示
- 道具列表分页
- 分类筛选
- 关键词搜索
- 详情查看

### 4. 工艺说明
- 工艺说明编辑
- 难度等级设置
- 材料/工具说明
- 浏览统计

### 5. 多人协同采集
- 创建/加入会话
- 实时聊天
- 协作上传道具
- 参与者管理

## 快速开始

### 1. 数据库初始化

```bash
# 依次执行三个数据库脚本
mysql -u root -p < database/01_init_prop_db.sql
mysql -u root -p < database/02_init_craft_db.sql
mysql -u root -p < database/03_init_user_db.sql
```

默认测试账号：
- 用户名: admin
- 密码: admin

### 2. 后端启动

```bash
cd backend

# 使用Maven编译打包
mvn clean package

# 运行项目
java -jar target/shadow-puppet-backend-1.0.0.jar
```

或直接运行主类：
- 主类: `com.shadowpuppet.backend.ShadowPuppetApplication`

后端服务地址: http://localhost:8080

### 3. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端访问地址: http://localhost:3000

## API接口

### 用户相关
- `POST /api/users/login` - 用户登录
- `GET /api/users` - 获取用户列表

### 道具相关
- `GET /api/props` - 获取道具列表
- `GET /api/props/{id}` - 获取道具详情
- `POST /api/props` - 创建道具
- `PUT /api/props/{id}` - 更新道具
- `DELETE /api/props/{id}` - 删除道具
- `POST /api/props/upload` - 上传道具图片
- `GET /api/props/collector/{collectorId}` - 获取采集员的道具

### 工艺相关
- `GET /api/crafts` - 获取工艺列表
- `GET /api/crafts/{id}` - 获取工艺详情
- `POST /api/crafts` - 创建工艺
- `PUT /api/crafts/{id}` - 更新工艺
- `DELETE /api/crafts/{id}` - 删除工艺

## 数据库设计

### shadow_prop_db (道具库)
- `props` - 道具主表
- `prop_tags` - 道具标签表

### shadow_craft_db (工艺库)
- `craft_techniques` - 工艺表
- `craft_steps` - 工艺步骤表

### shadow_user_db (用户库)
- `users` - 用户表
- `collaboration_sessions` - 协同会话表
- `collaboration_participants` - 会话参与表

## 开发说明

### 后端开发
- 多数据源配置位于 `datasources/` 目录
- 采用注解方式区分数据源
- MyBatis Plus实现CRUD操作

### 前端开发
- 使用Vue3 Composition API
- Element Plus组件库
- Axios拦截器统一处理请求响应

## 注意事项

1. 请根据实际环境修改 `backend/src/main/resources/application.yml` 中的数据库配置
2. 文件上传目录默认为项目根目录下的 `uploads` 文件夹
3. 生产环境请配置真实的WebSocket服务用于协同功能

## License

MIT
