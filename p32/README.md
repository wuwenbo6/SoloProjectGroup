# 传统手工艺原料溯源系统

基于 Python FastAPI 搭建的分布式高并发接口服务，实现传统手工艺原料全链路溯源。

## 项目架构

### 分布式多模块设计

- **原料信息录入接口** (`app/api/material.py`) - 原料基础信息、产地信息管理
- **溯源数据采集接口** (`app/api/traceability.py`) - 加工步骤、溯源链管理
- **品质分级核算接口** (`app/api/quality.py`) - 品质检测、自动分级算法
- **原料批次管理接口** (`app/api/batch.py`) - 批次、库存、事件管理
- **第三方检测机构对接接口** (`app/api/third_party.py`) - 检测报告同步、认证管理
- **权限鉴权接口** (`app/api/auth.py`) - 用户认证、API Key 管理、Token 验证
- **溯源码接口** (`app/api/tracecode.py`) - 溯源码生成、校验、查询

### 分库存储设计

- **溯源数据库** - RawMaterial, ProcessingStep, TraceabilityChain, OriginInfo
- **品质数据库** - QualityTest, QualityParameter, ColorTest, ToughnessTest, CompositionTest, ThirdPartyReport
- **批次数据库** - MaterialBatch, BatchEvent, InventoryRecord, TraceCode
- **认证数据库** - User, ApiKey

## 核心功能

### 1. 原料全链路溯源

- 原料产地信息采集（经纬度、土壤成分、气候等）
- 加工流程追踪（步骤、操作人员、设备、参数）
- 溯源链全程可视化
- 溯源码生成与扫码验证

### 2. 智能品质分级

基于多维度参数自动计算品质等级：

- **色泽评分** - 颜色空间值、均匀度、光泽度
- **韧性评分** - 抗拉强度、伸长率、抗撕裂、抗弯曲、抗冲击、耐磨性
- **成分评分** - 纤维素、木质素、半纤维素、水分、灰分、杂质、pH 值
- **自定义参数** - 支持自定义检测参数及权重

品质等级：S级 > A级 > B级 > C级 > D级

### 3. 第三方检测对接

- 检测报告同步
- 认证状态管理
- 机构信息统计

### 4. 权限管理

- JWT Token 认证
- API Key 支持（跨系统调用）
- 用户角色管理
- 操作权限控制

## 快速开始

### 安装依赖

```bash
pip3 install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-jose passlib python-multipart python-dotenv requests httpx
```

### 启动服务

```bash
python3 main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问接口文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口一览

### 认证接口 (`/api/v1/auth`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录（获取 Token） |
| GET | `/me` | 获取当前用户信息 |
| PUT | `/change-password` | 修改密码 |
| POST | `/api-key` | 创建 API Key |
| GET | `/api-keys` | 获取 API Key 列表 |
| POST | `/verify` | 验证 Token |

### 原料接口 (`/api/v1/material`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建原料 |
| GET | `/{material_code}` | 获取原料详情 |
| GET | `/` | 获取原料列表（支持筛选） |
| PUT | `/{material_code}` | 更新原料信息 |
| DELETE | `/{material_code}` | 删除原料 |
| POST | `/origin/` | 创建产地信息 |
| GET | `/origin/{material_code}` | 获取产地信息 |

### 溯源接口 (`/api/v1/traceability`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/processing/` | 创建加工步骤 |
| GET | `/processing/{batch_id}` | 获取批次加工步骤 |
| POST | `/chain/` | 创建溯源链 |
| GET | `/chain/{trace_code}` | 获取溯源链详情 |
| GET | `/chains/` | 溯源链列表 |

### 品质接口 (`/api/v1/quality`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/calculate` | 计算品质等级 |
| POST | `/test` | 创建品质检测 |
| GET | `/test/{test_code}` | 获取检测详情 |
| GET | `/test/batch/{batch_id}` | 获取批次检测记录 |
| GET | `/details/{test_id}` | 获取详细检测数据 |
| GET | `/statistics` | 品质统计 |

### 批次接口 (`/api/v1/batch`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建批次 |
| GET | `/{batch_id}` | 获取批次详情 |
| GET | `/` | 批次列表 |
| POST | `/event/` | 添加批次事件 |
| GET | `/event/{batch_id}` | 获取批次事件 |
| POST | `/inventory/` | 库存记录 |
| GET | `/statistics/summary` | 批次统计 |

### 第三方检测接口 (`/api/v1/third-party`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/report/sync/{report_id}` | 同步检测报告 |
| POST | `/report` | 创建检测报告 |
| GET | `/report/{report_id}` | 获取报告详情 |
| GET | `/agencies` | 获取检测机构列表 |
| GET | `/statistics` | 第三方检测统计 |

### 溯源码接口 (`/api/v1/tracecode`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/verify/{trace_code}` | 验证溯源码（公开接口） |
| POST | `/generate` | 生成溯源码 |
| GET | `/scan/{trace_code}` | 扫码获取精简信息 |
| GET | `/batch/{batch_id}` | 获取批次溯源码 |
| GET | `/statistics/summary` | 溯源码统计 |

## 使用示例

### 1. 用户注册并登录

```bash
# 注册
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123",
    "email": "admin@example.com",
    "full_name": "管理员"
  }'

# 登录获取 Token
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123"
```

### 2. 创建原料

```bash
curl -X POST "http://localhost:8000/api/v1/material/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "BAM-001",
    "name": "安徽宣纸原料",
    "category": "造纸原料",
    "origin_province": "安徽",
    "origin_city": "宣城",
    "origin_village": "泾县",
    "longitude": 118.42,
    "latitude": 30.68,
    "craft_type": "传统手工艺"
  }'
```

### 3. 创建批次

```bash
curl -X POST "http://localhost:8000/api/v1/batch/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "BATCH-2024-001",
    "material_code": "BAM-001",
    "material_name": "安徽宣纸原料",
    "quantity": 1000,
    "unit": "kg",
    "warehouse": "主仓库",
    "status": "produced"
  }'
```

### 4. 品质分级计算

```bash
curl -X POST "http://localhost:8000/api/v1/quality/calculate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "BATCH-2024-001",
    "color_test": {
      "color_space": "RGB",
      "r_value": 240,
      "g_value": 235,
      "b_value": 220,
      "uniformity": 92,
      "glossiness": 88
    },
    "toughness_test": {
      "tensile_strength": 95,
      "elongation": 12,
      "tear_resistance": 88,
      "bending_resistance": 90,
      "impact_resistance": 85,
      "wear_resistance": 92,
      "hardness": 80
    },
    "composition_test": {
      "cellulose_content": 92,
      "lignin_content": 3,
      "hemicellulose_content": 5,
      "moisture_content": 8,
      "ash_content": 0.5,
      "impurity_content": 0.3,
      "ph_value": 7.2,
      "organic_matter": 98
    }
  }'
```

### 5. 生成溯源码

```bash
curl -X POST "http://localhost:8000/api/v1/tracecode/generate?batch_id=BATCH-2024-001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. 验证溯源码（公开接口，无需认证）

```bash
curl "http://localhost:8000/api/v1/tracecode/verify/TC20240517XXXXXXXX"
```

## 数据库结构

项目使用 SQLite 分库存储，数据库文件位于：

- `database/traceability/traceability.db` - 溯源数据库
- `database/quality/quality.db` - 品质数据库
- `database/batch/batch.db` - 批次/认证数据库

## 配置说明

复制 `.env.example` 为 `.env` 并修改配置：

```env
APP_NAME=传统手工艺原料溯源系统
APP_VERSION=1.0.0
DEBUG=True

# 数据库配置
TRACEABILITY_DB_URL=sqlite:///./database/traceability/traceability.db
QUALITY_DB_URL=sqlite:///./database/quality/quality.db
BATCH_DB_URL=sqlite:///./database/batch/batch.db

# JWT 配置
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 第三方检测 API
THIRD_PARTY_API_URL=https://api.testing-lab.com/v1
THIRD_PARTY_API_KEY=your-api-key-here
```

## 技术栈

- **Web 框架**: FastAPI 0.109.0
- **数据库 ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic 2.x
- **认证**: JWT (python-jose), passlib
- **异步 HTTP**: httpx
- **服务器**: Uvicorn

## 项目结构

```
p32/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py          # 权限鉴权接口
│   │   ├── material.py      # 原料信息接口
│   │   ├── traceability.py  # 溯源数据接口
│   │   ├── quality.py       # 品质分级接口
│   │   ├── batch.py         # 批次管理接口
│   │   ├── third_party.py   # 第三方检测接口
│   │   └── tracecode.py     # 溯源码接口
│   ├── models/
│   │   ├── traceability.py  # 溯源模型
│   │   ├── quality.py       # 品质模型
│   │   ├── batch.py         # 批次模型
│   │   └── auth.py          # 认证模型
│   ├── schemas/
│   │   ├── material.py      # 原料 Pydantic 模型
│   │   ├── quality.py       # 品质 Pydantic 模型
│   │   ├── batch.py         # 批次 Pydantic 模型
│   │   └── auth.py          # 认证 Pydantic 模型
│   ├── utils/
│   │   ├── security.py      # 安全工具
│   │   ├── trace_code.py    # 溯源码工具
│   │   └── quality_grading.py # 品质分级算法
│   └── core/
│       ├── config.py        # 配置
│       └── database.py      # 数据库连接
├── database/
│   ├── traceability/
│   ├── quality/
│   └── batch/
├── logs/
├── main.py                  # 主入口
├── requirements.txt
├── .env.example
└── README.md
```

## 支持的原料类型

- **古法造纸原料** - 青檀皮、沙田稻草、楮皮、桑皮等
- **传统染料原料** - 蓝草、茜草、紫草、苏木、靛蓝等
- **其他传统手工艺原料** - 木材、竹材、天然纤维等

## 高并发优化

1. **分库分表** - 按业务领域独立数据库
2. **异步支持** - FastAPI 原生异步支持
3. **连接池** - 数据库连接池管理
4. **缓存支持** - 可扩展 Redis 缓存
5. **API 限流** - 内置 API Key 限流机制
