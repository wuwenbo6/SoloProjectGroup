# 民族传统服饰纹样数字化平台 - 前端

基于 React + TypeScript + Vite + Tailwind CSS 构建的民族传统服饰纹样数字化采集、编辑、生成平台。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 3
- **状态管理**: Zustand
- **HTTP客户端**: Axios
- **画布编辑**: Fabric.js
- **实时通信**: Socket.io-client
- **路由**: React Router v6
- **图标**: Lucide React

## 功能特性

### 1. 纹样采集操作台
- 支持拖拽上传纹样图片
- 相机调用实时采集
- 批量上传管理
- 素材预览与分类
- 按民族、分类筛选

### 2. 纹样编辑页面
- 集成 Fabric.js 画布
- 手动勾勒纹样轮廓
- 画笔工具、颜色选择
- 图层管理
- 历史记录撤销/重做
- 多人实时协同编辑
- 协作者光标显示
- 实时消息通知

### 3. 图案生成预览页
- 特征参数调节
- 基于 SVG 的智能图案生成
- 实时预览效果
- 图案导出下载
- 历史生成记录

### 4. 用户管理页面
- 用户列表管理
- 角色分配（管理员/设计师/采集员）
- 权限配置
- 操作日志审计
- 用户状态管理

### 5. 实时协同功能
- Socket.io WebSocket 连接
- 多人同时编辑
- 协作者光标实时显示
- 操作实时同步
- 会话管理

## 项目结构

```
src/
├── components/          # 公共组件
│   └── layout/         # 布局组件
│       └── Layout.tsx  # 主布局
├── pages/              # 页面组件
│   ├── Login/          # 登录页
│   ├── Dashboard/      # 仪表盘
│   ├── Capture/        # 采集操作台
│   ├── Materials/      # 素材库
│   ├── Editor/         # 纹样编辑页
│   ├── Generator/      # 图案生成页
│   └── Users/          # 用户管理
├── services/           # 服务层
│   ├── api.ts          # API 客户端
│   └── socket.ts       # Socket 服务
├── store/              # 状态管理
│   └── authStore.ts    # 认证状态
├── types/              # TypeScript 类型
├── styles/             # 全局样式
└── main.tsx            # 应用入口
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问: http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 环境配置

编辑 `vite.config.ts` 配置代理：

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/uploads': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}
```

## 主题配置

自定义主题颜色在 `tailwind.config.js` 中：

- **靛蓝 (indigo)**: 主要品牌色
- **土金 (earth-gold)**: 民族传统色
- **朱砂红 (cinnabar)**: 强调色

## 角色权限

- **管理员 (ADMIN)**: 完整权限，包括用户管理
- **设计师 (DESIGNER)**: 素材编辑、特征提取、图案生成
- **采集员 (COLLECTOR)**: 素材上传、基础编辑

## API 接口

所有 API 请求通过 `src/services/api.ts` 统一管理，包括：

- 认证: `/api/auth/*`
- 用户: `/api/users/*`
- 素材: `/api/materials/*`
- 特征: `/api/features/*`
- 图案: `/api/patterns/*`
- 分类: `/api/categories/*`

## Socket 事件

协同编辑相关 Socket 事件：

- `join_session`: 加入编辑会话
- `leave_session`: 离开会话
- `cursor_move`: 光标移动同步
- `draw_start`: 开始绘制
- `draw_move`: 绘制中
- `draw_end`: 结束绘制
- `send_message`: 发送消息
