# 传统手工艺品原料溯源分布式 API 系统

基于微服务架构的传统手工艺品原料溯源系统，实现原料从产地、加工、检测全链路追溯。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端层                                              │
│   [管理后台]  [检测机构系统]  [监管平台]  [消费者端]         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API 网关层 (可选)                          │
│                    Nginx / API Gateway                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              微服务层                                      │
│  [3001]  [3002]      [3003]     [3004]       [3005]       [3006]      │
│  权限鉴权  原料信息    批次管理    溯源采集    品质分级    检测机构对接 │
└─────────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      数据库层                                 │
│  [auth_db]  [material_db]  [trace_db]  [quality_db]       │
└─────────────────────────────────────────────────────────────┘
```

## 服务列表

| 服务名称 | 端口 | 功能描述 | 数据库 |
|---------|------|---------|-------|
| auth-service | 3001 | 用户认证、权限管理、角色管理 | auth_db |
| material-service | 3002 | 原料信息管理、供应商管理 | material_db |
| batch-service | 3003 | 原料批次管理、状态流转 | material_db |
| trace-service | 3004 | 溯源数据采集、链式追溯 | trace_db |
| quality-service | 3005 | 品质分级、检测标准管理 | quality_db |
| testing-service | 3006 | 第三方检测机构对接、数据同步 | quality_db |

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (推荐)

### 方式一：Docker Compose 启动

```bash
# 1. 克隆项目
cd p79

# 2. 启动所有服务
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f
```

### 方式二：本地开发启动

```bash
# 1. 安装所有服务依赖
npm run install:all

# 2. 确保 PostgreSQL 已启动并创建数据库
# auth_db, material_db, trace_db, quality_db

# 3. 分别启动各服务（新终端窗口）
npm run dev:auth
npm run dev:material
npm run dev:batch
npm run dev:trace
npm run dev:quality
npm run dev:testing
```

## 访问各服务的 Swagger 文档：
- 权限服务: http://localhost:3001/api-docs
- 原料服务: http://localhost:3002/api-docs
- 批次服务: http://localhost:3003/api-docs
- 溯源服务: http://localhost:3004/api-docs
- 品质服务: http://localhost:3005/api-docs
- 检测服务: http://localhost:3006/api-docs

## 核心功能

### 1. 权限鉴权服务
- 用户注册/登录
- JWT Token 认证
- 角色权限管理 (ADMIN, QUALITY_INSPECTOR, TESTING_INSTITUTION, REGULATOR, CONSUMER)
- 权限验证中间件

### 2. 原料信息服务
- 原料 CRUD 操作
- 原料分类管理
- 供应商管理
- 原料产地信息

### 3. 批次管理服务
- 批次创建与编号生成
- 批次状态追踪 (created → in_production → quality_checking → qualified/unqualified → delivered)
- 批次位置追踪

### 4. 溯源数据采集
- 各环节数据采集
- 区块链式追溯链条
- 数据哈希校验

### 5. 品质分级核算
- 品质标准管理
- 自动品质评分计算
- 品质等级判定 (A/B/C/D)
- 品质报告生成

### 6. 第三方检测机构对接
- 检测机构管理
- API Key 认证
- 检测数据自动同步
- 检测报告管理

## 技术栈

**后端框架**: Express.js 4.18
**ORM**: Sequelize 6.x
**数据库**: PostgreSQL 15
**认证**: JWT + bcrypt
**文档**: Swagger/OpenAPI 3.0
**日志**: Winston 3.x
**容器化**: Docker + Docker Compose

## 项目结构

```
p79/
├── services/
│   ├── auth-service/          # 权限鉴权服务
│   ├── material-service/      # 原料信息服务
│   ├── batch-service/       # 批次管理服务
│   ├── trace-service/       # 溯源数据服务
│   ├── quality-service/     # 品质分级服务
│   └── testing-service/   # 检测机构对接服务
├── shared/
│   ├── utils/               # 共享工具
│   └── constants/          # 常量定义
├── database/
│   └── init/               # 数据库初始化脚本
├── docker-compose.yml
├── package.json
└── README.md
```

## API 调用示例

### 1. 用户登录
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. 获取原料列表
```bash
curl -X GET http://localhost:3002/api/materials \
  -H "Authorization: Bearer <your-token>"
```

### 3. 创建批次溯源
```bash
curl -X GET http://localhost:3004/api/trace/batch/<batch-id>/full \
  -H "Authorization: Bearer <your-token>"
```

### 4. 第三方检测数据同步
```bash
curl -X POST http://localhost:3006/api/testing/sync \
  -H "x-api-key: <institution-api-key" \
  -H "Content-Type: application/json" \
  -d '{"reportNo":"TEST001","batchId":"...","testItems":[]}'
```

## 开发说明

### 新增权限说明：
- 每个服务都有独立的数据库连接
- 跨服务调用通过 HTTP/REST 实现
- 所有受保护的 API 需要在 Header 中携带 JWT Token
- 第三方检测机构使用独立的 API Key 认证

### 环境变量
各服务的环境变量在对应 .env 文件中配置：
```
PORT=300x
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xxx_db
DB_USERNAME=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-jwt-secret
```

## License

MIT