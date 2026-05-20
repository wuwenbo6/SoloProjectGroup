# 榫卯家具采集系统

## 项目简介

这是一个前后端分离的全栈项目，用于榫卯家具的数据采集、3D展示和工艺说明管理。

## 技术栈

### 后端
- Spring Boot 3.2.0
- MyBatis Plus 3.5.5
- MySQL 8.0
- WebSocket（多人协同编辑）
- Druid 数据库连接池

### 前端
- Vue 3.4
- Vite 5.0
- Element Plus 2.5
- Three.js 0.160（3D展示）
- Vue Router 4.2
- Pinia 2.1
- Axios 1.6

## 项目结构

```
p88/
├── backend/                 # 后端项目
│   ├── src/
│   │   └── main/
│   │       ├── java/com/mortise/furniture/
│   │       │   ├── config/          # 配置类
│   │       │   ├── controller/      # 控制器
│   │       │   ├── entity/          # 实体类
│   │       │   ├── dto/             # 数据传输对象
│   │       │   ├── service/         # 服务层
│   │       │   ├── repository/      # 数据访问层
│   │       │   └── websocket/       # WebSocket处理
│   │       └── resources/
│   │           └── application.yml  # 配置文件
│   └── pom.xml
├── frontend/                # 前端项目
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   ├── components/      # 公共组件
│   │   ├── router/          # 路由配置
│   │   ├── store/           # 状态管理
│   │   ├── api/             # API接口
│   │   ├── utils/           # 工具函数
│   │   └── assets/          # 静态资源
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── uploads/                 # 文件上传目录
```

## 功能模块

### 1. 采集操作台 (Console)
- 家具信息管理（增删改查）
- 榫卯结构管理
- 工艺说明管理
- 3D模型文件上传

### 2. 3D展示页 (Viewer)
- Three.js 3D模型渲染
- 模型旋转、缩放、平移
- 线框/实体模式切换
- 自动旋转展示
- WebSocket 多人协同编辑

### 3. 工艺说明页 (Craft)
- 按家具分类展示工艺
- 难度等级标记（简单/中等/困难）
- 步骤说明自动编号
- 时间线式展示

## 数据库设计

### 分库设计
- **furniture_db**: 家具模型数据库
- **mortise_db**: 榫卯结构数据库
- **craft_db**: 工艺说明数据库

### 主要表结构

#### furniture (家具表)
- id: 主键
- name: 家具名称
- category: 分类
- description: 描述
- modelPath: 3D模型路径
- width/height/depth: 尺寸
- material: 材质
- creator: 创建者
- status: 状态
- createTime/updateTime: 时间戳
- deleted: 逻辑删除标记

#### mortise_structure (榫卯结构表)
- id: 主键
- furnitureId: 关联家具ID
- name: 榫卯名称
- type: 类型
- parameters: 参数JSON
- mortiseWidth/Height/Depth: 卯尺寸
- tenonWidth/Height/Depth: 榫尺寸
- position: 位置
- modelPath: 模型路径

#### craft_instruction (工艺说明表)
- id: 主键
- furnitureId: 关联家具ID
- title: 标题
- content: 详细说明
- steps: 步骤说明
- images/videos: 多媒体资源
- difficulty: 难度等级
- estimatedTime: 预计时间
- tools/materials: 工具/材料

## 快速开始

### 环境要求
- JDK 17+
- Node.js 18+
- MySQL 8.0+
- Maven 3.8+

### 后端启动

1. 创建数据库
```sql
CREATE DATABASE furniture_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE mortise_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE craft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 修改 `backend/src/main/resources/application.yml` 中的数据库连接信息

3. 启动后端服务
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

后端服务将运行在 `http://localhost:8080`

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

前端服务将运行在 `http://localhost:3000`

## API接口

### 家具接口
- `GET /api/furniture/list` - 获取家具列表
- `GET /api/furniture/{id}` - 获取家具详情
- `POST /api/furniture/save` - 保存家具
- `PUT /api/furniture/update` - 更新家具
- `DELETE /api/furniture/{id}` - 删除家具
- `POST /api/furniture/upload` - 上传3D模型

### 榫卯接口
- `GET /api/mortise/list` - 获取榫卯列表
- `GET /api/mortise/{id}` - 获取榫卯详情
- `GET /api/mortise/furniture/{furnitureId}` - 按家具获取榫卯
- `POST /api/mortise/save` - 保存榫卯
- `PUT /api/mortise/update` - 更新榫卯
- `DELETE /api/mortise/{id}` - 删除榫卯

### 工艺接口
- `GET /api/craft/list` - 获取工艺列表
- `GET /api/craft/{id}` - 获取工艺详情
- `GET /api/craft/furniture/{furnitureId}` - 按家具获取工艺
- `POST /api/craft/save` - 保存工艺
- `PUT /api/craft/update` - 更新工艺
- `DELETE /api/craft/{id}` - 删除工艺

### WebSocket 协同
- 连接地址: `ws://localhost:8080/api/ws/collaborate`
- 支持多人实时协同编辑

## 功能特性

1. **分库分表**: 三个独立数据库分别存储家具、榫卯、工艺数据
2. **3D展示**: Three.js 支持 GLB/GLTF/OBJ 等格式
3. **实时协同**: WebSocket 支持多人同时编辑
4. **文件上传**: 支持大文件上传
5. **响应式设计**: 适配不同屏幕尺寸
6. **操作日志**: 完整的CRUD操作记录

## 开发说明

### 前端开发
- 页面组件位于 `frontend/src/views/`
- API 接口定义在 `frontend/src/api/`
- 全局样式在 `frontend/src/assets/styles/`

### 后端开发
- 控制器层: 处理HTTP请求
- 服务层: 业务逻辑处理
- 数据访问层: MyBatis Plus 数据操作
- 配置层: 多数据源、WebSocket等配置

## License

MIT
