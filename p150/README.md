# 3D Collaborative Editor

一个基于 Three.js + React + WebRTC + CRDT 的多人协作 3D 模型编辑器。

## 功能特性

- **3D 场景编辑**
  - 支持多种基础几何体（立方体、球体、圆柱体、圆锥体、圆环、平面）
  - 移动、旋转、缩放变换操作
  - 材质属性编辑（颜色、金属度、粗糙度、纹理贴图）

- **GLTF/GLB 导入导出**
  - 从本地文件导入 GLTF/GLB 模型
  - 从 URL 导入 3D 模型
  - 导出场景为 GLTF 或 GLB 格式

- **多人实时协作**
  - 基于 WebSocket 的信令服务器
  - WebRTC DataChannel 点对点通信
  - CRDT (Conflict-free Replicated Data Types) 解决状态合并冲突
  - Client ID 向量时钟冲突解决策略

- **版本管理**
  - 自动保存历史版本
  - 版本回滚功能
  - MongoDB 持久化存储

## 技术栈

### 前端
- React 18
- Three.js
- @react-three/fiber
- @react-three/drei
- Yjs (CRDT)
- Zustand (状态管理)
- Vite (构建工具)

### 后端
- Node.js
- Express
- Socket.io (信令)
- WebSocket (Yjs 同步)
- MongoDB (数据持久化)
- Mongoose (ODM)

## 安装和运行

### 前置要求
- Node.js 16+
- MongoDB (本地或远程)

### 安装依赖

```bash
npm install
```

### 启动 MongoDB

确保 MongoDB 正在运行，默认连接到 `mongodb://localhost:27017/3d-editor`

或者使用 Docker 运行 MongoDB:
```bash
docker run -d -p 27017:27017 --name mongodb mongo
```

### 启动后端服务器

```bash
npm run server:dev
```

服务器将在 http://localhost:8080 启动

### 启动前端开发服务器

```bash
npm run client:dev
```

前端将在 http://localhost:3000 启动

### 同时启动前后端

```bash
npm run dev
```

## 使用说明

1. 打开 http://localhost:3000
2. 点击 "Create New Room" 创建新房间，或输入房间 ID 加入现有房间
3. 使用工具栏添加 3D 对象
4. 点击对象选中，使用变换控件（移动/旋转/缩放）进行编辑
5. 在侧边栏的 Material 标签页编辑材质属性
6. 多个用户加入同一房间即可实时协作编辑
7. 点击 "Save" 按钮保存当前版本
8. 点击 "Versions" 按钮查看历史版本并回滚
9. 点击 "Export GLTF" 或 "Export GLB" 导出场景

## 项目结构

```
├── server/
│   ├── index.js          # 服务器入口
│   └── models/
│       ├── Document.js   # 文档模型
│       └── Version.js    # 版本模型
├── src/
│   ├── components/
│   │   ├── Editor.jsx        # 主编辑器组件
│   │   ├── SceneNode.jsx     # 3D 场景节点
│   │   ├── Toolbar.jsx       # 工具栏
│   │   ├── Sidebar.jsx       # 侧边栏
│   │   ├── VersionHistory.jsx # 版本历史
│   │   └── JoinRoom.jsx      # 加入房间页面
│   ├── store/
│   │   ├── crdtStore.js      # CRDT 状态管理
│   │   └── webrtcStore.js    # WebRTC 连接管理
│   ├── utils/
│   │   └── export.js         # GLTF/GLB 导出工具
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## CRDT 冲突解决机制

本项目使用 Client ID 向量时钟策略解决多人同时编辑同一节点时的冲突：

1. 每个客户端连接时分配唯一的 userId
2. 对于位置、旋转、缩放的每个分量（x, y, z），都单独记录最后修改的客户端 ID
3. 当发生冲突时（多个客户端同时修改同一属性），client ID 较大的客户端的修改生效
4. 这种策略确保最终一致性，所有客户端最终会达到相同的状态

## 材质 URL 处理

为了解决相对路径在不同客户端导致的 404 问题，系统会：

1. 自动将相对路径转换为绝对 URL（基于当前页面 origin）
2. 保留原始 URL 信息
3. 支持 data URL 和各种公共 CDN 资源

## 许可证

MIT
