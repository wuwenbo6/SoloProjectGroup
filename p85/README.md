# 古法造纸原料溯源系统

基于微服务架构的古法造纸原料全链路溯源管理系统。

## 技术栈

### 后端
- Node.js + Express + TypeScript
- Sequelize ORM
- PostgreSQL（分库存储）
- JWT 认证
- API 网关（限流、路由转发）

### 前端
- React 18 + TypeScript
- Tailwind CSS
- Zustand 状态管理
- Recharts 图表库
- Vite 构建工具

## 系统架构

```
                    ┌─────────────┐
                    │   API 网关  │ (端口 3000)
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ 认证服务 │       │ 原料服务 │       │ 采集服务 │
   │ (3001)  │       │ (3002)  │       │ (3003)  │
   └─────────┘       └─────────┘       └─────────┘
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ 检测服务 │       │ 批次服务 │       │第三方对接│
   │ (3004)  │       │ (3005)  │       │ (3006)  │
   └─────────┘       └─────────┘       └─────────┘
```

## 数据库设计

系统采用分库设计，三个独立数据库：

| 数据库 | 说明 | 表 |
|--------|------|-----|
| material_db | 原料库 | users, materials |
| collection_db | 采集库 | collections |
| inspection_db | 检测库 | inspections, third_party_agencies |

## 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 14+
- npm 或 yarn

### 1. 数据库初始化

```bash
# 创建三个数据库
psql -U postgres -c "CREATE DATABASE material_db;"
psql -U postgres -c "CREATE DATABASE collection_db;"
psql -U postgres -c "CREATE DATABASE inspection_db;"

# 执行初始化脚本
psql -U postgres -d material_db -f backend/database/init.sql
```

### 2. 后端启动

```bash
cd backend

# 安装依赖
npm install

# 方式一：使用 concurrently 启动所有服务
npm run dev

# 方式二：分别启动各个服务
# 启动认证服务
npm run dev:auth

# 启动原料服务
npm run dev:material

# 启动采集服务
npm run dev:collection

# 启动检测服务
npm run dev:inspection

# 启动批次服务
npm run dev:batch

# 启动第三方对接服务
npm run dev:third-party

# 启动API网关
npm run dev:gateway
```

### 3. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 默认账号

系统初始化后包含以下测试账号：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | admin | 超级管理员 |
| material_manager | pass123 | material_manager | 原料管理员 |
| collector | pass123 | collector | 采集员 |
| inspector | pass123 | inspector | 质检员 |
| batch_manager | pass123 | batch_manager | 批次管理员 |
| third_party | pass123 | third_party | 第三方机构 |

## API 文档

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/refresh` - 刷新 Token

### 原料接口
- `GET /api/materials` - 获取原料列表
- `GET /api/materials/:id` - 获取原料详情
- `POST /api/materials` - 创建原料
- `PUT /api/materials/:id` - 更新原料
- `DELETE /api/materials/:id` - 删除原料

### 采集接口
- `GET /api/collection` - 获取采集记录列表
- `GET /api/collection/:id` - 获取采集记录详情
- `POST /api/collection` - 创建采集记录
- `POST /api/collection/sync` - 批量同步采集数据
- `GET /api/collection/statistics` - 采集统计

### 检测接口
- `GET /api/inspection/inspections` - 获取检测记录列表
- `POST /api/inspection/inspections` - 创建检测记录
- `GET /api/inspection/inspections/statistics` - 检测统计
- `GET /api/inspection/agencies` - 获取第三方机构列表

### 批次接口
- `GET /api/batches` - 获取批次列表
- `POST /api/batches` - 创建批次
- `GET /api/batches/trace/:batchNo` - 批次全链路溯源
- `GET /api/batches/statistics` - 批次统计

### 第三方对接接口
- `POST /api/third-party/webhook` - 接收第三方检测数据回调

## 项目结构

```
.
├── backend/                    # 后端项目
│   ├── src/
│   │   ├── services/          # 微服务
│   │   │   ├── auth/         # 认证服务
│   │   │   ├── material/     # 原料服务
│   │   │   ├── collection/   # 采集服务
│   │   │   ├── inspection/   # 检测服务
│   │   │   ├── batch/        # 批次服务
│   │   │   └── third-party/  # 第三方对接
│   │   ├── gateway/           # API 网关
│   │   └── shared/            # 共享模块
│   ├── database/              # 数据库脚本
│   └── package.json
│
└── frontend/                   # 前端项目
    ├── src/
    │   ├── pages/             # 页面组件
    │   ├── components/        # 公共组件
    │   ├── store/             # 状态管理
    │   └── services/          # API 服务
    └── package.json
```

## 核心功能

1. **原料信息管理** - 原料基础信息、产地、分类管理
2. **采集数据同步** - 采集记录录入、批量同步、GPS定位
3. **品质检测管理** - 内部检测、第三方检测机构对接
4. **批次溯源查询** - 生产批次管理、全链路溯源
5. **第三方机构对接** - Webhook 回调、签名验证
6. **权限认证系统** - JWT 认证、角色权限控制

## 许可证

MIT
