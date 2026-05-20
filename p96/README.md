# 拓片数字化平台

基于前后端分离架构的拓片数字化管理平台，支持拓片上传、文字识别、多人协同标注和释读结果对比功能。

## 技术栈

### 前端
- Vue 3.4 + TypeScript
- Vite 5.1
- Element Plus 2.6
- Pinia 2.1
- Vue Router 4.3
- Axios 1.6

### 后端
- Spring Boot 3.2
- Spring Data JPA
- MySQL 8.0
- JWT 认证
- 多数据源分库设计

## 项目结构

```
p96/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── api/             # API接口
│   │   ├── components/      # 公共组件
│   │   ├── router/          # 路由配置
│   │   ├── store/           # 状态管理
│   │   ├── types/           # TypeScript类型
│   │   ├── views/           # 页面组件
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/                  # 后端项目
│   ├── src/main/
│   │   ├── java/com/rubbing/
│   │   │   ├── config/      # 配置类
│   │   │   ├── controller/  # 控制器
│   │   │   ├── dto/         # 数据传输对象
│   │   │   ├── entity/      # 实体类
│   │   │   ├── repository/  # 数据访问层
│   │   │   ├── security/    # 安全相关
│   │   │   ├── service/     # 业务逻辑
│   │   │   └── RubbingApplication.java
│   │   └── resources/
│   │       └── application.yml
│   └── pom.xml
└── database/                 # 数据库脚本
    ├── init.sql             # 数据库初始化脚本
    └── uploads/             # 文件上传目录
```

## 数据库设计

采用分库设计，三个独立数据库：

1. **rubbing_user** - 用户信息数据库
   - user: 用户表

2. **rubbing_data** - 拓片数据数据库
   - rubbing: 拓片信息表

3. **rubbing_interpretation** - 释读记录数据库
   - interpretation: 释读记录表
   - annotation: 标注记录表

## 快速开始

### 前置条件
- Node.js 18+
- JDK 17+
- MySQL 8.0+
- Maven 3.8+

### 1. 数据库初始化

```bash
mysql -u root -p < database/init.sql
```

### 2. 后端启动

```bash
cd backend
mvn clean install
mvn spring-boot:run
```

后端服务将在 http://localhost:8080 启动

默认账号：
- 用户名: admin
- 密码: admin123

### 3. 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 功能模块

### 1. 用户认证
- 用户登录/注册
- JWT Token认证
- 权限管理

### 2. 拓片采集操作台
- 拓片图片上传
- 拓片列表管理
- 图片预览
- 拓片删除

### 3. 文字释读页
- OCR文字识别
- 手动框选标注
- 标注编辑（文字、位置、大小）
- 标注保存

### 4. 释读结果对比
- 多版本释读选择
- 差异对比展示
- 标注版本对比

## API接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/userinfo` - 获取用户信息

### 拓片接口
- `POST /api/rubbing/upload` - 上传拓片
- `GET /api/rubbing/list` - 拓片列表
- `GET /api/rubbing/{id}` - 获取拓片详情
- `DELETE /api/rubbing/{id}` - 删除拓片

### 释读接口
- `POST /api/interpretation/recognize/{rubbingId}` - OCR识别
- `POST /api/interpretation/annotation` - 保存标注
- `GET /api/interpretation/annotations/{rubbingId}` - 获取标注列表

### 对比接口
- `POST /api/comparison/compare` - 对比释读
- `GET /api/comparison/history` - 获取释读历史

## 开发说明

### 后端配置
数据库连接配置在 `backend/src/main/resources/application.yml`

### 前端配置
API代理配置在 `frontend/vite.config.ts`

## 注意事项

1. 确保MySQL服务已启动，用户名密码正确
2. 文件上传目录会自动创建
3. OCR功能目前为模拟实现，可根据需要集成真实OCR引擎
4. 生产环境请修改JWT密钥和数据库密码
