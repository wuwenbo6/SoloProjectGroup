# 戏曲道具分布式API服务

一个功能完整的分布式API系统，用于管理戏曲道具的制作流程、品质检测和第三方机构数据同步。

## 功能特性

### 1. 道具工艺录入接口 (`/api/process`)
- 工艺模板创建、查询、更新、删除
- 支持多步骤工艺定义
- 工艺参数标准化配置
- 材料清单管理

### 2. 制作数据采集接口 (`/api/production`)
- 生产记录创建和追踪
- 工序参数实时采集
- 步骤状态更新
- 道具序列号唯一标识

### 3. 品质检测接口 (`/api/quality`)
- 品质检测记录管理
- 多检测项支持
- 检测结果自动判定
- 检测文件附件管理

### 4. 批次管理接口 (`/api/batches`)
- 生产批次创建和追踪
- 批次状态管理
- 优先级设置
- 批次进度监控

### 5. 第三方检测机构对接接口 (`/api/third-party`)
- 检测数据自动同步
- 第三方数据拉取
- 同步记录追踪
- 失败重试机制

### 6. 权限鉴权接口 (`/api/auth`)
- 用户注册和登录
- JWT令牌认证
- 角色权限管理
- 令牌刷新机制

## 数据库分库设计

系统采用MongoDB分库存储，实现数据隔离和性能优化：

| 数据库 | 存储内容 | 连接名称 |
|--------|----------|----------|
| prop_process_db | 工艺模板数据 | processDB |
| prop_production_db | 生产记录和批次数据 | productionDB |
| prop_quality_db | 品质检测和同步记录 | qualityDB |
| prop_auth_db | 用户和权限数据 | authDB |

## 项目结构

```
opera-prop-api/
├── config/
│   ├── databases.js        # 多数据库连接配置
│   └── logger.js          # 日志配置
├── models/
│   ├── auth/              # 认证相关模型
│   │   └── User.js
│   ├── process/           # 工艺相关模型
│   │   └── ProcessTemplate.js
│   ├── production/        # 生产相关模型
│   │   ├── ProductionRecord.js
│   │   └── Batch.js
│   └── quality/           # 品质相关模型
│       ├── QualityInspection.js
│       └── ThirdPartySyncRecord.js
├── controllers/           # 业务控制器
│   ├── authController.js
│   ├── processController.js
│   ├── productionController.js
│   ├── batchController.js
│   ├── qualityController.js
│   └── thirdPartyController.js
├── middleware/            # 中间件
│   └── auth.js           # 认证和权限中间件
├── routes/               # 路由定义
│   ├── authRoutes.js
│   ├── processRoutes.js
│   ├── productionRoutes.js
│   ├── batchRoutes.js
│   ├── qualityRoutes.js
│   └── thirdPartyRoutes.js
├── logs/                 # 日志文件目录
├── .env                  # 环境配置
├── .env.example          # 环境配置示例
├── package.json
├── server.js             # 服务入口
└── README.md
```

## 快速开始

### 前置要求

- Node.js >= 14.0.0
- MongoDB >= 4.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

配置项说明：

- `PORT`: 服务端口，默认3000
- `JWT_SECRET`: JWT加密密钥
- `DB_*_URI`: 各数据库连接地址
- `THIRD_PARTY_API_URL`: 第三方检测机构API地址
- `THIRD_PARTY_API_KEY`: 第三方API密钥

### 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### 验证服务

访问健康检查接口：
```bash
curl http://localhost:3000/api/health
```

## API使用示例

### 1. 用户认证

注册：
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"123456","role":"admin"}'
```

登录：
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

### 2. 创建工艺模板

```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "templateName": "凤冠制作工艺",
    "propType": "headwear",
    "propName": "凤冠",
    "description": "传统戏曲凤冠制作工艺",
    "steps": [
      {
        "stepName": "胎体制作",
        "stepOrder": 1,
        "parameters": [
          {"name": "温度", "unit": "℃", "minValue": 20, "maxValue": 25, "required": true}
        ],
        "estimatedDuration": 120
      }
    ],
    "materials": [
      {"name": "绸缎", "quantity": 5, "unit": "米", "specification": "真丝"}
    ]
  }'
```

### 3. 创建生产批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "processTemplateId": "TEMPLATE_ID",
    "propName": "凤冠",
    "propType": "headwear",
    "quantity": 10,
    "priority": "high"
  }'
```

### 4. 采集生产数据

```bash
curl -X PUT http://localhost:3000/api/production/step-parameters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "recordId": "PRODUCTION_RECORD_ID",
    "stepIndex": 0,
    "parameters": [
      {"paramName": "温度", "paramValue": 22, "unit": "℃"}
    ]
  }'
```

### 5. 提交品质检测

```bash
curl -X POST http://localhost:3000/api/quality \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productionRecordId": "PRODUCTION_RECORD_ID",
    "inspectionType": "final",
    "inspectionItems": [
      {
        "itemName": "外观检查",
        "standard": "无瑕疵",
        "method": "目视",
        "actualValue": "合格",
        "result": "pass"
      }
    ]
  }'
```

### 6. 同步到第三方机构

```bash
curl -X POST http://localhost:3000/api/third-party/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "inspectionId": "INSPECTION_ID",
    "agencyCode": "QUALITY_AUTH"
  }'
```

## 用户角色和权限

| 角色 | 权限 |
|------|------|
| admin | 全部权限 |
| manager | 工艺管理、批次管理、品质检测、第三方同步 |
| operator | 生产数据采集 |
| inspector | 品质检测 |
| viewer | 数据查看 |

## 安全特性

- JWT令牌认证
- 密码bcrypt加密
- Helmet安全头
- CORS跨域保护
- 请求频率限制
- 角色权限控制

## 日志系统

系统集成winston日志库，日志分类存储：
- `logs/error.log`: 错误日志
- `logs/combined.log`: 综合日志
- 控制台输出（开发环境）

## 跨系统调用支持

API设计支持跨系统调用：
- 标准RESTful接口
- JSON数据格式
- CORS跨域支持
- JWT令牌认证
- 统一响应格式

## 技术栈

- **框架**: Express.js
- **数据库**: MongoDB (Mongoose ODM)
- **认证**: JWT
- **加密**: bcryptjs
- **HTTP客户端**: axios
- **日志**: winston
- **安全**: helmet, cors, express-rate-limit

## License

MIT
