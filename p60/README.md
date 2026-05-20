# 榫卯结构分析 API 服务

用于榫卯结构参数录入、受力分析、装配模拟的纯后端 API 服务，支持对接第三方木材力学检测数据。

## 功能特性

### 1. 榫卯结构数据录入接口
- 木材类型管理（增删改查）
- 榫卯结构参数录入与管理
- 支持按榫卯类型筛选
- 用户数据隔离

### 2. 受力分析计算接口
- 轴向载荷应力分析
- 侧向/弯曲载荷应力分析
- 剪切载荷应力分析
- 应力分布可视化数据
- 安全系数计算
- 失效概率预测
- 临界应力点识别

### 3. 装配模拟仿真接口
- 接触压力分布计算
- 装配过程应力分析
- 分阶段装配模拟
- 装配难度评分
- 估计装配时间
- 装配建议生成

### 4. 权限鉴权接口
- 用户注册/登录
- JWT Token 认证
- 角色权限控制
- 用户信息管理

### 5. 第三方检测数据对接接口
- 木材力学检测数据同步
- 检测数据管理与查询
- 检测数据应用到木材类型
- 支持模拟数据测试

## 技术栈

- **框架**: FastAPI 0.109.0
- **数据库**: SQLAlchemy 2.0 + SQLite
- **认证**: JWT + bcrypt
- **HTTP 客户端**: httpx
- **数值计算**: numpy

## 项目结构

```
p60/
├── main.py                 # 应用入口
├── requirements.txt        # 依赖包列表
├── .env                    # 环境变量配置
├── README.md              # 项目说明
└── app/
    ├── __init__.py
    ├── config.py          # 配置管理
    ├── database.py        # 数据库连接
    ├── models.py          # 数据模型
    ├── schemas.py         # Pydantic 模式
    ├── auth.py            # 认证逻辑
    ├── stress_analysis.py    # 应力分析算法
    ├── assembly_simulation.py # 装配模拟算法
    ├── third_party_integration.py  # 第三方数据对接
    └── routers/
        ├── __init__.py
        ├── auth.py        # 认证路由
        ├── structures.py  # 结构管理路由
        ├── analysis.py    # 受力分析路由
        ├── simulation.py  # 装配模拟路由
        └── third_party.py # 第三方数据路由
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
DATABASE_URL=sqlite:///./mortise_tenon.db
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
THIRD_PARTY_API_URL=https://api.wood-testing.com/v1
THIRD_PARTY_API_KEY=your-third-party-api-key
```

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 使用流程

### 1. 注册用户

```bash
POST /auth/register
{
    "username": "your_username",
    "email": "your_email@example.com",
    "password": "your_password"
}
```

### 2. 获取 Token

```bash
POST /auth/token
Content-Type: application/x-www-form-urlencoded

username=your_username&password=your_password
```

### 3. 创建木材类型

```bash
POST /structures/wood-types
Authorization: Bearer <your_token>
{
    "name": "Pine",
    "density": 450.0,
    "elastic_modulus": 12000.0,
    "shear_modulus": 600.0,
    "tensile_strength": 80.0,
    "compressive_strength": 40.0,
    "bending_strength": 75.0,
    "hardness": 2000.0,
    "description": "Pine wood",
    "source": "Local"
}
```

### 4. 创建榫卯结构

```bash
POST /structures/mortise-tenon
Authorization: Bearer <your_token>
{
    "name": "Mortise-Tenon Joint 1",
    "structure_type": "through_tenon",
    "description": "Standard through tenon joint",
    "mortise_width": 20.0,
    "mortise_height": 30.0,
    "mortise_depth": 40.0,
    "tenon_width": 19.8,
    "tenon_height": 29.8,
    "tenon_length": 38.0,
    "fit_clearance": 0.2,
    "shoulder_length": 5.0,
    "wood_type_id": 1
}
```

### 5. 进行受力分析

```bash
POST /analysis/stress
Authorization: Bearer <your_token>
{
    "structure_id": 1,
    "force_direction": "axial_tension",
    "applied_force": 1000.0,
    "use_third_party_data": false
}
```

### 6. 进行装配模拟

```bash
POST /simulation/assembly
Authorization: Bearer <your_token>
{
    "structure_id": 1,
    "assembly_force": 500.0,
    "insertion_depth": 35.0,
    "friction_coefficient": 0.4
}
```

### 7. 同步第三方检测数据（模拟模式）

```bash
POST /third-party/sync?use_mock_data=true
Authorization: Bearer <your_token>
{
    "wood_type_id": 1,
    "external_id": "TEST-001"
}
```

## 数据模型

### User（用户）
- id: 主键
- username: 用户名（唯一）
- email: 邮箱（唯一）
- hashed_password: 哈希密码
- is_active: 激活状态
- role: 角色
- created_at: 创建时间

### WoodType（木材类型）
- id: 主键
- name: 名称（唯一）
- density: 密度 (kg/m³)
- elastic_modulus: 弹性模量 (MPa)
- shear_modulus: 剪切模量 (MPa)
- tensile_strength: 抗拉强度 (MPa)
- compressive_strength: 抗压强度 (MPa)
- bending_strength: 抗弯强度 (MPa)
- hardness: 硬度 (N)
- moisture_content: 含水率 (%)

### MortiseTenonStructure（榫卯结构）
- id: 主键
- name: 名称
- structure_type: 结构类型
- mortise_width/height/depth: 卯眼尺寸
- tenon_width/height/length: 榫头尺寸
- fit_clearance: 配合间隙
- shoulder_length: 肩长
- wood_type_id: 木材类型外键
- owner_id: 所有者外键

### StressAnalysis（受力分析）
- id: 主键
- structure_id: 结构外键
- force_direction: 力方向
- applied_force: 作用力
- max_stress/min_stress/avg_stress: 应力值
- stress_distribution: 应力分布（JSON）
- safety_factor: 安全系数
- failure_probability: 失效概率
- critical_points: 临界点（JSON）
- used_third_party_data: 是否使用第三方数据

### AssemblySimulation（装配模拟）
- id: 主键
- structure_id: 结构外键
- assembly_force: 装配力
- insertion_depth: 插入深度
- friction_coefficient: 摩擦系数
- contact_pressure_distribution: 接触压力分布（JSON）
- stress_during_assembly: 装配应力（JSON）
- assembly_stages: 装配阶段（JSON）
- estimated_assembly_time: 估计装配时间
- difficulty_score: 难度评分
- recommendations: 建议

### ThirdPartyTestData（第三方检测数据）
- id: 主键
- wood_type_id: 木材类型外键
- external_id: 外部ID
- test_date: 检测日期
- test_laboratory: 检测实验室
- 力学性能参数
- raw_data: 原始数据（JSON）
- is_synced: 同步状态
- synced_at: 同步时间

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| DATABASE_URL | 数据库连接URL | sqlite:///./mortise_tenon.db |
| SECRET_KEY | JWT 加密密钥 | - |
| ALGORITHM | JWT 算法 | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | Token 过期时间（分钟） | 30 |
| THIRD_PARTY_API_URL | 第三方API地址 | https://api.wood-testing.com/v1 |
| THIRD_PARTY_API_KEY | 第三方API密钥 | - |

## 开发说明

### 添加新的应力分析模式

1. 在 `app/stress_analysis.py` 中添加新的分析方法
2. 更新 `perform_stress_analysis` 函数中的方向判断

### 扩展第三方数据源

1. 在 `app/third_party_integration.py` 中添加新的客户端类
2. 更新路由以支持新的数据源

## 许可证

MIT License
