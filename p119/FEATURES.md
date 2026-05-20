# 古地图扫描件标注系统 - 新增功能

## ✨ 新增功能一览

### 1. 📍 古地名与现代地名联动

**功能描述：**
- 为每个标注添加古地名与现代地名的对照关系
- 支持多种关系类型：同一地点、包含、相关、邻近
- 可记录资料来源和可信度
- 支持为单个标注添加多条对照记录

**使用方法：**
1. 在地图编辑器中选择一个标注
2. 切换到「古今地名」标签页
3. 填写古地名、现代地名，选择关系类型
4. 可选择性填写资料来源
5. 点击「添加对照」保存

**数据库表结构：**
```sql
CREATE TABLE name_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id TEXT NOT NULL,          -- 关联标注ID
  ancient_name TEXT NOT NULL,            -- 古地名
  modern_name TEXT,                       -- 现代地名
  relation_type TEXT DEFAULT 'same',     -- 关系类型
  confidence REAL DEFAULT 1.0,           -- 可信度
  source TEXT,                            -- 资料来源
  notes TEXT,                             -- 备注
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. 📤 标注批量导出

**支持格式：**

#### JSON 格式
- 完整导出所有数据
- 包含：地图信息、控制点、图层、标注、地名对照关系
- 文件命名：`{地图名}.json`

**导出内容结构：**
```json
{
  "map": { "id": "...", "name": "...", ... },
  "controlPoints": [...],
  "layers": [...],
  "annotations": [
    {
      "id": "...",
      "type": "place",
      "name": "...",
      "geometry": {...},
      "name_relations": [...]
    }
  ],
  "exportDate": "2024-...",
  "version": "1.0"
}
```

#### GeoJSON 格式
- 标准 GeoJSON 格式，兼容 GIS 软件
- 包含标注属性和地名关系
- 支持 Point（地点）和 LineString（水系）几何类型
- 文件命名：`{地图名}.geojson`

#### KML 格式
- Google Earth 兼容格式
- 包含标注描述和地名对照
- 文件命名：`{地图名}.kml`

**使用方法：**
1. 进入地图编辑器
2. 切换到「导出数据」标签页
3. 选择导出格式点击即可
4. 自动下载文件

---

### 3. 🔐 标注权限分级

**权限等级：**

| 等级 | 权限说明 |
|------|----------|
| **owner** | 地图所有者，拥有所有权限 |
| **admin** | 管理员，可管理权限和编辑标注 |
| **editor** | 编辑者，可创建和编辑标注 |
| **viewer** | 查看者，仅可查看标注 |

**功能特性：**
- 支持为地图授权不同级别的访问权限
- 权限记录包含授权人信息和时间
- 用户离开时自动处理权限状态
- 前端根据权限动态控制功能可用性

**数据库表结构：**
```sql
CREATE TABLE map_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_level TEXT NOT NULL,
  granted_by TEXT,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(map_id, user_id)
);
```

**使用方法：**
1. 进入地图编辑器
2. 切换到「权限设置」标签页
3. 输入用户ID，选择权限等级
4. 点击「授权」完成授权

---

### 4. 🗂️ 地图分层查看

**功能描述：**
- 支持创建多个图层，对标注进行分类管理
- 可设置图层可见性（显示/隐藏）
- 每个图层有独立的颜色标识
- 支持删除图层（标注自动移至默认图层）

**图层属性：**
```javascript
{
  id: number,           // 图层ID
  map_id: string,       // 所属地图
  name: string,         // 图层名称
  type: string,         // 图层类型
  color: string,        // 图层颜色 (#RRGGBB)
  visible: boolean,     // 是否可见
  sort_order: number,   // 排序顺序
  created_at: Date
}
```

**使用方法：**
1. 进入地图编辑器
2. 切换到「图层管理」标签页
3. 输入图层名称创建新图层
4. 点击眼睛图标切换图层可见性
5. 点击删除图标删除图层

**数据库表结构：**
```sql
CREATE TABLE layers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'annotation',
  color TEXT DEFAULT '#3498db',
  visible INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔧 API 接口汇总

### 图层管理 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/layers/map/:mapId` | 获取地图所有图层 |
| POST | `/api/layers` | 创建新图层 |
| PUT | `/api/layers/:id` | 更新图层信息 |
| DELETE | `/api/layers/:id` | 删除图层 |

### 权限管理 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/permissions/map/:mapId` | 获取地图所有权限 |
| GET | `/api/permissions/user/:userId/map/:mapId` | 获取用户对地图的权限 |
| POST | `/api/permissions` | 授予权限 |
| DELETE | `/api/permissions/:mapId/:userId` | 撤销权限 |

### 地名关系 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/name-relations/annotation/:annotationId` | 获取标注的地名关系 |
| GET | `/api/name-relations/map/:mapId` | 获取地图所有地名关系 |
| POST | `/api/name-relations` | 创建地名关系 |
| PUT | `/api/name-relations/:id` | 更新地名关系 |
| DELETE | `/api/name-relations/:id` | 删除地名关系 |

### 导出 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/map/:mapId/json` | 导出 JSON 格式 |
| GET | `/api/export/map/:mapId/geojson` | 导出 GeoJSON 格式 |
| GET | `/api/export/map/:mapId/kml` | 导出 KML 格式 |

---

## 📁 新增文件清单

### 后端文件
```
server/
├── routes/
│   ├── layers.js          # 图层管理路由
│   ├── permissions.js     # 权限管理路由
│   ├── nameRelations.js   # 地名关系路由
│   └── export.js          # 导出功能路由
└── database.js            # 更新数据库结构
```

### 前端文件
```
client/src/
├── components/
│   └── SidebarPanel.js    # 侧边栏面板（四大功能）
└── services/
    └── api.js             # 扩展 API 方法
```

---

## 🚀 技术实现亮点

### 1. 模块化设计
- 每个功能独立为路由模块
- 前端组件化，标签页切换管理

### 2. 数据完整性
- 使用外键约束保证数据关联完整性
- 删除图层时自动处理关联标注

### 3. 格式兼容性
- 导出格式遵循行业标准（GeoJSON、KML）
- 可直接导入 ArcGIS、QGIS、Google Earth 等软件

### 4. 用户体验优化
- 标签页式布局，功能分区清晰
- 操作反馈及时
- 批量操作支持

---

## 💡 使用场景建议

### 场景1：历史地理研究
- 使用「地名对照」功能记录古地名的现代位置
- 通过「图层管理」按朝代或地区分类标注
- 导出 GeoJSON 进行空间分析

### 场景2：团队协作项目
- 使用「权限管理」分配不同角色的编辑权限
- 多人同时协作，各自在不同图层工作
- 通过「导出功能」生成研究成果

### 场景3：古地图数字化归档
- 对多幅古地图进行数字化标注
- 建立地名关联数据库
- 批量导出用于档案管理

---

## 🔮 后续扩展方向

1. **图层样式配置** - 支持自定义标注样式
2. **图层合并/拆分** - 图层管理高级操作
3. **权限申请流程** - 用户自主申请权限
4. **导出格式扩展** - 支持 Shapefile、DXF 等
5. **地名检索** - 按地名搜索标注
6. **图层排序** - 拖拽调整图层显示顺序
