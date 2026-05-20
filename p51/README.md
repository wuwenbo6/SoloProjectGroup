# 工业遗产数字化3D复原系统

## 项目概述

本系统是一套专注于工业遗产数字化保护与复原的综合解决方案，采用前后端分离架构，结合微服务和3D可视化技术，实现废弃设备的数字化存档、破损标注、复原方案管理和3D交互展示。

## 技术架构

### 后端技术栈
- **框架**: Spring Boot 2.7.x + Spring Cloud 2021.x
- **ORM**: MyBatis-Plus 3.5.x
- **数据库**: MySQL 8.x
- **服务注册**: Eureka
- **API网关**: Spring Cloud Gateway
- **构建工具**: Maven

### 前端技术栈
- **3D引擎**: Three.js r160
- **构建工具**: Vite 5.x
- **HTTP客户端**: Axios
- **UI**: 原生CSS + JavaScript

## 项目结构

```
p51/
├── backend/                          # 后端微服务
│   ├── eureka-server/               # 服务注册中心
│   ├── gateway/                     # API网关
│   ├── common/                      # 公共模块（实体类、工具类）
│   ├── equipment-service/           # 设备管理服务
│   ├── archive-service/             # 档案管理服务
│   └── restoration-service/         # 复原进度管理服务
├── frontend/                        # 前端3D交互系统
│   ├── src/
│   │   ├── scenes/                 # 3D场景模块
│   │   ├── services/               # API服务
│   │   └── styles/                 # 样式文件
│   ├── index.html
│   └── package.json
└── database/                        # 数据库脚本
    └── scripts/
        └── init_schema.sql
```

## 核心功能

### 1. 3D扫描建模模块
- 设备3D模型加载与展示
- 360°旋转查看
- 缩放、平移交互
- 光照效果优化

### 2. 设备结构拆解模块
- 部件拆解动画
- 部件高亮选中
- 部件信息展示
- 材质分类显示

### 3. 破损部位标注模块
- 破损点可视化标记
- 破损程度分级显示（轻微/中等/严重）
- 脉冲动画效果
- 破损信息联动展示

### 4. 复原效果预览
- 复原前后材质对比
- 渐变动画过渡
- 发光效果展示

### 5. 历史档案关联模块
- 技术文档存档
- 维修记录管理
- 正式文件归档
- 与3D模型双向对照

### 6. 多设备对比功能
- 设备参数对比
- 制造年份差异分析
- 复原进度对比

## 数据库设计

### 主要数据表
- `equipment` - 设备基础信息表
- `equipment_part` - 设备部件表
- `damage_mark` - 破损标注表
- `structure_drawing` - 结构图纸表
- `archive` - 历史档案表
- `restoration_plan` - 复原方案表
- `restoration_progress` - 复原进度表

## 快速开始

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端访问地址: http://localhost:5173

### 后端启动（按顺序）

1. **启动Eureka服务注册中心**
```bash
cd backend/eureka-server
mvn spring-boot:run
```
访问地址: http://localhost:8761

2. **启动设备管理服务**
```bash
cd backend/equipment-service
mvn spring-boot:run
```
服务端口: 8081

3. **启动档案管理服务**
```bash
cd backend/archive-service
mvn spring-boot:run
```
服务端口: 8082

4. **启动复原进度管理服务**
```bash
cd backend/restoration-service
mvn spring-boot:run
```
服务端口: 8083

5. **启动API网关**
```bash
cd backend/gateway
mvn spring-boot:run
```
网关端口: 8080

### 数据库初始化

```bash
mysql -u root -p < database/scripts/init_schema.sql
```

## API接口列表

### 设备管理 API
- `GET /api/equipment` - 获取设备列表
- `GET /api/equipment/{id}` - 获取设备详情
- `POST /api/equipment` - 创建设备
- `PUT /api/equipment` - 更新设备
- `DELETE /api/equipment/{id}` - 删除设备
- `GET /api/equipment/{id}/parts` - 获取设备部件
- `GET /api/equipment/{id}/damage-marks` - 获取破损标注

### 档案管理 API
- `GET /api/archive` - 获取档案列表
- `GET /api/archive/{id}` - 获取档案详情
- `GET /api/archive/equipment/{equipmentId}` - 获取设备关联档案
- `GET /api/archive/type/{type}` - 按类型获取档案

### 复原进度 API
- `GET /api/restoration/plans` - 获取复原方案列表
- `GET /api/restoration/plans/equipment/{equipmentId}` - 获取设备复原方案
- `GET /api/restoration/progress/plan/{planId}` - 获取方案进度

## 功能操作说明

### 3D交互控制
- **鼠标左键拖动**: 旋转视角
- **鼠标滚轮**: 缩放视角
- **鼠标右键拖动**: 平移视角

### 工具栏功能
1. **360°旋转**: 开启/关闭自动旋转模式
2. **部件拆解**: 执行拆解/组装动画
3. **破损标注**: 显示/隐藏破损标记点
4. **复原效果**: 预览复原前后效果对比
5. **重置视图**: 恢复初始视角状态

### 侧边栏功能
- 左侧: 设备信息、部件列表、破损标注、历史档案
- 右侧: 复原进度追踪、设备对比工具

## 特色亮点

1. **冷门场景聚焦**: 专注工业遗产数字化，填补传统文物修复的空白领域
2. **无模板化设计**: 支持任意形状设备的3D标注与拆解，无需预设模板
3. **双向对照机制**: 3D模型与历史档案资料相互关联，实现精准溯源
4. **微服务架构**: 各业务模块独立部署，便于扩展和维护
5. **流畅3D体验**: 采用Three.js高性能渲染，支持复杂模型的实时交互

## 开发团队

本项目采用现代化软件工程实践，代码结构清晰，注释完备，易于后续扩展和维护。

## 许可证

MIT License
