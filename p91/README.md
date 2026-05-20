# 胶片照片修复平台

一个基于 React + FastAPI 的前后端分离全栈项目，提供照片上传、智能修复、分享和相册管理功能。

## 技术栈

### 前端
- React 18
- React Router
- Axios
- Tailwind CSS
- Vite

### 后端
- FastAPI
- SQLAlchemy
- Pydantic
- Pillow (图像处理)
- python-jose (JWT认证)
- passlib (密码加密)

### 数据库
- SQLite (分库存储)
  - user.db: 用户信息
  - photo.db: 照片数据
  - repair.db: 修复记录

## 功能特性

- 🔐 用户注册/登录认证
- 📤 照片上传（支持拖拽）
- 🎨 多种修复模式：
  - 全面修复（色彩校正+划痕去除+细节增强+降噪）
  - 色彩校正
  - 划痕去除
  - 细节增强
- 📷 修复前后对比预览
- 💾 我的相册管理
- 🔗 照片分享功能
- ⬇️ 修复照片下载

## 项目结构

```
p91/
├── backend/
│   ├── main.py                 # FastAPI入口文件
│   ├── requirements.txt        # Python依赖
│   └── app/
│       ├── database.py         # 数据库配置
│       ├── models/             # 数据模型
│       │   ├── user.py
│       │   ├── photo.py
│       │   └── repair.py
│       ├── schemas/            # Pydantic模型
│       │   ├── user.py
│       │   ├── photo.py
│       │   └── repair.py
│       ├── api/                # API路由
│       │   ├── auth.py
│       │   └── photos.py
│       └── utils/              # 工具函数
│           ├── auth.py
│           └── repair.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   └── Layout.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── RepairStation.jsx
│       │   ├── Album.jsx
│       │   └── Share.jsx
│       ├── services/
│       │   └── api.js
│       └── styles/
│           └── index.css
└── docs/
    └── database/
```

## 快速开始

### 后端启动

1. 进入后端目录：
```bash
cd backend
```

2. 创建虚拟环境并安装依赖：
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. 启动后端服务：
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档地址：http://localhost:8000/docs

### 前端启动

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

前端地址：http://localhost:5173

## API接口

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 照片接口
- `POST /api/photos/upload` - 上传照片
- `GET /api/photos` - 获取用户照片列表
- `GET /api/photos/{id}` - 获取照片详情
- `PUT /api/photos/{id}` - 更新照片信息
- `DELETE /api/photos/{id}` - 删除照片
- `POST /api/photos/{id}/repair` - 开始修复照片
- `GET /api/photos/repair/{id}` - 获取修复状态
- `POST /api/photos/{id}/share` - 生成分享链接
- `GET /api/photos/share/{token}` - 获取分享的照片

## 使用说明

1. 注册/登录账号
2. 前往修复操作台，上传您的老照片
3. 选择合适的修复模式，点击开始修复
4. 等待修复完成，预览修复效果
5. 可以下载修复后的照片或分享给好友
6. 在我的相册中管理所有照片

## 注意事项

- 请确保前后端同时运行
- 上传的照片会保存在 `backend/uploads` 目录下
- 数据库文件会自动创建在 `backend/` 目录下
