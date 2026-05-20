# 竹编缺陷检测监控系统

## 项目简介

本项目是一个完整的竹编缺陷检测监控操作台系统，包含前端Vue3监控界面和后端Spring Boot服务，支持实时检测、缺陷分级预警、历史数据查询等功能。

## 技术栈

### 前端
- Vue 3
- Vue Router
- Element Plus
- ECharts
- WebSocket
- Axios

### 后端
- Spring Boot 2.7.x
- Spring Data JPA
- WebSocket
- MySQL
- Lombok
- FastJSON

## 项目结构

```
p72/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   │   ├── Dashboard.vue    # 实时监控页面
│   │   │   ├── History.vue      # 历史数据页面
│   │   │   └── Settings.vue     # 参数设置页面
│   │   ├── router/          # 路由配置
│   │   ├── api/             # API接口
│   │   ├── utils/           # 工具类
│   │   └── assets/          # 静态资源
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── backend/                  # 后端项目
    ├── src/
    │   └── main/
    │       ├── java/com/bamboo/defect/
    │       │   ├── entity/      # 实体类
    │       │   ├── repository/  # 数据访问层
    │       │   ├── service/     # 业务逻辑层
    │       │   ├── controller/  # 控制器
    │       │   ├── config/      # 配置类
    │       │   ├── websocket/   # WebSocket
    │       │   ├── task/        # 定时任务
    │       │   └── common/      # 公共类
    │       └── resources/
    │           └── application.yml
    └── pom.xml
```

## 数据库设计

### 主要数据表

1. **detection_record** - 检测记录表
   - id: 主键
   - product_id: 产品编号
   - timestamp: 检测时间
   - defect_count: 缺陷数量
   - has_defect: 是否有缺陷
   - operator: 操作员
   - handled: 是否已处理
   - remark: 备注

2. **defect_record** - 缺陷记录表
   - id: 主键
   - detection_id: 检测记录ID
   - type: 缺陷类型（断丝、错位、漏织、污渍、其他）
   - level: 缺陷等级（1=轻微, 2=一般, 3=严重）
   - position_x: X坐标位置
   - position_y: Y坐标位置
   - confidence: 置信度
   - size: 缺陷尺寸
   - timestamp: 记录时间
   - handled: 是否已处理

3. **process_params** - 工艺参数表
   - id: 主键
   - param_type: 参数类型（detection、camera、alert）
   - param_name: 参数名称
   - param_value: 参数值
   - unit: 单位
   - description: 描述
   - enabled: 是否启用
   - update_time: 更新时间
   - operator: 操作员

4. **param_history** - 参数变更历史表
   - id: 主键
   - param_type: 参数类型
   - param_name: 参数名称
   - old_value: 原值
   - new_value: 新值
   - operator: 操作员
   - timestamp: 变更时间

## 快速开始

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端访问地址: http://localhost:3000

### 后端启动

1. 创建MySQL数据库
```sql
CREATE DATABASE bamboo_defect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 修改数据库配置（backend/src/main/resources/application.yml）
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/bamboo_defect
    username: your_username
    password: your_password
```

3. 启动Spring Boot应用
```bash
cd backend
mvn spring-boot:run
```

后端访问地址: http://localhost:8080

## 主要功能

### 1. 实时监控页面 (Dashboard)
- 实时检测画面展示
- 缺陷位置标记和详情查看
- 检测统计数据（总检测数、合格数、预警数、缺陷数）
- 合格率进度条
- 工艺参数面板
- 近期缺陷记录列表
- 缺陷趋势图（近7天）
- 缺陷类型分布图
- 开始/停止检测控制

### 2. 历史数据页面 (History)
- 多条件查询（时间范围、缺陷等级、缺陷类型、处理状态）
- 检测记录分页列表
- 缺陷详情弹窗
- 批量导出功能
- 标记已处理功能

### 3. 参数设置页面 (Settings)
- 检测参数配置（速度、精度、置信度阈值、等级阈值、运行模式）
- 相机参数配置（亮度、对比度、饱和度、锐度、曝光模式、分辨率）
- 预警配置（声音预警、弹窗预警、预警等级、邮件通知等）
- 参数变更历史记录

## API接口列表

### 检测相关接口
- `POST /api/detection/start` - 开始检测
- `POST /api/detection/stop` - 停止检测
- `GET /api/detection/status` - 获取检测状态
- `GET /api/detection/latest` - 获取最新检测结果
- `GET /api/detection/statistics` - 获取检测统计
- `GET /api/detection/history` - 获取检测历史
- `GET /api/detection/defects` - 获取缺陷列表
- `POST /api/detection/defects/{id}/handle` - 标记缺陷已处理

### 工艺参数相关接口
- `GET /api/process/params` - 获取所有参数
- `PUT /api/process/params` - 更新参数
- `GET /api/process/history` - 获取参数变更历史

### 相机相关接口
- `GET /api/camera/status` - 获取相机状态
- `GET /api/camera/snapshot` - 获取快照
- `POST /api/camera/capture` - 拍照

## WebSocket实时推送

WebSocket连接地址: `ws://localhost:8080/ws/detection`

推送消息格式:
```json
{
  "type": "detection_result",
  "data": {
    "detectionId": 1,
    "productId": "BAM-xxx",
    "defectCount": 2,
    "hasDefect": true,
    "defects": [...]
  },
  "timestamp": 1234567890
}
```

## 缺陷等级说明

- **1级 - 轻微**: 尺寸较小，不影响产品质量
- **2级 - 一般**: 需要关注，可能需要处理
- **3级 - 严重**: 严重缺陷，需要立即处理

## 缺陷类型说明

- **断丝**: 竹编丝线断裂
- **错位**: 编织位置偏移
- **漏织**: 缺少编织部分
- **污渍**: 表面污渍或污染
- **其他**: 其他类型缺陷

## 注意事项

1. 首次启动后端会自动创建数据库表结构
2. 系统会自动初始化默认工艺参数
3. 检测服务默认每2秒执行一次检测
4. 前端需要连接后端WebSocket接收实时数据
5. 生产环境需要配置真实工业相机接口

## 扩展建议

1. 接入真实工业相机SDK
2. 集成AI深度学习模型进行缺陷检测
3. 添加报表导出功能
4. 实现用户权限管理
5. 添加系统日志记录
6. 实现短信/邮件报警功能
7. 添加设备管理模块
