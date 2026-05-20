# 古地图扫描件标注系统

一个功能完整的古地图数字化标注平台，支持地图上传、坐标配准、水系/地名标注、多人协同标注以及版本管理。

## 功能特性

### 1. 地图上传与管理
- 支持拖拽上传地图扫描件（JPG、PNG、TIFF等格式）
- 地图缩略图预览
- 地图列表管理

### 2. 坐标配准
- 可视化添加控制点
- 为每个控制点设置经纬度坐标
- 控制点列表管理
- 支持删除控制点

### 3. 标注工具
- **地名标注**：在地图上添加地点标记
- **水系标注**：手绘水线路径
- 自定义标注名称
- 标注列表查看

### 4. 多人协同标注
- WebSocket实时通信
- 在线用户列表显示（彩色头像）
- 实时光标位置同步
- 标注操作实时同步

### 5. 版本管理
- 标注自动版本记录
- 版本历史查看
- 一键恢复任意历史版本

### 6. 地图浏览
- 缩放控制（30% - 300%）
- 大地图滚动浏览
- Fabric.js画布渲染

## 技术架构

### 后端
- **Node.js + Express**：Web服务器
- **Socket.io**：实时通信
- **SQLite3**：数据存储
- **Multer**：文件上传

### 前端
- **React 18**：UI框架
- **React Router**：路由管理
- **Fabric.js**：画布渲染
- **Axios**：HTTP客户端
- **Lucide React**：图标库

## 项目结构

```
p119/
├── server/
│   ├── index.js          # 服务器入口
│   ├── database.js       # 数据库初始化
│   └── routes/
│       ├── maps.js       # 地图API
│       └── annotations.js # 标注API
├── client/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── index.css
│       ├── components/
│       │   ├── MapList.js
│       │   └── MapEditor.js
│       └── services/
│           ├── api.js
│           └── socket.js
├── uploads/              # 上传文件目录
├── data/                 # 数据库目录
└── package.json
```

## 数据库设计

### maps 表
- id: 地图唯一标识
- name: 地图名称
- filename: 文件名
- upload_date: 上传时间
- width/height: 地图尺寸
- status: 地图状态

### control_points 表
- id: 控制点ID
- map_id: 关联地图
- x/y: 像素坐标
- lon/lat: 经纬度坐标
- created_at: 创建时间

### annotations 表
- id: 标注唯一标识
- map_id: 关联地图
- type: 标注类型(place/water)
- name: 标注名称
- geometry: 几何数据(JSON)
- style: 样式配置(JSON)
- created_by: 创建用户
- version: 当前版本
- is_deleted: 删除标记

### annotation_versions 表
- id: 版本ID
- annotation_id: 关联标注
- version: 版本号
- name/geometry/style: 快照数据

## 安装与运行

### 1. 安装后端依赖
```bash
npm install
```

### 2. 安装前端依赖
```bash
cd client
npm install
cd ..
```

### 3. 启动开发服务器
```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：单独启动后端
npm run server

# 方式三：单独启动前端
cd client && npm start
```

### 4. 访问应用
- 前端地址: http://localhost:3000
- 后端API: http://localhost:5000

## 使用说明

### 基础操作流程

1. **上传地图**
   - 在首页点击或拖拽地图文件到上传区域
   - 等待上传完成后，地图会显示在列表中

2. **进入编辑**
   - 点击地图卡片进入编辑器

3. **坐标配准**
   - 点击"添加控制点"工具
   - 在地图上点击选择控制点位置
   - 输入对应的经度和纬度
   - 点击"保存控制点"

4. **添加地名标注**
   - 点击"地名标注"工具
   - 在地图上点击选择位置
   - 输入地名
   - 点击"保存地名"

5. **添加水系标注**
   - 点击"水系标注"工具
   - 在地图上沿水系路径拖动绘制
   - 输入水系名称
   - 点击"保存水系"

6. **版本恢复**
   - 在标注列表中点击选择一个标注
   - 在版本历史中查看所有历史版本
   - 点击任意版本即可恢复

### 多人协同

- 打开多个浏览器窗口访问同一地图
- 每个用户的光标位置会实时显示
- 所有标注操作会实时同步到所有用户

## API接口

### 地图相关
- `POST /api/maps/upload` - 上传地图
- `GET /api/maps` - 获取地图列表
- `GET /api/maps/:id` - 获取单个地图
- `POST /api/maps/:id/control-points` - 添加控制点
- `GET /api/maps/:id/control-points` - 获取控制点列表
- `DELETE /api/maps/:mapId/control-points/:pointId` - 删除控制点

### 标注相关
- `GET /api/annotations/map/:mapId` - 获取地图标注
- `POST /api/annotations` - 创建标注
- `PUT /api/annotations/:id` - 更新标注
- `DELETE /api/annotations/:id` - 删除标注（软删除）
- `GET /api/annotations/:id/versions` - 获取版本历史
- `POST /api/annotations/:id/restore/:version` - 恢复版本

## Socket.io事件

### 客户端发送
- `join-map`: 加入地图编辑
- `cursor-move`: 光标移动
- `annotation-created`: 创建标注
- `annotation-updated`: 更新标注
- `annotation-deleted`: 删除标注
- `control-point-added`: 添加控制点

### 服务器广播
- `user-joined`: 用户加入
- `user-left`: 用户离开
- `active-users`: 在线用户列表
- `cursor-update`: 光标位置更新
- `annotation-added`: 新标注
- `annotation-modified`: 标注更新
- `annotation-removed`: 标注删除
- `control-point-new`: 新控制点

## 注意事项

1. 首次运行会自动创建 `uploads` 和 `data` 目录
2. SQLite数据库文件位于 `data/maps.db`
3. 大地图建议先压缩后上传以获得更好性能
4. 多人协同功能要求稳定的网络连接

## 后续优化方向

- [ ] 支持更多几何标注类型（多边形、矩形等）
- [ ] 控制点坐标转换算法（仿射变换）
- [ ] 标注样式自定义
- [ ] 图层管理
- [ ] 导出标注数据为GeoJSON
- [ ] 用户身份认证系统
- [ ] 地图比对和拼接功能
- [ ] 批量导入控制点
