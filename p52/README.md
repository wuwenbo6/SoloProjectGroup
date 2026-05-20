# 古籍善本修复管理系统 - 后端项目

## 项目概述

基于 Java SpringBoot + MyBatis 构建的分布式多模块古籍善本修复全流程管理系统，采用分库分表设计，涵盖修复前检测、修复中工序、修复后验收的完整生命周期管理。

## 技术架构

### 核心技术栈
- **框架**: SpringBoot 2.7.x
- **ORM**: MyBatis
- **数据库**: MySQL 8.0 (分库设计)
- **连接池**: Druid
- **分页**: PageHelper
- **加密**: AES + SHA256
- **认证**: JWT

### 模块划分

```
ancientbook-parent              # 父工程
├── ancientbook-common          # 公共模块
│   ├── result                  # 统一响应结果
│   ├── exception               # 全局异常处理
│   ├── datasource              # 动态数据源
│   ├── entity                  # 基础实体
│   └── util                    # 工具类
├── ancientbook-rarebook        # 善本信息管理模块
├── ancientbook-progress        # 修复进度录入模块
├── ancientbook-process         # 修复工艺管理模块
├── ancientbook-auth            # 人员权限管理模块
├── ancientbook-detection       # 第三方检测对接模块
├── ancientbook-archive         # 修复档案归档模块
└── ancientbook-api             # API启动模块
```

## 数据库设计（分库）

### 1. ancientbook_rarebook (善本信息库)
- `rare_book`: 善本基本信息表

### 2. ancientbook_progress (修复进度库)
- `repair_progress`: 修复进度记录表
- `repair_step`: 修复工序配置表

### 3. ancientbook_process (修复工艺库)
- `repair_process`: 修复工艺模板表
- `process_material`: 修复材料表

### 4. ancientbook_auth (权限用户库)
- `sys_user`: 用户表
- `sys_role`: 角色表
- `sys_permission`: 权限表
- `sys_user_role`: 用户角色关联表
- `sys_role_permission`: 角色权限关联表

### 5. ancientbook_detection (检测报告库)
- `detection_report`: 检测报告表
- `third_party_org`: 第三方机构表

### 6. ancientbook_archive (修复档案库)
- `repair_archive`: 修复档案表
- `archive_log`: 档案操作日志表

## 核心功能

### 1. 善本信息管理
- 善本CRUD操作
- 按条件分页查询
- 破损等级管理
- 修复状态追踪
- 统计报表

### 2. 修复进度录入
- 三阶段管理（检测、修复、验收）
- 多工序分步录入
- 工序参数记录
- 图片附件上传
- 质量评分

### 3. 修复工艺标准化
- 工艺模板管理
- **智能推荐算法**: 根据破损等级、纸张材质、修复人员技能等级自动推荐最优工艺
- 材料工具清单
- 成功率统计

### 4. 人员权限管理
- RBAC权限模型
- 用户角色分配
- 技能等级管理
- JWT令牌认证

### 5. 第三方检测对接
- 检测机构管理
- 检测数据同步
- PH值、纤维检测
- 修复建议生成

### 6. 修复档案归档
- AES加密存储
- SHA256内容校验
- 档案查询导出
- 操作日志记录

## API接口列表

### 善本管理接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/rarebook | 新增善本 |
| PUT | /api/rarebook/{id} | 更新善本 |
| DELETE | /api/rarebook/{id} | 删除善本 |
| GET | /api/rarebook/{id} | 查询善本详情 |
| GET | /api/rarebook/page | 分页查询 |
| GET | /api/rarebook/statistics | 统计数据 |

### 工艺推荐接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/process/recommend | 智能推荐修复工艺 |
| GET | /api/process/list | 工艺列表 |

### 第三方检测接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/detection/sync | 同步检测报告 |
| GET | /api/detection/orgs | 检测机构列表 |

### 档案管理接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/archive/generate | 生成加密档案 |
| GET | /api/archive/{id}/export | 导出档案 |

## 快速启动

### 环境要求
- JDK 11+
- Maven 3.6+
- MySQL 8.0+

### 启动步骤

1. **创建数据库**
```bash
mysql -uroot -p < sql/init_database.sql
```

2. **修改配置**
编辑 `ancientbook-api/src/main/resources/application.yml`，修改数据库连接信息

3. **编译项目**
```bash
mvn clean install
```

4. **启动项目**
```bash
cd ancientbook-api
mvn spring-boot:run
```

5. **访问验证**
```
http://localhost:8080/api/rarebook/statistics
```

## 项目亮点

1. **分布式多模块架构**: 每个业务独立成模块，便于团队协作和扩展
2. **分库分表设计**: 6个独立数据库，按业务垂直拆分，提升并发能力
3. **动态数据源路由**: 基于AOP的数据源自动切换，简化多库操作
4. **智能工艺推荐**: 基于规则的推荐算法，根据实际情况匹配最优方案
5. **加密安全存储**: 修复档案采用AES加密+SHA256校验，保证数据安全
6. **全流程追溯**: 从检测到修复到验收，每个环节参数完整记录

## 默认账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | 系统管理员 | 最高权限 |
| restorer01 | admin123 | 高级修复师 | 可执行所有工序 |
| restorer02 | admin123 | 初级修复师 | 仅基础修复权限 |
