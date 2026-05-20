# Quantum Circuit Simulator

全栈量子电路模拟器，包含Python后端量子模拟器和React前端可视化界面。

## 功能特性

- ✅ 量子门操作：H, X, Y, Z, CNOT, Toffoli
- ✅ Bloch球面3D可视化（Three.js）
- ✅ 拖拽式量子电路编辑器
- ✅ 概率分布和测量结果展示
- ✅ REST API接口
- ✅ SQLite数据库存储历史记录
- ✅ 支持最多30量子比特
- ✅ CUDA加速支持（可选）

## 项目结构

```
p139/
├── backend/                    # 后端
│   ├── app/
│   │   ├── api/               # API路由
│   │   ├── core/              # 核心配置
│   │   ├── models/            # 数据库模型
│   │   └── schemas/           # Pydantic模式
│   ├── quantum/                # 量子模拟器核心
│   │   ├── gates.py           # 量子门定义
│   │   ├── simulator.py       # 模拟器主类
│   │   ├── cpu_backend.py     # CPU计算后端
│   │   └── cuda_backend.py    # CUDA加速后端
│   ├── requirements.txt
│   └── run.py
└── frontend/                   # 前端
    ├── src/
    │   ├── components/        # React组件
    │   ├── store/             # Zustand状态管理
    │   └── services/          # API服务
    ├── package.json
    └── vite.config.ts
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动后端服务
python run.py
```

后端服务将在 http://localhost:8000 启动

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:3000 启动

## API文档

启动后端后，访问 http://localhost:8000/docs 查看Swagger API文档

### 主要接口

- `POST /api/jobs` - 提交量子电路模拟任务
- `GET /api/jobs/{id}` - 获取任务结果
- `GET /api/circuits` - 获取保存的电路列表
- `POST /api/circuits` - 保存量子电路

## 使用说明

1. 从左侧工具箱拖拽量子门到电路区域
2. 双击门可以删除
3. 调整量子比特数量（1-5个）
4. 点击"Run Circuit"运行模拟
5. 查看右侧的概率分布和测量结果
6. Bloch球面会显示每个量子比特的状态

## 技术栈

**后端:**
- FastAPI - Web框架
- SQLAlchemy - ORM
- NumPy - 数值计算
- CuPy - CUDA加速（可选）

**前端:**
- React 18 - UI框架
- TypeScript - 类型安全
- Three.js - 3D可视化
- Zustand - 状态管理
- Chart.js - 图表
- Vite - 构建工具
