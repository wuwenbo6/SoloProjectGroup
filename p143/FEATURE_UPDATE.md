# 功能更新说明

## 更新日期
2026-05-20

## 新增功能

### 1. 时段限制功能

**功能描述**
- 支持设置门禁生效的时间段
- 支持选择生效的星期
- 支持设置节假日禁用

**数据库表**
```sql
-- 时段规则表
CREATE TABLE time_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  days TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 节假日表
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**API 接口**
- `GET /api/schedules` - 获取所有时段规则
- `POST /api/schedules` - 添加时段规则
- `PUT /api/schedules/:id` - 更新时段规则
- `DELETE /api/schedules/:id` - 删除时段规则
- `GET /api/holidays` - 获取所有节假日
- `POST /api/holidays` - 添加节假日
- `DELETE /api/holidays/:id` - 删除节假日

**使用方式**
1. 在"时段管理"标签页添加时段规则
2. 设置生效时间段（开始时间-结束时间）
3. 选择生效的星期
4. 添加特殊节假日（当天全天禁用）

**验证逻辑**
```
如果当前是节假日 → 拒绝访问
否则如果不在任何时段内 → 拒绝访问
否则 → 允许访问
```

---

### 2. 多门互锁功能

**功能描述**
- 支持管理多个门
- 设置门之间的互锁关系
- 当一扇门开启时，其他互锁的门无法开启
- 门状态自动解锁（5秒后自动锁定）

**数据库表**
```sql
-- 门信息表
CREATE TABLE doors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'LOCKED',
  last_access_at DATETIME,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 门互锁关系表
CREATE TABLE door_interlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  door_id_1 INTEGER NOT NULL,
  door_id_2 INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(door_id_1, door_id_2)
);
```

**API 接口**
- `GET /api/doors` - 获取所有门状态
- `POST /api/doors` - 添加新门
- `DELETE /api/doors/:id` - 删除门
- `GET /api/interlocks` - 获取所有互锁规则
- `POST /api/interlocks` - 添加互锁规则
- `DELETE /api/interlocks/:id` - 删除互锁规则

**使用方式**
1. 在"门管理"标签页添加门禁点
2. 设置两扇门之间的互锁关系
3. 刷卡时自动检查其他互锁门状态

**互锁逻辑**
```
检查所有与当前门互锁的门状态
如果任意一扇门处于开启状态 → 拒绝访问
否则 → 允许开门
```

---

### 3. 导出日志为Excel

**功能描述**
- 一键导出所有门禁记录为Excel文件
- 包含卡号、卡类型、持卡人、门ID、访问结果、原因、时间
- 自动按日期命名文件

**API 接口**
- `GET /api/logs/export` - 导出Excel文件

**使用方式**
1. 进入"门禁记录"标签页
2. 点击右上角"导出Excel"按钮
3. 浏览器自动下载Excel文件

**文件格式**
```
文件名: access_logs_YYYY-MM-DD.xlsx
字段:
  - 卡号
  - 卡类型
  - 持卡人
  - 门ID
  - 访问结果
  - 原因
  - 时间
```

---

## 原有功能修复

### Bug 1: MIFARE 卡认证失败率高

**修复内容**
- 添加读卡重试机制（最多5次，指数退避）
- 添加超时保护（1秒超时）
- MIFARE卡密钥自动尝试（FFFFFFFFFFFF, A0A1A2A3A4A5, D3F7D3F7D3F7, 000000000000）
- 防冲突优化，避免重复处理
- 增强卡片类型检测

**修改文件**
- `src/nfc/reader.js`

---

### Bug 2: 删除卡片后仍可开门

**修复内容**
- 添加内存缓存已删除的卡片UID
- 验证前优先检查删除缓存
- 所有删除操作统一通过 AccessControl 处理
- 定期清理缓存（5分钟自动清理）

**修改文件**
- `src/access/control.js`
- `src/main.js`
- `src/server/index.js`

---

## 界面更新

### 新标签页

1. **时段管理**
   - 添加时段表单（名称、描述、开始时间、结束时间、星期选择）
   - 时段规则列表表格
   - 节假日管理区域

2. **门管理**
   - 添加门表单（名称、描述）
   - 多门互锁规则设置
   - 互锁规则列表表格

### 左侧面板更新

1. **门状态监控区域**
   - 实时显示所有门的当前状态
   - 绿色圆点表示已锁定
   - 红色圆点表示已开启
   - 状态自动更新

2. **模拟刷卡增强**
   - 新增门选择下拉框
   - 可选择不同的门进行模拟测试

---

## 依赖更新

```json
{
  "dependencies": {
    "xlsx": "^0.18.5"  // 新增：Excel导出
  }
}
```

---

## 启动方式

### 开发模式
```bash
npm install
npm run dev
```

### 仅服务器模式
```bash
npm run server
```

### Electron桌面应用
```bash
npm start
```

---

## 注意事项

1. **时段优先级**：节假日优先级高于时段规则，节假日当天所有时段无效

2. **门自动锁定**：门开启后5秒自动锁定，可通过修改 `DOOR_OPEN_DURATION` 调整

3. **多客户端同步**：门状态和卡片变更通过 WebSocket 实时同步到所有连接客户端

4. **数据库兼容**：新增表会自动创建，原有数据不受影响，可直接升级

5. **节假日格式**：日期格式为 YYYY-MM-DD，如 2026-01-01
