# 非遗政务系统 API 文档

## 基础信息

- **基础URL**: `http://your-domain:9501`
- **协议**: HTTP/JSON
- **认证方式**: JWT Token
- **字符编码**: UTF-8

## 通用响应格式

### 成功响应
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

### 失败响应
```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

### 分页响应
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5,
    "list": []
  }
}
```

## 认证模块

### 用户登录
- **接口**: `POST /api/auth/login`
- **权限**: 公开
- **描述**: 用户登录获取Token

**请求参数**:
```json
{
  "username": "admin",
  "password": "123456"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "expire": 7200,
    "user": {
      "id": 1,
      "username": "admin",
      "real_name": "管理员",
      "role": 1,
      "role_name": "超级管理员"
    }
  }
}
```

### 用户登出
- **接口**: `POST /api/auth/logout`
- **权限**: 已登录用户
- **描述**: 退出登录

### 刷新Token
- **接口**: `POST /api/auth/refresh`
- **权限**: 已登录用户
- **描述**: 刷新Token有效期

**响应示例**:
```json
{
  "code": 200,
  "message": "刷新成功",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "expire": 7200
  }
}
```

### 获取当前用户信息
- **接口**: `GET /api/auth/info`
- **权限**: 已登录用户

## 传承人管理模块

### 传承人列表
- **接口**: `GET /api/heritor/list`
- **权限**: 查询人员及以上
- **参数**:
  - `page`: 页码，默认1
  - `page_size`: 每页数量，默认20
  - `keyword`: 关键词搜索（姓名/编号）
  - `qualification_level`: 资质等级（1-国家级，2-省级，3-市级，4-县级）
  - `status`: 状态（0-禁用，1-正常）

### 传承人详情
- **接口**: `GET /api/heritor/detail`
- **权限**: 查询人员及以上
- **参数**: `id` 传承人ID

### 新增传承人
- **接口**: `POST /api/heritor/create`
- **权限**: 录入人员及以上

**请求参数**:
```json
{
  "heritor_no": "H20240001",
  "name": "张三",
  "gender": 1,
  "birth_date": "1970-01-01",
  "id_card": "110101197001011234",
  "ethnicity": "汉族",
  "education": "本科",
  "profession": "手工艺人",
  "skill_id": 1,
  "qualification_level": 2,
  "qualification_date": "2020-01-01",
  "qualification_org": "省文旅厅",
  "address": "北京市朝阳区",
  "phone": "13800138000",
  "email": "zhangsan@example.com",
  "bio": "传承人简介"
}
```

### 编辑传承人
- **接口**: `POST /api/heritor/update`
- **权限**: 录入人员及以上
- **参数**: `id` 传承人ID

### 审核传承人资质
- **接口**: `POST /api/heritor/approve`
- **权限**: 审核人员及以上

**请求参数**:
```json
{
  "id": 1,
  "qualification_level": 2,
  "qualification_date": "2024-01-01",
  "qualification_org": "省文旅厅",
  "approve_note": "审核通过"
}
```

### 传承人续期
- **接口**: `POST /api/heritor/renew`
- **权限**: 审核人员及以上

**请求参数**:
```json
{
  "id": 1,
  "renew_note": "续期申请通过",
  "new_expire_date": "2029-01-01"
}
```

### 删除传承人
- **接口**: `POST /api/heritor/delete`
- **权限**: 超级管理员
- **参数**: `id` 传承人ID

## 技艺信息管理模块

### 技艺列表
- **接口**: `GET /api/skill/list`
- **权限**: 查询人员及以上
- **参数**:
  - `page`: 页码
  - `page_size`: 每页数量
  - `keyword`: 关键词搜索
  - `category`: 技艺类别
  - `level`: 技艺等级
  - `heritor_id`: 传承人ID
  - `status`: 状态

### 技艺详情
- **接口**: `GET /api/skill/detail`
- **权限**: 查询人员及以上
- **参数**: `id` 技艺ID

### 新增技艺
- **接口**: `POST /api/skill/create`
- **权限**: 录入人员及以上

**请求参数**:
```json
{
  "skill_no": "S20240001",
  "name": "景泰蓝制作技艺",
  "category": 1,
  "level": 1,
  "heritor_id": 1,
  "origin_area": "北京市",
  "application_area": "全国",
  "materials": "铜丝、珐琅釉料",
  "tools": "镊子、锤子、熔炉",
  "tech_description": "详细工艺流程描述",
  "history_origin": "历史渊源",
  "representative_works": "代表作品"
}
```

### 编辑技艺
- **接口**: `POST /api/skill/update`
- **权限**: 录入人员及以上

### 审核技艺
- **接口**: `POST /api/skill/approve`
- **权限**: 审核人员及以上

### 删除技艺
- **接口**: `POST /api/skill/delete`
- **权限**: 超级管理员

## 工序评分核算模块

### 工序列表
- **接口**: `GET /api/process/list`
- **权限**: 查询人员及以上
- **参数**: `skill_id` 技艺ID

### 新增工序
- **接口**: `POST /api/process/create`
- **权限**: 录入人员及以上

**请求参数**:
```json
{
  "skill_id": 1,
  "process_name": "制胎",
  "process_order": 1,
  "description": "制作铜胎的详细说明",
  "standard_score": 100,
  "weight": 0.2,
  "is_key_process": 1
}
```

### 工序评分
- **接口**: `POST /api/process/score`
- **权限**: 审核人员及以上

**请求参数**:
```json
{
  "process_id": 1,
  "skill_id": 1,
  "heritor_id": 1,
  "score": 95,
  "scored_by": 2,
  "score_note": "制胎工艺精湛，符合标准"
}
```

### 计算定级
- **接口**: `POST /api/process/calculate`
- **权限**: 审核人员及以上
- **描述**: 根据所有工序评分计算技艺等级

**请求参数**:
```json
{
  "skill_id": 1,
  "heritor_id": 1
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "计算成功",
  "data": {
    "skill_id": 1,
    "skill_name": "景泰蓝制作技艺",
    "total_processes": 5,
    "scored_processes": 5,
    "total_score": 92.5,
    "weighted_score": 94.0,
    "final_level": 1,
    "level_name": "国家级",
    "process_details": [
      {
        "process_name": "制胎",
        "standard_score": 100,
        "score": 95,
        "weight": 0.2,
        "is_key_process": true
      }
    ]
  }
}
```

### 获取计算历史
- **接口**: `GET /api/process/calculate/history`
- **权限**: 查询人员及以上
- **参数**: `skill_id` 技艺ID

## 定级档案归档模块

### 档案列表
- **接口**: `GET /api/archive/list`
- **权限**: 查询人员及以上
- **参数**:
  - `page`: 页码
  - `page_size`: 每页数量
  - `keyword`: 档案编号搜索
  - `skill_id`: 技艺ID
  - `final_level`: 最终等级
  - `archive_status`: 档案状态

### 档案详情
- **接口**: `GET /api/archive/detail`
- **权限**: 查询人员及以上
- **参数**: `id` 或 `archive_no`

### 创建档案
- **接口**: `POST /api/archive/create`
- **权限**: 审核人员及以上
- **描述**: 创建定级档案并加密存储

**请求参数**:
```json
{
  "skill_id": 1,
  "heritor_id": 1,
  "final_level": 1,
  "total_score": 94.0,
  "previous_hash": "",
  "archive_version": "1.0"
}
```

### 核验档案
- **接口**: `POST /api/archive/verify`
- **权限**: 审核人员及以上
- **描述**: 核验档案哈希完整性

**请求参数**:
```json
{
  "id": 1
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "档案核验通过",
  "data": {
    "archive_id": 1,
    "archive_no": "ARCH202401011234561234",
    "hash_valid": true,
    "status_valid": true,
    "overall_valid": true,
    "verify_count": 3,
    "last_verify_time": "2024-01-15 10:30:00"
  }
}
```

### 批量核验档案
- **接口**: `POST /api/archive/batch/verify`
- **权限**: 审核人员及以上

**请求参数**:
```json
{
  "ids": [1, 2, 3]
}
```

### 档案溯源
- **接口**: `POST /api/archive/trace`
- **权限**: 查询人员及以上
- **描述**: 追溯档案的哈希链

**请求参数**:
```json
{
  "id": 1
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "archive_no": "ARCH202401011234561234",
    "chain_length": 3,
    "chain": [
      {
        "archive_no": "ARCH202401010000000001",
        "archive_hash": "a1b2c3d4...",
        "previous_hash": "",
        "created_at": "2024-01-01 00:00:00"
      }
    ],
    "is_complete_chain": true
  }
}
```

### 获取操作日志
- **接口**: `GET /api/archive/trace/logs`
- **权限**: 查询人员及以上
- **参数**: `archive_id` 档案ID

### 作废档案
- **接口**: `POST /api/archive/void`
- **权限**: 超级管理员

**请求参数**:
```json
{
  "id": 1,
  "reason": "档案信息有误"
}
```

## 第三方文旅系统对接模块

### Webhook接收接口
- **接口**: `POST /api/integration/webhook/culture`
- **权限**: 签名验证
- **描述**: 接收文旅系统推送

**请求参数**:
```json
{
  "system_id": "whhc",
  "event_type": "skill_update",
  "timestamp": 1704067200,
  "signature": "sha256_signature",
  "data": {}
}
```

### 同步技艺信息到文旅系统
- **接口**: `POST /api/integration/sync/skills/out`
- **权限**: 系统对接权限

**请求参数**:
```json
{
  "target_system": "prowh",
  "last_sync_time": "2024-01-01 00:00:00"
}
```

### 从文旅系统同步技艺信息
- **接口**: `POST /api/integration/sync/skills/in`
- **权限**: 系统对接权限

**请求参数**:
```json
{
  "source_system": "prowh",
  "skills": [
    {
      "skill_no": "S20240001",
      "name": "景泰蓝制作技艺",
      "category": 1,
      "level": 1,
      "status": 1
    }
  ]
}
```

### 同步传承人信息到文旅系统
- **接口**: `POST /api/integration/sync/heritors/out`
- **权限**: 系统对接权限

### 从文旅系统同步传承人信息
- **接口**: `POST /api/integration/sync/heritors/in`
- **权限**: 系统对接权限

### 同步档案信息到文旅系统
- **接口**: `POST /api/integration/sync/archives/out`
- **权限**: 系统对接权限

### 从文旅系统同步档案信息
- **接口**: `POST /api/integration/sync/archives/in`
- **权限**: 系统对接权限

### 获取同步日志
- **接口**: `GET /api/integration/sync/logs`
- **权限**: 系统对接权限

### 获取同步状态
- **接口**: `GET /api/integration/sync/status`
- **权限**: 系统对接权限

## 数据字典

### 用户角色 (role)
| 值 | 名称 | 权限说明 |
|---|---|---|
| 1 | 超级管理员 | 全部权限 |
| 2 | 审核人员 | 审核、查询、导出 |
| 3 | 录入人员 | 录入、查询 |
| 4 | 查询人员 | 查询 |

### 技艺等级 (level)
| 值 | 名称 |
|---|---|
| 1 | 国家级 |
| 2 | 省级 |
| 3 | 市级 |
| 4 | 县级 |

### 资质等级 (qualification_level)
| 值 | 名称 |
|---|---|
| 1 | 国家级传承人 |
| 2 | 省级传承人 |
| 3 | 市级传承人 |
| 4 | 县级传承人 |

### 档案状态 (archive_status)
| 值 | 名称 |
|---|---|
| 0 | 已作废 |
| 1 | 有效 |

### 同步状态 (sync_status)
| 值 | 名称 |
|---|---|
| 1 | 进行中 |
| 2 | 已完成 |
| 3 | 失败 |

## 加密算法说明

### AES-256-CBC 加密
- 用于档案数据加密存储
- Key: 配置文件中定义
- IV: 随机生成，随密文存储

### 档案哈希链
```
当前档案哈希 = SHA256(上一档案哈希 + 当前档案数据 + 时间戳)
```

### JWT Token
- 算法: HS256
- 有效期: 7200秒（2小时）
- 刷新机制: 支持无感刷新

## 跨域配置
系统已配置CORS跨域支持，允许的请求头包括：
- Authorization
- Content-Type
- X-Requested-With
- Accept
- Origin
- User-Agent

允许的请求方法: GET, POST, PUT, DELETE, OPTIONS

## 错误码说明

| 错误码 | 说明 |
|---|---|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权/Token无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 405 | 方法不允许 |
| 500 | 服务器内部错误 |
