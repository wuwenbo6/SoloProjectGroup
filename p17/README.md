# 非遗政务系统 - 纯后端服务

基于 PHP Swoole 构建的高并发非遗政务系统后端，提供技艺信息录入、工序评分核算、传承人资质鉴权、定级档案归档、第三方文旅系统对接等功能。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Swoole HTTP Server                      │
│                   (Worker Process x 8)                        │
├─────────────────────────────────────────────────────────────┤
│                         中间件层                              │
│        ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│        │ JWT认证     │  │ 权限校验    │  │ 跨域处理    │      │
│        └────────────┘  └────────────┘  └────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                         业务模块层                            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │ 技艺管理   │ │ 工序评分   │ │ 传承人鉴权 │ │ 档案归档   │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               文旅系统对接模块                        │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                         数据层                                │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   PDO MySQL     │  │   Redis Cache   │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## 核心功能模块

### 1. 技艺信息录入接口模块
- 非遗技艺信息的CRUD操作
- 工序参数批量录入
- 多条件检索查询
- 审核流程管理

### 2. 工序评分核算模块
- 标准化工序管理
- 工序权重配置
- 行业标准自动比对
- 加权评分计算
- 等级自动评定算法
- 关键工序加倍计算

### 3. 传承人资质鉴权模块
- 四级权限控制（超级管理员/审核人员/录入人员/查询人员）
- JWT无状态认证
- Token自动刷新
- 传承人资质审核
- 传承人续期管理

### 4. 定级档案归档模块
- AES-256-CBC档案加密
- 区块链式哈希链溯源
- 档案完整性核验
- 批量档案核验
- 操作日志追踪
- 档案作废管理

### 5. 第三方文旅系统对接接口
- 文旅部非遗数据库对接
- 省/市文旅数据库对接
- Webhook事件推送
- 数据双向同步
- 签名验证机制
- 同步日志记录

## 技术栈

- **服务框架**: Swoole 4.8+
- **PHP版本**: PHP 7.4+
- **数据库**: MySQL 5.7+
- **缓存**: Redis (可选)
- **认证**: JWT (HS256)
- **加密**: AES-256-CBC
- **哈希**: SHA-256
- **数据库访问**: PDO单例模式

## 目录结构

```
heritage-system/
├── server.php                 # Swoole服务入口
├── config/                    # 配置目录
│   ├── app.php               # 应用配置
│   └── database.php          # 数据库配置
├── core/                      # 核心框架
│   ├── Loader.php            # 自动加载器
│   ├── Route.php             # 路由分发器
│   ├── Database.php          # PDO数据库封装
│   └── Middleware.php        # 中间件基类
├── middleware/                # 中间件
│   ├── JwtAuth.php           # JWT认证中间件
│   └── PermissionCheck.php   # 权限校验中间件
├── utils/                     # 工具类
│   ├── Jwt.php               # JWT编码解码
│   ├── Crypto.php            # 加密工具
│   └── helpers.php           # 全局辅助函数
├── modules/                   # 业务模块
│   ├── auth/                 # 认证与传承人模块
│   ├── skill/                # 技艺信息模块
│   ├── process/              # 工序评分模块
│   ├── archive/              # 档案归档模块
│   └── integration/          # 文旅系统对接模块
├── database/                  # 数据库
│   └── heritage_system.sql   # 数据库初始化脚本
├── logs/                      # 日志目录
└── API.md                     # 接口文档
```

## 快速开始

### 1. 环境要求

```bash
# 检查PHP版本
php -v  # 要求 >= 7.4

# 检查Swoole扩展
php -m | grep swoole

# 安装Swoole (如未安装)
pecl install swoole
```

### 2. 数据库初始化

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE heritage_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 导入数据
mysql -u root -p heritage_system < database/heritage_system.sql
```

### 3. 配置文件

编辑 `config/database.php`:

```php
return [
    'host' => '127.0.0.1',
    'port' => 3306,
    'database' => 'heritage_system',
    'username' => 'root',
    'password' => 'your_password',
    'charset' => 'utf8mb4',
];
```

编辑 `config/app.php`:

```php
return [
    'jwt_secret' => 'your_jwt_secret_key_here',
    'jwt_expire' => 7200,
    'aes_key' => 'your_aes_256_key_here',
    'server_host' => '0.0.0.0',
    'server_port' => 9501,
    'worker_num' => 8,
    'task_worker_num' => 4,
];
```

### 4. 启动服务

```bash
# 前台运行
php server.php

# 后台运行
php server.php &

# 检查端口
netstat -an | grep 9501
```

### 5. 测试接口

```bash
# 登录获取Token
curl -X POST http://127.0.0.1:9501/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# 使用Token访问受保护接口
curl -X GET http://127.0.0.1:9501/api/skill/list \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 默认账号

| 用户名 | 密码 | 角色 | 权限 |
|---|---|---|---|
| admin | 123456 | 超级管理员 | 全部权限 |
| auditor | 123456 | 审核人员 | 审核、查询 |
| operator | 123456 | 录入人员 | 录入、查询 |
| viewer | 123456 | 查询人员 | 查询 |

## 等级评定算法

系统采用加权评分法进行等级评定：

```
1. 普通工序: 得分 = 实际得分 × 权重
2. 关键工序: 得分 = 实际得分 × 权重 × 1.5
3. 总分 = Σ(各工序得分)
4. 等级判定:
   - 国家级: 总分 ≥ 90
   - 省级:   80 ≤ 总分 < 90
   - 市级:   70 ≤ 总分 < 80
   - 县级:   60 ≤ 总分 < 70
```

## 档案哈希链机制

```
档案哈希 = SHA256(上一档案哈希 + 当前档案JSON + 时间戳)

第一份档案:
hash_1 = SHA256("" + data_1 + timestamp_1)

第N份档案:
hash_N = SHA256(hash_N-1 + data_N + timestamp_N)
```

## 并发优化

1. **Swoole协程**: 所有IO操作均采用协程模式
2. **数据库连接池**: PDO单例复用
3. **Worker进程**: 8个Worker进程并行处理
4. **Task进程**: 4个Task进程处理异步任务
5. **查询优化**: 所有查询字段建立索引

## 安全特性

1. **SQL注入防护**: PDO参数化查询
2. **XSS防护**: 输出自动转义
3. **身份认证**: JWT Token机制
4. **权限控制**: RBAC角色权限矩阵
5. **数据加密**: 敏感数据AES-256加密
6. **签名验证**: 第三方接口签名校验
7. **操作日志**: 全操作留痕可追溯

## 部署建议

### 生产环境配置

```php
// server.php 生产配置
$server->set([
    'worker_num' => swoole_cpu_num() * 2,
    'task_worker_num' => swoole_cpu_num(),
    'max_request' => 10000,
    'dispatch_mode' => 2,
    'enable_coroutine' => true,
    'daemonize' => true,           // 后台运行
    'log_file' => '/var/log/swoole.log',
    'pid_file' => '/var/run/swoole.pid',
]);
```

### Nginx反向代理

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Connection "keep-alive";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_pass http://127.0.0.1:9501;
    }
}
```

## 监控与维护

### 查看服务状态

```bash
# 查看进程
ps aux | grep swoole

# 查看端口
netstat -an | grep 9501

# 查看日志
tail -f logs/app-$(date +%Y%m%d).log
```

### 平滑重启

```bash
# 向主进程发送USR1信号
kill -USR1 <MASTER_PID>
```

## API文档

完整的API文档请参考 [API.md](./API.md)

## 开发规范

### 代码风格
- 遵循 PSR-4 自动加载规范
- 命名空间采用目录结构对应
- 类名采用大驼峰，方法名采用小驼峰

### 数据库规范
- 表名采用小写加下划线
- 主键统一命名为 id
- 时间戳字段统一使用 created_at, updated_at

### 接口规范
- 统一响应格式: {code, message, data}
- 成功返回 code=200
- 错误返回 code>=400 并附带详细 message

## 许可证

本项目采用 MIT 许可证

## 技术支持

如有问题，请查看日志文件 `logs/` 目录下的详细错误信息。
