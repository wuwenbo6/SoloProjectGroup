# 染料配方溯源系统 - 分布式API服务

## 项目概述

本项目是一个基于Spring Boot微服务架构的染料配方全链路溯源系统，实现了从原料采购、生产加工到品质检测的完整溯源流程，并对接第三方检测机构数据。

## 系统架构

### 模块划分

| 模块 | 端口 | 功能说明 | 数据库 |
|------|------|----------|--------|
| dye-gateway | 8000 | API网关，统一入口 | - |
| dye-auth | 8001 | 权限鉴权模块，用户认证与授权 | dye_auth |
| dye-formula | 8002 | 染料配方录入与管理 | dye_formula |
| dye-traceability | 8003 | 原料溯源与加工过程追踪 | dye_traceability |
| dye-quality | 8004 | 品质检测管理 | dye_quality |
| dye-batch | 8005 | 配方批次管理 | dye_formula |
| dye-thirdparty | 8006 | 第三方检测机构对接 | dye_quality |

### 技术栈

- **框架**: Spring Boot 2.7.18 + Spring Cloud
- **ORM**: MyBatis-Plus 3.5.3.1
- **数据库**: MySQL 8.0
- **连接池**: Druid
- **认证**: JWT + Spring Security
- **API文档**: Knife4j + Swagger2
- **工具库**: Hutool
- **容器化**: Docker + Docker Compose

## 核心功能

### 1. 权限鉴权模块 (dye-auth)
- 用户注册/登录
- JWT Token认证
- 角色权限控制

### 2. 染料配方管理模块 (dye-formula)
- 配方信息录入与维护
- 配方原料明细管理
- 配方查询与检索

### 3. 原料溯源模块 (dye-traceability)
- 原料供应商信息溯源
- 生产加工过程记录
- 批次全链路追踪

### 4. 品质检测模块 (dye-quality)
- 内部品质检测记录
- 色差、色牢度、PH值等指标检测
- 检测结果统计分析

### 5. 批次管理模块 (dye-batch)
- 生产批次创建与管理
- 批次进度跟踪
- 批次质量状态管理

### 6. 第三方检测对接模块 (dye-thirdparty)
- 第三方检测机构报告同步
- 报告数据结构化存储
- 检测结果查询

## 快速开始

### 环境要求
- JDK 11+
- Maven 3.6+
- MySQL 8.0+
- Docker & Docker Compose (可选)

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd dye-traceability-system
```

2. **初始化数据库**
```bash
# 创建数据库并执行初始化脚本
mysql -uroot -p < sql/init.sql
```

3. **修改数据库配置**
修改各模块 `application.yml` 中的数据库连接信息

4. **编译项目**
```bash
mvn clean package -DskipTests
```

5. **启动服务**
```bash
# 依次启动各模块
cd dye-auth && mvn spring-boot:run
cd dye-formula && mvn spring-boot:run
# ... 其他模块类似
```

### Docker部署

```bash
# 编译所有模块
mvn clean package -DskipTests

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

## API接口说明

### 权限鉴权接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/register | 用户注册 |

### 染料配方接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/formula | 新增染料配方 |
| GET | /api/formula/{id} | 获取配方详情 |
| GET | /api/formula/list | 查询配方列表 |

### 原料溯源接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/trace/material | 新增原料溯源记录 |
| POST | /api/trace/process | 新增加工溯源记录 |
| GET | /api/trace/material/batch/{batchNo} | 按批次查询原料溯源 |
| GET | /api/trace/process/batch/{batchNo} | 按批次查询加工溯源 |

### 品质检测接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/quality | 新增品质检测记录 |
| GET | /api/quality/batch/{batchNo} | 按批次查询品质记录 |
| GET | /api/quality/list | 查询品质检测列表 |

### 批次管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batch | 创建配方批次 |
| GET | /api/batch/{batchNo} | 按批次号查询详情 |
| GET | /api/batch/list | 查询批次列表 |

### 第三方检测接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/thirdparty/report/sync | 同步第三方检测报告 |
| GET | /api/thirdparty/report/batch/{batchNo} | 按批次查询第三方报告 |
| GET | /api/thirdparty/report/list | 查询第三方报告列表 |

## 数据库设计

### 分库策略
- **dye_auth**: 用户权限数据
- **dye_formula**: 配方信息、批次数据
- **dye_traceability**: 原料溯源、加工过程数据
- **dye_quality**: 品质检测、第三方报告数据

## 开发说明

### 默认账号
- 用户名: admin
- 密码: 123456

### API文档访问
启动服务后访问: http://localhost:8001/doc.html

### 多数据源配置
通过 `@DataSource` 注解指定数据源，支持动态切换：
```java
@DataSource(DataSourceType.FORMULA)
public void saveFormula(DyeFormula formula) {
    // ...
}
```

## 项目结构

```
dye-traceability-system/
├── dye-common/              # 公共模块
│   ├── src/main/java/com/dye/traceability/common/
│   │   ├── core/           # 核心类：统一响应、基础实体
│   │   ├── datasource/     # 多数据源配置
│   │   ├── exception/      # 全局异常处理
│   │   ├── config/         # 配置类
│   │   └── util/           # 工具类
├── dye-auth/               # 权限鉴权模块
├── dye-formula/            # 配方管理模块
├── dye-traceability/       # 原料溯源模块
├── dye-quality/            # 品质检测模块
├── dye-batch/              # 批次管理模块
├── dye-thirdparty/         # 第三方对接模块
├── dye-gateway/            # API网关
├── sql/                    # 数据库脚本
├── docker/                 # Docker配置
└── pom.xml                 # 父POM
```

## 注意事项

1. 生产环境请修改JWT密钥和数据库密码
2. 各服务间调用建议使用注册中心和配置中心
3. 分布式事务建议使用Seata等框架处理
4. 生产环境建议添加日志收集和监控告警

## License

MIT License
