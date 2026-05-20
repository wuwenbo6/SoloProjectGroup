# 榫卯家具拆解教学平台

基于前后端分离架构的榫卯家具拆解教学系统，支持3D模型展示、分步拆解教学和学习进度管理。

## 项目架构

### 前端技术栈
- **Vue 3** - 渐进式JavaScript框架
- **Three.js** - 3D模型展示与交互
- **Element Plus** - UI组件库
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **Axios** - HTTP客户端
- **Vite** - 构建工具

### 后端技术栈
- **Spring Boot 3.2** - 后端框架
- **Spring Security + JWT** - 认证授权
- **Spring Data JPA** - ORM框架
- **MySQL** - 关系型数据库（分库存储）

## 数据库设计

采用分库分表设计，三个独立数据库：

1. **mortise_furniture** - 家具模型数据库
   - furniture: 家具基本信息表
   - furniture_part: 家具部件详情表

2. **mortise_teaching** - 教学内容数据库
   - disassemble_step: 拆解步骤表

3. **mortise_user** - 用户数据数据库
   - user: 用户信息表
   - user_roles: 用户角色表
   - learning_progress: 学习进度表

## 功能特性

### 学员端功能
- 用户注册/登录（JWT认证）
- 家具列表浏览
- 3D模型预览与交互（旋转、缩放）
- 分步拆解教学（步骤说明+3D动画演示）
- 部件详情弹窗展示
- 学习进度记录与查询
- 学习时长统计

### 讲师端功能
- 家具模型管理（增删改查）
- 拆解步骤管理
- 教学内容维护

### 3D交互功能
- 模型360度旋转
- 缩放与平移
- 自动旋转演示
- 分步拆解动画
- 部件高亮与详情展示

## 快速开始

### 环境要求
- Node.js 18+
- JDK 17+
- MySQL 8.0+
- Maven 3.8+

### 后端启动

1. 创建数据库
```bash
# 执行初始化脚本
mysql -u root -p < backend/src/main/resources/init.sql
```

2. 修改数据库配置（application.yml）
```yaml
spring:
  datasource:
    furniture:
      jdbc-url: jdbc:mysql://localhost:3306/mortise_furniture
      username: root
      password: your_password
    # 其他数据源同理...
```

3. 启动后端服务
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

后端服务将在 http://localhost:8080 启动

### 前端启动

1. 安装依赖
```bash
cd frontend
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

前端服务将在 http://localhost:5173 启动

### 测试账号
| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| instructor | admin123 | 讲师 |
| student | admin123 | 学员 |

## 项目结构

```
.
├── backend/                    # 后端项目
│   ├── src/
│   │   └── main/
│   │       ├── java/com/mortisejoiner/
│   │       │   ├── config/        # 配置类（多数据源）
│   │       │   ├── controller/    # REST接口
│   │       │   ├── dto/           # 数据传输对象
│   │       │   ├── entity/        # 实体类（分库）
│   │       │   ├── repository/    # 数据访问层
│   │       │   ├── service/       # 业务逻辑层
│   │       │   └── security/      # 安全认证
│   │       └── resources/
│   │           ├── application.yml
│   │           └── init.sql
│   └── pom.xml
└── frontend/                   # 前端项目
    ├── src/
    │   ├── api/                # API接口
    │   ├── components/         # 公共组件
    │   │   └── ThreeViewer.vue # 3D查看器组件
    │   ├── stores/             # Pinia状态管理
    │   ├── views/              # 页面组件
    │   ├── router/             # 路由配置
    │   └── utils/              # 工具函数
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## API接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册

### 家具接口
- `GET /api/furniture/public/list` - 获取家具列表
- `GET /api/furniture/public/{id}` - 获取家具详情
- `GET /api/furniture/public/{id}/parts` - 获取家具部件
- `POST /api/furniture` - 创建家具（讲师）
- `POST /api/furniture/{id}/parts` - 添加部件（讲师）

### 教学接口
- `GET /api/teaching/steps/{furnitureId}` - 获取拆解步骤
- `POST /api/teaching/steps` - 创建步骤（讲师）

### 用户接口
- `GET /api/user/progress` - 获取学习进度
- `POST /api/user/progress/start/{furnitureId}` - 开始学习
- `PUT /api/user/progress/update` - 更新学习进度

## 核心技术点

1. **多数据源配置** - 使用Spring多数据源配置实现分库存储
2. **JWT无状态认证** - 基于Token的用户认证与角色权限控制
3. **Three.js 3D渲染** - 3D模型加载、旋转、分步拆解动画
4. **响应式设计** - 适配不同屏幕尺寸
5. **学习进度追踪** - 实时记录用户学习进度与时长

## 开发计划

- [ ] 支持GLTF/GLB模型文件加载
- [ ] 添加AR增强现实功能
- [ ] 实现多人协作教学功能
- [ ] 添加学习成果分享功能
- [ ] 支持模型上传与在线编辑
- [ ] 添加考试与证书系统

## 许可证

MIT License
