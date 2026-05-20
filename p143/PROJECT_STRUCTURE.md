# NFC门禁控制系统 - 项目结构

```
p143/
├── package.json                    # 项目配置和依赖
├── README.md                       # 项目说明文档
├── BUG_FIXES.md                   # Bug修复记录文档
├── FEATURE_UPDATE.md              # 功能更新说明
├── PROJECT_STRUCTURE.md           # 本文件
│
└── src/
    ├── main.js                     # Electron主进程入口
    │   - 初始化数据库
    │   - 启动NFC读卡器
    │   - 启动Express服务器
    │   - IPC通信处理
    │
    ├── db/
    │   └── database.js            # SQLite数据库模型
    │       - 卡片管理 (cards表)
    │       - 门禁记录 (access_logs表)
    │       - 门管理 (doors表)
    │       - 门互锁 (door_interlocks表)
    │       - 时段规则 (time_schedules表)
    │       - 节假日管理 (holidays表)
    │       - Excel导出功能
    │
    ├── nfc/
    │   └── reader.js              # NFC读卡器模块
    │       - PC/SC读卡器连接
    │       - MIFARE Classic支持
    │       - DESFIRE支持
    │       - 5次重试机制
    │       - 防冲突处理
    │       - 超时保护(1秒)
    │       - 软件模拟模式
    │
    ├── access/
    │   └── control.js             # 门禁控制逻辑
    │       - 卡片验证
    │       - 时段限制检查
    │       - 节假日检查
    │       - 多门互锁检查
    │       - 门状态管理
    │       - 已删除卡片缓存
    │       - 事件通知
    │
    ├── server/
    │   └── index.js               # Express服务器
    │       - RESTful API
    │       - WebSocket (socket.io)
    │       - CORS/Helmet安全
    │       - 静态文件服务
    │
    └── public/                    # 前端界面
        ├── index.html             # HTML结构
        ├── styles.css             # CSS样式
        └── app.js                 # 前端JavaScript
```

---

## 核心模块说明

### 1. Electron主进程 (`src/main.js`)

**职责**
- 创建浏览器窗口
- 初始化数据库连接
- 启动NFC读卡器监听
- 启动Express服务器
- 处理前端IPC调用
- 事件转发到WebSocket

**主要IPC处理**
```javascript
get-cards       // 获取所有卡片
add-card        // 添加新卡片
delete-card     // 删除卡片（通过AccessControl）
get-logs        // 获取门禁记录
simulate-card   // 模拟刷卡
```

---

### 2. 数据库模型 (`src/db/database.js`)

**数据表**

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| cards | 授权卡片 | uid, card_type, holder_name, key_a, key_b, is_active |
| access_logs | 门禁记录 | card_uid, holder_name, door_id, access_result, reason, timestamp |
| doors | 门信息 | name, description, status, last_access_at |
| door_interlocks | 互锁规则 | door_id_1, door_id_2, UNIQUE约束 |
| time_schedules | 时段规则 | name, start_time, end_time, days, is_active |
| holidays | 节假日 | date(UNIQUE), name |

**索引优化**
- idx_logs_timestamp: 加速日志查询
- idx_cards_uid: 加速卡片验证
- idx_holidays_date: 加速节假日检查

---

### 3. NFC读卡器 (`src/nfc/reader.js`)

**核心配置**
```javascript
CONFIG = {
  MAX_RETRIES: 5,           // 最多重试5次
  RETRY_DELAY: 100,         // 初始延迟100ms
  AUTH_TIMEOUT: 1000,       // 认证超时1秒
  DEFAULT_KEY: 'FFFFFFFFFFFF'
}
```

**读卡器状态处理**
- SCARD_STATE_EMPTY: 卡片移除
- SCARD_STATE_PRESENT: 检测到卡片

**MIFARE认证流程**
1. 加载密钥到读卡器
2. 发送认证命令 (0xFF 0x86)
3. 成功则继续，失败则尝试下一个密钥

**内置密钥列表**
- FFFFFFFFFFFF (默认)
- A0A1A2A3A4A5 (MAD密钥)
- D3F7D3F7D3F7 (交通卡)
- 000000000000 (空白卡)

---

### 4. 门禁控制逻辑 (`src/access/control.js`)

**验证流程**
```
1. 检查卡片是否已删除（内存缓存）
2. 检查是否为节假日
3. 检查是否在有效时段内
4. 检查互锁门状态
5. 检查卡片是否存在
6. 检查卡片是否激活
7. 验证密钥
8. 开门并记录日志
```

**门状态管理**
- 开门后启动定时器
- 5秒后自动锁定
- 状态变更广播通知所有客户端

**已删除卡片缓存**
- 使用 Set 存储已删除UID
- 定期清理（5分钟）
- 保证删除立即生效

---

### 5. Express服务器 (`src/server/index.js`)

**API路由概览**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cards | 获取所有卡片 |
| POST | /api/cards | 添加新卡片 |
| DELETE | /api/cards/:id | 删除卡片 |
| GET | /api/logs | 获取门禁记录 |
| GET | /api/logs/export | 导出Excel |
| POST | /api/verify | 验证卡片 |
| POST | /api/simulate | 模拟刷卡 |
| GET | /api/stats | 获取系统统计 |
| GET | /api/doors | 获取门状态 |
| POST | /api/doors | 添加新门 |
| DELETE | /api/doors/:id | 删除门 |
| GET | /api/interlocks | 获取互锁规则 |
| POST | /api/interlocks | 添加互锁规则 |
| DELETE | /api/interlocks/:id | 删除互锁规则 |
| GET | /api/schedules | 获取时段规则 |
| POST | /api/schedules | 添加时段规则 |
| PUT | /api/schedules/:id | 更新时段规则 |
| DELETE | /api/schedules/:id | 删除时段规则 |
| GET | /api/holidays | 获取节假日 |
| POST | /api/holidays | 添加节假日 |
| DELETE | /api/holidays/:id | 删除节假日 |
| GET | /api/can-access-now | 检查当前时间是否允许 |

**WebSocket事件**
- card-detected: 检测到卡片
- access-granted: 验证通过
- access-denied: 验证拒绝
- door-state-changed: 门状态变更
- card-added: 卡片已添加
- card-deleted: 卡片已删除

---

### 6. 前端界面 (`src/public/`)

**页面布局**
```
┌─────────────────────────────────────────────────────┐
│  标题栏 | 系统状态指示                                │
├─────────────┬───────────────────────────────────────┤
│             │  ▦ 卡片管理  ▦ 门禁记录  ▦ 时段管理    │
│ 读卡器状态   │  ▦ 门管理                              │
│ 模拟刷卡区域  │                                        │
│ 门状态监控   │  标签页内容区域                          │
│ 系统统计     │                                        │
│             │                                        │
└─────────────┴───────────────────────────────────────┘
```

**左侧面板功能**
1. 读卡器状态显示
2. 卡片信息展示
3. 访问结果提示
4. 模拟刷卡表单（含门选择）
5. 门状态实时监控
6. 系统统计面板

**右侧标签页**

| 标签 | 功能 |
|------|------|
| 卡片管理 | 添加卡片、卡片列表、删除卡片 |
| 门禁记录 | 记录列表、导出Excel |
| 时段管理 | 时段规则CRUD、节假日管理 |
| 门管理 | 添加门、互锁规则设置 |

---

## 数据流图

```
真实刷卡 / 模拟刷卡
     │
     ▼
NFC Reader Module
     │
     ▼
AccessControl.verifyCard()
     │
     ├── 1. 检查已删除缓存
     ├── 2. 检查节假日
     ├── 3. 检查时段限制
     ├── 4. 检查门互锁
     ├── 5. 数据库查询卡片
     ├── 6. 验证激活状态
     └── 7. 验证密钥
     │
     ├─ 成功 ──▶ access-granted事件 ──▶ 前端弹窗
     │                                     │
     │                                     ▼
     │                                   门状态OPEN ──▶ 5秒后LOCKED
     │
     └─ 失败 ──▶ access-denied事件 ──▶ 前端弹窗（含原因）
     │
     ▼
记录到access_logs表
```

---

## 部署说明

### 开发环境
```bash
# 安装依赖
npm install

# 同时启动服务器和Electron
npm run dev
```

### 生产环境打包
```bash
# macOS
npm run build

# Windows
npm run build-win
```

### 仅Web模式
```bash
npm run server
# 访问 http://localhost:3000
```

---

## 配置文件

无额外配置文件，所有参数可在代码中修改：

| 参数 | 文件 | 说明 |
|------|------|------|
| DOOR_OPEN_DURATION | src/access/control.js | 门开启持续时间(ms) |
| MAX_RETRIES | src/nfc/reader.js | 读卡重试次数 |
| AUTH_TIMEOUT | src/nfc/reader.js | 读卡超时时间 |
| HTTP 端口 | src/main.js / src/server/index.js | 默认3000 |

---

## 数据兼容性

- 数据库表会自动创建和升级
- 旧版本数据库可直接使用，新增表会自动初始化
- 不影响现有卡片和日志数据
