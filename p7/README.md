# LaTeX Collaborative Editor

基于 CRDT 算法的实时协同 LaTeX 编辑器，支持多人实时编辑、公式预览和版本回退。

## 功能特性

### 前端
- **Monaco Editor 集成**: 使用 VSCode 同款编辑器，支持 LaTeX 语法高亮
- **实时 LaTeX 渲染**: 使用 KaTeX 实现公式实时预览
- **CRDT 协同**: 使用 Yjs 实现 Conflict-free Replicated Data Types
- **用户状态同步**: 显示其他用户的光标位置和编辑状态
- **离线支持**: CRDT 算法天然支持离线编辑

### 后端
- **WebSocket 服务器**: 基于 Node.js + ws 实现实时通信
- **CRDT 操作广播**: 自动处理并发编辑冲突
- **Redis 缓存**: 存储当前会话状态和文档内容
- **PostgreSQL 持久化**: 存储历史版本和快照

### 核心功能
- ✅ 多人实时协同编辑
- ✅ 自动快照 (每30秒)
- ✅ 版本历史和回退
- ✅ 用户光标位置同步
- ✅ LaTeX 公式实时预览
- ✅ 冲突自动解决 (CRDT)

## 项目结构

```
p7/
├── backend/
│   ├── src/
│   │   ├── server.js          # 主服务器入口
│   │   ├── config.js          # 配置文件
│   │   ├── db/
│   │   │   ├── redis.js       # Redis 连接
│   │   │   └── postgres.js    # PostgreSQL 连接
│   │   └── services/
│   │       ├── collabService.js    # 协同服务
│   │       └── documentService.js  # 文档服务
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # 主应用组件
│   │   ├── main.jsx           # 入口文件
│   │   ├── index.css          # 样式文件
│   │   └── services/
│   │       ├── collabClient.js    # 协同客户端
│   │       ├── latexRenderer.js   # LaTeX 渲染
│   │       └── api.js             # API 客户端
│   ├── vite.config.js
│   └── package.json
└── package.json
```

## 快速开始

### 前置要求

- Node.js >= 18
- Redis >= 6
- PostgreSQL >= 14

### 1. 启动依赖服务

使用 Docker 启动 Redis 和 PostgreSQL:

```bash
docker run -d -p 6379:6379 redis
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
```

### 2. 安装依赖

```bash
# 根目录安装并发依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 3. 启动开发服务器

```bash
# 方式1: 分别启动
cd backend && npm run dev    # 后端端口: 3001
cd frontend && npm run dev   # 前端端口: 3000

# 方式2: 使用根目录脚本 (需要先分别安装依赖)
npm run dev
```

### 4. 访问应用

打开浏览器访问: http://localhost:3000

打开多个浏览器标签测试多人协同编辑功能！

## API 接口

### 文档管理
- `POST /api/documents` - 创建新文档
- `GET /api/documents/:id` - 获取文档信息

### 快照管理
- `GET /api/documents/:id/snapshots` - 获取所有快照
- `POST /api/documents/:id/revert/:snapshotId` - 回退到指定快照

## WebSocket 消息协议

### 客户端 -> 服务器
```json
{ "type": "UPDATE", "payload": { "update": [...] } }
{ "type": "CURSOR", "payload": { "cursor": {...} } }
```

### 服务器 -> 客户端
```json
{ "type": "SYNC", "payload": { "update": [...], "content": "..." } }
{ "type": "UPDATE", "payload": { "update": [...], "userId": "..." } }
{ "type": "USERS_PRESENCE", "payload": { "users": [...] } }
{ "type": "SNAPSHOT_CREATED", "payload": { "version": 1, "timestamp": ... } }
{ "type": "DOCUMENT_REVERTED", "payload": { "content": "...", "version": 1 } }
```

## 技术栈

### 前端
- React 18
- Vite
- Monaco Editor (@monaco-editor/react)
- Yjs (CRDT)
- y-monaco (Monaco 绑定)
- KaTeX (LaTeX 渲染)

### 后端
- Node.js
- Express
- ws (WebSocket)
- ioredis
- pg (PostgreSQL)
- Yjs

## 开发说明

### CRDT 工作原理

使用 Yjs 的 YText 类型实现文本协同:
1. 每个客户端维护本地 Yjs 文档
2. 编辑操作被编码为更新消息
3. 通过 WebSocket 广播到其他客户端
4. 接收方应用更新，自动合并冲突

### 快照机制

- 每 30 秒自动创建快照
- 快照存储在 PostgreSQL
- 支持随时回退到历史版本

### 用户状态同步

- 光标位置实时同步
- 用户姓名和颜色标识
- 在线状态实时显示

## License

MIT
