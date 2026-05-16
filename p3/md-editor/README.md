# Markdown 协作编辑器

一个支持离线优先的 Markdown 协作编辑器，基于 Vue3 + Node.js + Socket.io 构建。

## 功能特性

### 前端编辑器
- ✅ Vue3 + CodeMirror 实现的 Markdown 编辑器
- ✅ 实时预览功能
- ✅ 语法高亮（Monokai 主题）
- ✅ 图片粘贴上传（自动转换为 Markdown 格式）
- ✅ 离线优先：文档内容优先存储在 IndexedDB 中
- ✅ 网络恢复后自动同步到后端
- ✅ 多人协作编辑，基于操作转换的冲突解决

### 后端同步服务
- ✅ Node.js + Express + Socket.io 实时通信
- ✅ MongoDB 存储文档元信息和变更序列
- ✅ Redis 存储在线协作用户列表
- ✅ 按文档 ID 拉取历史变更记录
- ✅ 文档版本回退功能
- ✅ 文档权限管理（公开/私有）

## 项目结构

```
md-editor/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── components/
│   │   │   ├── Editor.vue   # 编辑器组件
│   │   │   └── Preview.vue  # 预览组件
│   │   ├── store/
│   │   │   └── document.js  # Pinia 状态管理
│   │   ├── App.vue          # 主应用组件
│   │   └── main.js          # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/                  # 后端项目
│   ├── src/
│   │   ├── socket/
│   │   │   └── sync.js      # Socket.io 同步逻辑
│   │   ├── models/
│   │   │   └── document.js  # MongoDB 数据模型
│   │   └── index.js         # 服务入口
│   └── package.json
└── docker-compose.yml        # MongoDB + Redis 配置
```

## 快速开始

### 1. 启动数据库服务

首先确保已安装 Docker 和 Docker Compose：

```bash
cd md-editor
docker-compose up -d
```

这将启动：
- MongoDB (端口: 27017)
- Redis (端口: 6379)

### 2. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 http://localhost:3001 启动

### 3. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 使用说明

### 基本操作
1. 打开浏览器访问 http://localhost:3000
2. 在左侧编辑器中输入 Markdown 内容
3. 右侧会实时显示渲染后的预览
4. 可以直接粘贴图片到编辑器中，会自动转换为 Markdown 图片格式

### 协作功能
- 打开多个浏览器窗口访问同一地址
- 所有窗口会自动同步编辑内容
- 右上角会显示当前在线用户数量
- 用户头像显示在预览区域右上角

### 离线功能
- 断开网络后仍可继续编辑
- 编辑操作会保存在本地 IndexedDB
- 网络恢复后自动同步所有待处理的操作
- 底部状态栏显示待同步的操作数量

### 版本控制
- 每个编辑操作都会记录版本号
- 支持查看历史变更记录
- 支持回退到指定版本

## 技术栈

### 前端
- Vue 3 (Composition API)
- Pinia (状态管理)
- CodeMirror (代码编辑器)
- Marked (Markdown 解析)
- Dexie.js (IndexedDB 封装)
- Socket.io Client
- Vite (构建工具)

### 后端
- Node.js
- Express
- Socket.io
- Mongoose (MongoDB ODM)
- Redis
- UUID

## 核心实现原理

### 离线优先架构
1. 所有编辑操作首先写入本地 IndexedDB
2. 在线时实时通过 Socket.io 同步到服务器
3. 离线时操作暂存本地队列
4. 网络恢复时批量同步并合并冲突

### 协作编辑算法
采用基于操作转换（Operational Transformation）的简化版本：
- `insert(position, text)` - 在指定位置插入文本
- `delete(position, length)` - 从指定位置删除指定长度文本
- 所有操作按顺序应用，保证最终一致性

### 数据存储
- **MongoDB**: 存储文档元数据、完整内容、变更历史
- **Redis**: 存储文档在线用户列表，快速查询
- **IndexedDB**: 浏览器端本地存储，离线编辑的基础

## API 接口

### Socket.io 事件

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `join-document` | 客户端→服务端 | 加入文档协作 |
| `operation` | 双向 | 发送/接收编辑操作 |
| `sync-changes` | 客户端→服务端 | 同步离线期间的变更 |
| `document-loaded` | 服务端→客户端 | 文档加载完成 |
| `sync-complete` | 服务端→客户端 | 同步完成 |
| `user-joined` | 服务端→客户端 | 用户加入通知 |
| `user-left` | 服务端→客户端 | 用户离开通知 |
| `get-history` | 客户端→服务端 | 获取历史变更 |
| `revert-to-version` | 客户端→服务端 | 回退到指定版本 |
| `set-permission` | 客户端→服务端 | 设置文档权限 |

## 注意事项

1. 当前图片存储为 base64 内联在文档中，大图片可能影响性能
2. 生产环境建议配置：
   - MongoDB 认证
   - Redis 密码
   - HTTPS/WSS 加密
3. 可根据需要扩展：
   - 用户认证系统
   - 文件上传服务（替代 base64）
   - 更复杂的 CRDT 算法
   - 文档分享链接

## License

MIT
