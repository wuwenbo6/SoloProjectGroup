# NFC 门禁控制系统

一个基于 Electron + Express + SQLite 的完整NFC门禁管理系统。

## 功能特性

### 核心功能
- ✅ **NFC读卡器支持** - 使用 PC/SC API 连接真实读卡器，支持软件模拟
- ✅ **卡片类型支持** - MIFARE Classic、DESFIRE
- ✅ **门禁验证** - UID验证 + 密钥双重验证
- ✅ **实时通知** - WebSocket 实时推送门禁事件，弹窗通知

### 管理功能
- ✅ **卡片管理** - 添加/删除/查看授权卡片
- ✅ **门禁记录** - 完整的进出记录查询
- ✅ **系统统计** - 实时显示卡片数量、今日通行数等
- ✅ **模拟刷卡** - 内置模拟器方便测试

### 技术架构
- **桌面端**: Electron
- **后端**: Express + WebSocket (Socket.io)
- **数据库**: SQLite (better-sqlite3)
- **NFC**: @pokusew/pcsclite

## 项目结构

```
p143/
├── package.json
├── src/
│   ├── main.js              # Electron 主进程
│   ├── nfc/
│   │   └── reader.js        # NFC读卡器模块 (PC/SC)
│   ├── access/
│   │   └── control.js       # 门禁验证逻辑
│   ├── db/
│   │   └── database.js      # SQLite数据库
│   ├── server/
│   │   └── index.js         # Express服务器 + API
│   └── public/              # 前端界面
│       ├── index.html
│       ├── styles.css
│       └── app.js
└── access-control.db        # SQLite数据库 (自动创建)
```

## 快速开始

### 安装依赖

```bash
npm install
```

如果遇到权限问题：
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### 运行方式

#### 方式1: 完整 Electron 应用 (推荐)
```bash
npm start
```

#### 方式2: 仅 Web 服务器
```bash
npm run server
```
然后打开浏览器访问: http://localhost:3000

#### 方式3: 开发模式 (Electron + 服务器)
```bash
npm run dev
```

## API 接口

### 卡片管理
- `GET /api/cards` - 获取所有卡片
- `POST /api/cards` - 添加新卡片
  ```json
  {
    "uid": "AABBCCDD",
    "card_type": "MIFARE_CLASSIC",
    "holder_name": "张三",
    "key_a": "FFFFFFFFFFFF",
    "key_b": ""
  }
  ```
- `DELETE /api/cards/:id` - 删除卡片

### 门禁记录
- `GET /api/logs` - 获取门禁记录

### 验证与模拟
- `POST /api/verify` - 验证卡片
- `POST /api/simulate` - 模拟刷卡

### 系统统计
- `GET /api/stats` - 获取系统统计数据

## 预设卡片

系统初始化时会自动创建2张测试卡片：

| UID         | 类型           | 持有人 | Key A       |
|-------------|----------------|--------|-------------|
| AABBCCDD    | MIFARE_CLASSIC | 管理员 | FFFFFFFFFFFF|
| 11223344    | DESFIRE        | 测试用户 | 000000000000 |

## NFC读卡器配置

### 硬件支持
- 支持所有兼容 PC/SC 标准的 NFC 读卡器
- 支持 MIFARE Classic 1K/4K
- 支持 DESFIRE EV1/EV2

### 软件模拟
如果没有真实读卡器，系统会自动切换到模拟模式，可以通过界面的"模拟刷卡"功能进行测试。

## 构建打包

### macOS
```bash
npm run build
```

### Windows
```bash
npm run build
```

## 数据库结构

### cards 表
```sql
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT UNIQUE NOT NULL,
  card_type TEXT NOT NULL,
  holder_name TEXT,
  key_a TEXT,
  key_b TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### access_logs 表
```sql
CREATE TABLE access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_uid TEXT NOT NULL,
  card_type TEXT,
  holder_name TEXT,
  access_result TEXT NOT NULL,
  reason TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 前端界面功能

### 左侧面板
1. **读卡器状态** - 显示读卡器状态和检测到的卡片信息
2. **模拟刷卡** - 输入UID和卡片类型进行模拟测试
3. **系统统计** - 实时显示系统运行数据

### 右侧面板
1. **卡片管理** - 管理授权卡片列表
2. **门禁记录** - 查看所有进出记录

## WebSocket 事件

- `card-detected` - 检测到卡片
- `access-granted` - 门禁开启
- `access-denied` - 访问拒绝
- `card-added` - 新卡片添加
- `card-deleted` - 卡片删除

## 故障排查

### 读卡器无法连接
1. 检查读卡器是否正确插入
2. 检查 PC/SC 服务是否运行
3. 查看控制台错误日志

### 依赖安装失败
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### 数据库问题
删除 `access-control.db` 文件，重启应用会自动重建

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 28.x | 桌面应用框架 |
| Express | 4.x | Web服务器 |
| Socket.io | 4.x | 实时通信 |
| better-sqlite3 | 9.x | SQLite数据库 |
| @pokusew/pcsclite | 0.6.x | PC/SC NFC读卡器 |

## 许可证

MIT License
