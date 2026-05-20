# 漆器工艺溯源API服务

分布式漆器工艺溯源API服务，实现原料、制作、检测全链路溯源，对接第三方检测机构自动同步数据，支持跨系统调用。

## 技术架构

- **后端框架**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL (分库设计)
  - 工艺数据库 (process_db): 工艺流程、批次管理、用户权限
  - 溯源数据库 (trace_db): 原料管理、生产记录
  - 品质数据库 (quality_db): 品质检测、第三方报告
- **认证**: JWT Token
- **日志**: Winston

## 分库设计

### 1. 工艺数据库 (process_db)
- `craft_processes`: 工艺流程表
- `batches`: 批次管理表
- `users`: 用户权限表

### 2. 溯源数据库 (trace_db)
- `materials`: 原料管理表
- `production_records`: 生产记录表

### 3. 品质数据库 (quality_db)
- `quality_inspections`: 品质检测表
- `third_party_reports`: 第三方检测报告表

## API接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/refresh` - 刷新Token

### 工艺录入接口
- `POST /api/crafts` - 创建工艺流程
- `GET /api/crafts` - 获取工艺列表
- `GET /api/crafts/:craftId` - 获取工艺详情
- `PUT /api/crafts/:craftId` - 更新工艺流程
- `DELETE /api/crafts/:craftId` - 删除工艺流程

### 原料溯源接口
- `POST /api/materials` - 创建原料
- `GET /api/materials` - 获取原料列表
- `GET /api/materials/:materialId` - 获取原料详情
- `PUT /api/materials/:materialId` - 更新原料

### 制作数据采集接口
- `POST /api/production` - 创建生产记录
- `GET /api/production` - 获取生产记录列表
- `GET /api/production/:recordId` - 获取生产记录详情
- `PUT /api/production/:recordId` - 更新生产记录
- `POST /api/production/:recordId/complete` - 完成工序

### 品质检测接口
- `POST /api/quality` - 创建品质检测
- `GET /api/quality` - 获取品质检测列表
- `GET /api/quality/:inspectionId` - 获取品质检测详情
- `PUT /api/quality/:inspectionId` - 更新品质检测

### 批次管理接口
- `POST /api/batches` - 创建批次
- `GET /api/batches` - 获取批次列表
- `GET /api/batches/:batchId` - 获取批次详情
- `PUT /api/batches/:batchId` - 更新批次
- `POST /api/batches/:batchId/start` - 开始批次
- `POST /api/batches/:batchId/complete` - 完成批次

### 第三方检测机构对接接口
- `POST /api/third-party/sync` - 同步第三方检测报告
- `GET /api/third-party` - 获取第三方报告列表
- `GET /api/third-party/:reportId` - 获取第三方报告详情
- `POST /api/third-party` - 手动创建第三方报告
- `GET /api/third-party/traceability/:batchId` - 获取批次完整溯源链

## 安装与运行

### 环境要求
- Node.js >= 16.0.0
- PostgreSQL >= 12.0

### 安装依赖
```bash
npm install
```

### 环境配置
复制 `.env` 文件并配置数据库连接：
```env
PORT=3000
NODE_ENV=development

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# 工艺数据库
DB_PROCESS_HOST=localhost
DB_PROCESS_PORT=5432
DB_PROCESS_NAME=lacquerware_process
DB_PROCESS_USER=postgres
DB_PROCESS_PASSWORD=postgres

# 溯源数据库
DB_TRACE_HOST=localhost
DB_TRACE_PORT=5432
DB_TRACE_NAME=lacquerware_trace
DB_TRACE_USER=postgres
DB_TRACE_PASSWORD=postgres

# 品质数据库
DB_QUALITY_HOST=localhost
DB_QUALITY_PORT=5432
DB_QUALITY_NAME=lacquerware_quality
DB_QUALITY_USER=postgres
DB_QUALITY_PASSWORD=postgres

# 第三方检测机构API
THIRD_PARTY_API_URL=https://api.testing-agency.com
THIRD_PARTY_API_KEY=your-api-key
```

### 开发运行
```bash
npm run dev
```

### 生产构建
```bash
npm run build
npm start
```

## 用户角色与权限

- **admin**: 系统管理员，拥有所有权限
- **artisan**: 工艺师，负责工艺流程管理和生产记录
- **inspector**: 质检员，负责品质检测
- **supervisor**: 主管，负责批次管理
- **viewer**: 访客，只读权限

## 跨系统调用

支持CORS跨域，所有API返回标准JSON格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

## 项目结构

```
├── src/
│   ├── config/          # 配置文件
│   │   ├── databases.ts # 数据库连接配置
│   │   └── logger.ts    # 日志配置
│   ├── controllers/     # 控制器
│   ├── middleware/      # 中间件
│   ├── models/          # 数据模型 (分库)
│   │   ├── process/     # 工艺数据库模型
│   │   ├── trace/       # 溯源数据库模型
│   │   └── quality/     # 品质数据库模型
│   ├── routes/          # 路由
│   └── index.ts         # 应用入口
├── .env                 # 环境变量
├── package.json
├── tsconfig.json
└── README.md
```

## 健康检查

```
GET /health
```
