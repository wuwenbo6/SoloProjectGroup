# 木雕工艺分布式 API 服务

一个完整的木雕工艺生产管理分布式API服务，包含工艺管理、生产记录、品质检测、批次管理和第三方检测机构对接功能。

## 技术栈

- **Node.js** + **Express.js** - 后端框架
- **MongoDB** + **Mongoose** - 数据库（分库存储）
- **JWT** - 身份认证
- **CORS** - 跨域支持
- **Helmet** - 安全防护
- **Axios** - HTTP客户端

## 项目结构

```
├── src/
│   ├── app.js                    # 主应用入口
│   ├── config/
│   │   └── databases.js          # 多数据库连接配置
│   ├── middleware/
│   │   └── auth.js               # JWT认证和权限中间件
│   ├── models/
│   │   ├── auth/                 # 认证数据库模型
│   │   │   └── User.js
│   │   ├── craft/                # 工艺数据库模型
│   │   │   └── WoodcarvingCraft.js
│   │   ├── production/           # 生产数据库模型
│   │   │   ├── Batch.js
│   │   │   └── ProductionRecord.js
│   │   └── quality/              # 品质数据库模型
│   │       └── QualityInspection.js
│   ├── controllers/              # 控制器
│   │   ├── authController.js
│   │   ├── batchController.js
│   │   ├── craftController.js
│   │   ├── productionController.js
│   │   ├── qualityController.js
│   │   └── thirdPartyController.js
│   └── routes/                   # 路由
│       ├── authRoutes.js
│       ├── batchRoutes.js
│       ├── craftRoutes.js
│       ├── productionRoutes.js
│       ├── qualityRoutes.js
│       └── thirdPartyRoutes.js
├── .env                           # 环境变量配置
├── .env.example                   # 环境变量示例
├── package.json                   # 依赖配置
└── README.md                      # 项目说明
```

## 分库设计

项目采用MongoDB分库设计，实现数据隔离：

1. **woodcarving_auth** - 用户认证数据库
   - 用户信息、角色、权限

2. **woodcarving_craft** - 工艺数据库
   - 木雕工艺模板、工序、材料清单

3. **woodcarving_production** - 生产记录数据库
   - 批次管理、生产记录、工序参数

4. **woodcarving_quality** - 品质检测数据库
   - 检测记录、缺陷报告、纠正措施、第三方对接

## API 接口说明

### 1. 权限鉴权接口 (/api/auth)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/auth/login | 用户登录 | 公开 |
| POST | /api/auth/register | 注册用户 | 管理员 |
| GET | /api/auth/me | 获取当前用户信息 | 已登录 |
| PUT | /api/auth/update-password | 修改密码 | 已登录 |
| GET | /api/auth/users | 获取用户列表 | 管理员 |
| PUT | /api/auth/users/:id | 更新用户信息 | 管理员 |

**用户角色：**
- 管理员 - 系统管理、所有权限
- 工艺师 - 工艺创建、编辑
- 操作员 - 生产记录管理
- 质检员 - 品质检测记录管理
- 第三方机构 - 查看、同步检测报告

### 2. 木雕工艺录入接口 (/api/crafts)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/crafts | 获取工艺列表 | 已登录 |
| POST | /api/crafts | 创建工艺 | 管理员、工艺师 |
| GET | /api/crafts/:id | 获取工艺详情 | 已登录 |
| PUT | /api/crafts/:id | 更新工艺 | 管理员、工艺师 |
| DELETE | /api/crafts/:id | 删除工艺 | 管理员 |
| PUT | /api/crafts/:id/publish | 发布工艺 | 管理员、工艺师 |

### 3. 制作数据采集接口 (/api/production)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/production | 获取生产记录列表 | 已登录 |
| POST | /api/production | 创建生产记录 | 管理员、操作员 |
| GET | /api/production/:id | 获取生产记录详情 | 已登录 |
| PUT | /api/production/:id | 更新生产记录 | 管理员、操作员 |
| PUT | /api/production/:id/complete | 完成生产工序 | 管理员、操作员 |
| PUT | /api/production/:id/parameters | 更新制作参数 | 管理员、操作员 |
| POST | /api/production/:id/images | 上传生产图片 | 管理员、操作员 |

**采集参数：**
- 温度、湿度
- 工具压力
- 雕刻深度
- 雕刻速度
- 木材含水率

### 4. 品质检测接口 (/api/quality)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/quality | 获取检测记录列表 | 已登录 |
| POST | /api/quality | 创建检测记录 | 管理员、质检员 |
| GET | /api/quality/:id | 获取检测记录详情 | 已登录 |
| PUT | /api/quality/:id | 更新检测记录 | 管理员、质检员 |
| PUT | /api/quality/:id/submit | 提交检测记录 | 管理员、质检员 |
| POST | /api/quality/:id/defects | 添加缺陷记录 | 管理员、质检员 |
| POST | /api/quality/:id/corrective-actions | 添加纠正措施 | 管理员、质检员 |
| PUT | /api/quality/:id/corrective-actions/status | 更新纠正措施状态 | 管理员、质检员 |
| POST | /api/quality/:id/images | 上传检测图片 | 管理员、质检员 |
| GET | /api/quality/statistics | 获取品质统计数据 | 已登录 |

### 5. 批次管理接口 (/api/batches)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/batches | 获取批次列表 | 已登录 |
| POST | /api/batches | 创建批次 | 管理员 |
| GET | /api/batches/:id | 获取批次详情 | 已登录 |
| PUT | /api/batches/:id | 更新批次信息 | 管理员 |
| DELETE | /api/batches/:id | 删除批次 | 管理员 |
| PUT | /api/batches/:id/start | 启动批次 | 管理员 |
| PUT | /api/batches/:id/pause | 暂停批次 | 管理员 |
| PUT | /api/batches/:id/complete | 完成批次 | 管理员 |
| PUT | /api/batches/:id/cancel | 取消批次 | 管理员 |
| PUT | /api/batches/:id/progress | 更新批次进度 | 管理员 |
| PUT | /api/batches/:id/assign | 分配批次 | 管理员 |
| GET | /api/batches/statistics | 获取批次统计 | 已登录 |

### 6. 第三方检测机构对接接口 (/api/third-party)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/third-party/report/webhook | 接收第三方报告回调 | 公开（API密钥验证） |
| POST | /api/third-party/inspections/:inspectionId/sync | 同步检测记录到第三方 | 管理员、质检员、第三方机构 |
| GET | /api/third-party/inspections/:inspectionId/report | 获取第三方检测报告 | 管理员、质检员、第三方机构 |
| POST | /api/third-party/batches/:batchId/sync | 批量同步检测记录 | 管理员、质检员、第三方机构 |
| GET | /api/third-party/organizations | 获取第三方机构列表 | 管理员 |
| GET | /api/third-party/test-connection | 测试第三方连接 | 管理员 |

**Webhook回调数据格式：**
```json
{
  "inspectionCode": "QUAL-XXX",
  "reportNumber": "REP-2024-001",
  "organizationName": "国家木材检测中心",
  "result": "合格",
  "remarks": "检测通过，符合GB/T 19001标准"
}
```

## 快速开始

### 1. 环境要求

- Node.js >= 14.0.0
- MongoDB >= 4.0
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并根据实际情况修改：

```bash
cp .env.example .env
```

### 4. 启动 MongoDB

确保MongoDB服务已启动，或使用Docker：

```bash
docker run -d -p 27017:27017 --name woodcarving-mongo mongo:4.4
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 http://localhost:3000 启动

### 6. 健康检查

访问 http://localhost:3000/api/health 确认服务正常运行

## 跨系统调用

API已配置CORS支持，可通过以下方式跨域访问：

- 开发环境：允许所有来源
- 生产环境：通过 `ALLOWED_ORIGINS` 环境变量配置允许的域名

```env
ALLOWED_ORIGINS=http://localhost:8080,https://yourdomain.com
```

## 数据库连接

项目支持独立配置4个数据库连接：

```env
DB_CRAFT_URI=mongodb://localhost:27017/woodcarving_craft
DB_PRODUCTION_URI=mongodb://localhost:27017/woodcarving_production
DB_QUALITY_URI=mongodb://localhost:27017/woodcarving_quality
DB_AUTH_URI=mongodb://localhost:27017/woodcarving_auth
```

可根据需要配置到不同的MongoDB实例或副本集。

## 认证说明

所有需要认证的接口都需要在请求头中携带JWT Token：

```
Authorization: Bearer <your-token>
```

Token有效期：24小时（可通过 `JWT_EXPIRE` 配置）

## 开发建议

1. **日志系统**：建议集成Winston或Pino进行日志管理
2. **文件存储**：图片上传建议对接OSS或S3存储服务
3. **监控告警**：生产环境建议添加APM监控（如New Relic、Datadog）
4. **数据备份**：配置定期数据库备份策略
5. **API文档**：建议集成Swagger进行API文档管理

## 许可证

MIT License