# 古法造纸全链路管理系统

## 项目概述

本系统是为古法造纸行业量身定制的全链路管理平台，采用前后端分离架构，实现从原料入厂、生产工序、品质检测到成品溯源的全流程数字化管理。

### 技术栈

**后端：**
- Spring Boot 3.2.0
- MyBatis Plus 3.5.5
- MySQL 8.0
- JWT 认证

**前端：**
- Vue 3.4
- Vite 5.0
- Element Plus
- Pinia 状态管理
- Vue Router

## 项目结构

```
p58/
├── backend/                          # 后端Spring Boot项目
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/papermanagement/
│   │   │   │   ├── config/          # 配置类
│   │   │   │   ├── controller/      # 控制器
│   │   │   │   ├── dto/             # 数据传输对象
│   │   │   │   ├── entity/          # 实体类
│   │   │   │   ├── mapper/          # 数据访问层
│   │   │   │   ├── service/         # 业务逻辑层
│   │   │   │   └── util/            # 工具类
│   │   │   └── resources/
│   │   │       └── application.yml  # 配置文件
│   │   └── docs/
│   │       └── init.sql             # 数据库初始化脚本
│   └── pom.xml
└── frontend/                         # 前端Vue3项目
    ├── src/
    │   ├── api/                      # API接口
    │   ├── views/                    # 页面组件
    │   ├── router/                   # 路由配置
    │   ├── store/                    # 状态管理
    │   ├── utils/                    # 工具函数
    │   └── assets/styles/            # 样式文件
    ├── index.html
    └── package.json
```

## 核心功能

### 1. 用户权限管理
- **多角色支持**：管理员、工匠、质检员
- **JWT认证**：安全的token认证机制
- **权限控制**：基于角色的页面访问控制

### 2. 工序操作台
- 工序节点配置（8个标准工序）
- 开始/完成工序操作
- 工艺参数实时记录
- 工序进度跟踪
- 异常预警提醒

### 3. 品质检测
- 质检报告创建与管理
- 多维度质量指标（厚度、密度、抗张强度、白度）
- 自动质量分级判定（优秀、良好、合格、不合格）
- 质检记录查询与追溯

### 4. 溯源查询
- 溯源码生成
- 全链路信息追溯（原料、工序、质检）
- 验证次数统计
- 溯源信息展示

### 5. 原料管理
- 原料入库登记
- 原料信息维护
- 质量等级记录
- 批次追溯

## 快速开始

### 后端启动

1. **创建数据库**
```sql
CREATE DATABASE paper_management DEFAULT CHARACTER SET utf8mb4;
```

2. **执行初始化脚本**
```bash
# 执行 backend/docs/init.sql
```

3. **修改数据库配置**
编辑 `backend/src/main/resources/application.yml`：
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/paper_management
    username: your_username
    password: your_password
```

4. **启动后端服务**
```bash
cd backend
mvn clean install
mvn spring-boot:run
```
后端服务将在 http://localhost:8080 启动

### 前端启动

1. **安装依赖**
```bash
cd frontend
npm install
```

2. **启动开发服务**
```bash
npm run dev
```
前端服务将在 http://localhost:3000 启动

3. **构建生产版本**
```bash
npm run build
```

## 测试账号

系统预置以下测试账号：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | 123456 | 管理员 | 拥有所有权限 |
| craftsman1 | 123456 | 工匠 | 工序操作台权限 |
| inspector1 | 123456 | 质检员 | 品质检测权限 |

## API接口说明

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册

### 工序接口
- `GET /api/process/nodes` - 获取工序节点列表
- `GET /api/process/list` - 获取工序列表
- `POST /api/process/start` - 开始工序
- `PUT /api/process/complete/{id}` - 完成工序
- `GET /api/process/abnormal` - 获取异常列表

### 质检接口
- `GET /api/quality/list` - 获取质检报告列表
- `POST /api/quality/report` - 创建质检报告
- `GET /api/quality/report/{id}` - 获取报告详情

### 溯源接口
- `POST /api/trace/generate` - 生成溯源码
- `GET /api/trace/verify/{traceCode}` - 验证溯源码
- `GET /api/trace/list` - 获取溯源列表

## 数据库设计

### 核心表
- `sys_user` - 用户表
- `material` - 原料表
- `process_node` - 工序节点表
- `process_log` - 工序记录表
- `quality_report` - 质检报告表
- `trace_record` - 溯源记录表

详细表结构请参考 `backend/docs/init.sql`

## 功能特色

1. **实时预警**：自动检测工序异常并预警
2. **全链路追溯**：从原料到成品的完整数据追溯
3. **智能分级**：基于多维度指标自动质量分级
4. **角色权限**：细粒度的角色权限控制
5. **响应式设计**：支持多种设备访问

## 注意事项

1. 首次启动前请确保MySQL服务已启动并正确配置
2. 建议生产环境使用Redis进行token管理
3. 生产部署时请修改JWT密钥
4. 建议配置HTTPS确保数据传输安全

## 许可证

本项目仅供学习和参考使用。
