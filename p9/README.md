# 字体排版调试工具

一个基于前后端分离的全栈 Web 应用，用于字体上传、预览和字间距调试。

## 功能特性

### 前端功能
- 📁 **字体上传**: 支持 TTF、OTF、WOFF、WOFF2 格式
- 👁️ **实时预览**: 使用自定义字体实时预览排版效果
- 🎨 **排版控制**:
  - 自定义文本内容
  - 字号调节 (12-200px)
  - 字间距调节 (-0.5em ~ 2em)
  - 行高调节 (1 ~ 3)
  - 对齐方式（左对齐、居中、右对齐、两端对齐）
- 🔧 **字间距调试 (Kerning)**:
  - 自定义任意两个字符的间距
  - 实时预览效果
  - 支持保存和重置
- 💾 **配置管理**:
  - 保存排版配置
  - 导出 JSON 格式配置文件

### 后端功能
- ✅ 字体文件校验和解析
- 📊 生成字体元数据（字形列表、字符编码、字距信息）
- 💾 本地文件系统存储字体文件
- 📦 排版配置的持久化存储

## 技术栈

### 前端
- Vue 3 (Composition API)
- TypeScript
- Vite
- opentype.js (字体解析)
- Axios (HTTP 客户端)

### 后端
- NestJS
- Node.js
- TypeScript
- opentype.js
- Multer (文件上传)
- 本地文件系统存储

## 项目结构

```
p9/
├── backend/
│   ├── src/
│   │   ├── main.ts              # 应用入口
│   │   ├── app.module.ts        # 主模块
│   │   └── font/
│   │       ├── font.module.ts     # 字体模块
│   │       ├── font.controller.ts  # API 控制器
│   │       ├── font.service.ts     # 业务逻辑
│   │       └── font.interface.ts # 类型定义
│   ├── uploads/                 # 字体文件存储
│   ├── data/                   # 数据存储
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.vue             # 主应用组件
    │   ├── main.ts             # 入口文件
    │   ├── api.ts              # API 客户端
    │   ├── types.ts            # 类型定义
    │   └── style.css           # 样式文件
    ├── index.html
    └── package.json
```

## 快速开始

### 前置要求
- Node.js >= 18.x
- npm

### 安装依赖

#### 后端
```bash
cd backend
npm install
```

#### 前端
```bash
cd frontend
npm install
```

### 启动开发服务器

#### 启动后端服务 (端口 3000)
```bash
cd backend
npm run start:dev
```

#### 启动前端服务 (端口 5173)
```bash
cd frontend
npm run dev
```

### 访问应用
打开浏览器访问: http://localhost:5173

## API 接口

### 字体相关
- `POST /api/upload` - 上传字体文件
- `GET /api/fonts` - 获取所有字体列表
- `GET /api/fonts/:id` - 获取单个字体详情
- `DELETE /api/fonts/:id` - 删除字体

### 配置相关
- `POST /api/configs` - 保存排版配置
- `GET /api/configs` - 获取所有配置列表
- `GET /api/configs/:id` - 获取单个配置详情
- `DELETE /api/configs/:id` - 删除配置
- `GET /api/configs/:id/export` - 导出配置为 JSON

## 使用说明

1. **上传字体**:
   - 点击左侧上传区域或拖拽字体文件
   - 支持 TTF、OTF、WOFF、WOFF2 格式

2. **预览字体**:
   - 选择已上传的字体
   - 在预览文本框中输入要预览的文字
   - 调整字号、字间距、行高等参数

3. **调试字间距**:
   - 在"字距调试"区域选择两个字符
   - 拖动滑块调整间距值
   - 预览效果会实时更新

4. **保存和导出**:
   - 输入配置名称
   - 点击"保存配置"保存到服务器
   - 点击"导出 JSON"下载配置文件

## 数据存储

- 字体文件存储在 `backend/uploads/` 目录
- 字体和配置的元数据以 JSON 格式存储在 `backend/data/` 目录

## 注意事项

- 最大上传文件大小限制为 10MB
- 请确保后端有足够的磁盘空间存储字体文件
- 建议使用现代浏览器（Chrome、Firefox、Safari、Edge）以获得最佳体验
