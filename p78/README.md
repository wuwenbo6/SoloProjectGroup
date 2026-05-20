# 古法酿造原料溯源系统 - 分布式API服务

基于微服务架构的古法酿造原料产地、加工、检测全链路溯源API系统。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (3000)                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│   Auth Svc    │    │  Material Svc │    │   Trace Svc    │
│    (3001)     │    │     (3002)    │    │     (3003)    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│  Quality Svc  │    │   Batch Svc   │    │ ThirdParty Svc│
│     (3004)    │    │     (3005)    │    │     (3006)    │
└───────────────┘    └───────────────┘    └───────────────┘
```

## 服务说明

| 服务 | 端口 | 功能说明 | 数据库 |
|------|------|----------|--------|
| API Gateway | 3000 | 统一入口、路由转发、健康检查 | - |
| 权限鉴权服务 | 3001 | 用户认证、JWT令牌、API密钥管理 | auth_db |
| 原料信息服务 | 3002 | 原料录入、分类管理、产地信息 | material_db |
| 溯源数据服务 | 3003 | 产地、加工、运输全链路记录 | trace_db |
| 品质分级服务 | 3004 | 品质评分、分级核算、检测报告 | quality_db |
| 批次管理服务 | 3005 | 批次创建、流转记录、库存管理 | batch_db |
| 第三方对接服务 | 3006 | 检测机构对接、数据同步、Webhook | - |

## 技术栈

- **后端框架**: Node.js + Express.js
- **数据库**: PostgreSQL (分库分表)
- **认证授权**: JWT + RBAC权限控制
- **服务通信**: HTTP/REST + API Gateway
- **数据验证**: Joi
- **日志**: Morgan
- **安全**: Helmet + CORS

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置:

```bash
cp .env.example .env
```

### 3. 初始化数据库

每个服务目录下都有对应的数据库初始化脚本:

```bash
# 示例：初始化认证数据库
psql -U postgres -f services/auth-service/database/init.sql
```

### 4. 启动服务

#### 方式一：单独启动每个服务

```bash
# 启动认证服务
npm run start:auth

# 启动原料服务
npm run start:material

# 启动溯源服务
npm run start:trace

# 启动品质服务
npm run start:quality

# 启动批次服务
npm run start:batch

# 启动第三方对接服务
npm run start:thirdparty

# 启动API网关
npm run start:gateway
```

#### 方式二：使用PM2批量启动

```bash
# 安装PM2
npm install -g pm2

# 启动所有服务
pm2 start process.json

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

### 5. 验证服务

访问 http://localhost:3000 查看网关信息

访问 http://localhost:3000/api/health 查看所有服务健康状态

## API接口文档

### 认证服务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | 公开 |
| POST | /api/auth/login | 用户登录 | 公开 |
| GET | /api/auth/me | 获取当前用户 | 需要认证 |
| POST | /api/auth/api-key | 创建API密钥 | 管理员 |
| GET | /api/auth/api-key | 获取API密钥列表 | 管理员 |
| POST | /api/auth/api-key/validate | 验证API密钥 | 公开 |

### 原料信息服务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/materials | 获取原料列表 | 公开 |
| GET | /api/materials/:id | 获取原料详情 | 公开 |
| POST | /api/materials | 创建原料 | 管理员/经理 |
| PUT | /api/materials/:id | 更新原料 | 管理员/经理 |
| GET | /api/materials/categories | 获取分类列表 | 公开 |
| POST | /api/materials/categories | 创建分类 | 管理员/经理 |

### 溯源数据服务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/trace | 获取溯源记录列表 | 公开 |
| GET | /api/trace/:id | 获取溯源记录详情 | 公开 |
| POST | /api/trace | 创建溯源记录 | 需要认证 |
| GET | /api/trace/chain/:batch_id | 获取批次完整溯源链 | 公开 |
| POST | /api/trace/origin | 产地信息采集 | 需要认证 |
| POST | /api/trace/processing | 加工信息采集 | 需要认证 |
| POST | /api/trace/transport | 运输信息采集 | 需要认证 |

### 品质分级服务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/quality | 获取检测列表 | 公开 |
| GET | /api/quality/:id | 获取检测详情 | 公开 |
| POST | /api/quality | 创建检测记录 | 需要认证 |
| GET | /api/quality/batch/:batch_id | 获取批次检测记录 | 公开 |
| GET | /api/quality/grades | 获取品质等级列表 | 公开 |
| POST | /api/quality/calculate | 计算品质评分 | 需要认证 |

### 批次管理服务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/batches | 获取批次列表 | 公开 |
| GET | /api/batches/:id | 获取批次详情 | 公开 |
| GET | /api/batches/no/:batch_no | 按批号查询 | 公开 |
| POST | /api/batches | 创建批次 | 管理员/经理 |
| PUT | /api/batches/:id/status | 更新批次状态 | 管理员/经理 |
| GET | /api/batches/:batch_id/flow | 获取流转记录 | 公开 |
| POST | /api/batches/:batch_id/flow | 添加流转记录 | 需要认证 |

### 第三方检测服务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/thirdparty/inspection | 创建检测任务 | 管理员/经理 |
| GET | /api/thirdparty/inspection/:task_id/status | 获取检测状态 | 公开 |
| GET | /api/thirdparty/inspection/:task_id/report | 获取检测报告 | 公开 |
| POST | /api/thirdparty/webhook | 接收Webhook回调 | 公开 |
| POST | /api/thirdparty/sync | 同步检测数据 | 需要认证 |
| GET | /api/thirdparty/labs | 获取检测机构列表 | 公开 |

## 数据库设计

系统采用分库存储策略，每个服务拥有独立的数据库：

1. **auth_db** - 认证权限库
   - users - 用户表
   - api_keys - API密钥表

2. **material_db** - 原料信息库
   - materials - 原料主表
   - material_categories - 原料分类表

3. **trace_db** - 溯源记录库
   - trace_records - 溯源主记录表
   - origin_records - 产地记录表
   - processing_records - 加工记录表
   - transport_records - 运输记录表

4. **quality_db** - 品质数据库
   - quality_inspections - 品质检测表
   - quality_grades - 品质等级表
   - quality_standards - 品质标准表

5. **batch_db** - 批次管理库
   - material_batches - 原料批次表
   - batch_flow_records - 批次流转记录表
   - inventory - 库存表

## 权限控制

系统采用基于角色的访问控制(RBAC):

| 角色 | 说明 | 权限范围 |
|------|------|----------|
| admin | 管理员 | 所有操作权限 |
| manager | 经理 | 业务数据增删改查 |
| user | 普通用户 | 数据录入、查询 |

## 部署说明

### 生产环境部署

1. 配置Nginx反向代理
2. 启用HTTPS
3. 配置数据库连接池
4. 设置日志轮转
5. 配置监控告警

### Docker部署

```dockerfile
# 待补充Dockerfile和docker-compose.yml
```

## 开发规范

1. 统一响应格式:
```javascript
{
  success: boolean,
  message: string,
  data: any,
  timestamp: string
}
```

2. 分页响应格式:
```javascript
{
  success: boolean,
  message: string,
  data: any[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  },
  timestamp: string
}
```

## 许可证

MIT License
