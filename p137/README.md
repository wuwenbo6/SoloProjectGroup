# 协作画板 (Collaborative Whiteboard)

一个基于 React + Fabric.js + WebRTC 的实时协作画板应用，支持多用户同时绘图。

## 功能特性

- ✏️ **绘图工具**: 画笔、矩形、圆形、直线、文字、橡皮
- 🔄 **实时同步**: 通过 WebRTC DataChannel 实现 P2P 实时同步
- 👤 **用户光标**: 显示其他用户的实时光标位置
- ↩️ **撤销/重做**: 完整的操作历史树支持
- 🔒 **防冲突**: 基于 OT (Operational Transformation) 算法的操作冲突解决
- 🎥 **录制回放**: 支持录制绘图过程并回放
- 👥 **会话管理**: 房间系统，支持多人同时在线
- 💾 **Redis 缓存**: 用户状态和会话信息的持久化存储

## 技术栈

### 前端
- React 18
- Fabric.js (画布渲染)
- Socket.io-client (信令通信)
- WebRTC (P2P 数据传输)
- UUID

### 后端
- Node.js + Express
- Socket.io (信令服务器)
- Redis (会话存储)

## 项目结构

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Whiteboard.js      # 画板组件
│   │   │   ├── Whiteboard.css
│   │   │   ├── Toolbar.js         # 工具栏组件
│   │   │   ├── Toolbar.css
│   │   │   ├── UserList.js        # 用户列表组件
│   │   │   └── UserList.css
│   │   ├── context/
│   │   │   └── WhiteboardContext.js  # 全局状态和 WebRTC 管理
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── public/
└── backend/
    ├── src/
    │   └── server.js              # 信令服务器
    └── package.json
```

## 安装和运行

### 前置要求
- Node.js >= 16
- Redis (可选，用于会话持久化)

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 `http://localhost:3001` 启动。

### 2. 启动前端服务

```bash
cd frontend
npm install
npm start
```

前端应用将在 `http://localhost:3000` 启动。

### 3. 使用应用

1. 打开浏览器访问 `http://localhost:3000`
2. 输入房间号和用户名，点击"加入房间"
3. 在另一个浏览器窗口或标签页中以同样的房间号进入
4. 开始协作绘图！

## 核心架构说明

### WebRTC 连接流程

1. 用户加入房间后，通过 Socket.io 连接到信令服务器
2. 服务器广播现有用户列表，新用户与每个现有用户建立 WebRTC 连接
3. 通过信令服务器交换 SDP (Offer/Answer) 和 ICE 候选人
4. 建立 DataChannel 用于传输绘图操作和光标位置

### OT 防冲突算法

每个操作包含版本号，当接收远程操作时：
- 如果版本落后，对操作进行变换以适应当前状态
- 确保所有用户的画布最终一致

### 撤销/重做机制

- 维护操作历史数组和当前索引指针
- 撤销: 索引回退，从画布移除对应对象
- 重做: 索引前进，重新渲染对应对象
- 新操作会截断当前索引之后的历史

## API 接口

- `GET /api/rooms` - 获取所有活跃房间
- `GET /api/room/:roomId/users` - 获取指定房间的用户列表

## 注意事项

1. **Redis**: 如果没有安装 Redis，服务器会自动降级到内存存储，功能不受影响
2. **WebRTC**: 在局域网环境下可以直接连接，公网环境需要配置 TURN 服务器
3. **浏览器兼容性**: 建议使用 Chrome、Firefox 或 Edge 浏览器
4. **性能**: 大量绘图对象可能影响性能，建议定期清理画布

## 未来改进

- [ ] 添加画布缩放和平移
- [ ] 支持图片上传和背景设置
- [ ] 实现图层功能
- [ ] 添加更多图形工具（箭头、多边形等）
- [ ] 实现画布导出为图片/PDF
- [ ] 添加权限控制和管理员功能
- [ ] 实现操作历史的持久化存储
