# Particle Life Simulation

一个基于WebGPU和Three.js的粒子生命模拟全栈应用，类似Langton's Ant但具有群体行为特性。

## 功能特性

### 第一轮 - 基础功能
- ✅ **WebGPU计算着色器**：高性能粒子物理计算
- ✅ **Three.js 3D渲染**：实时粒子可视化
- ✅ **粒子状态系统**：
  - 觅食状态 (绿色)
  - 攻击状态 (红色)
  - 繁殖状态 (紫色)
  - 休眠状态 (青色)
- ✅ **实时热力图**：显示粒子活动密度
- ✅ **WebSocket服务**：多客户端实时同步
- ✅ **PostgreSQL数据库**：存储种群统计数据和粒子历史
- ✅ **REST API**：获取历史数据和统计信息
- ✅ **Docker部署**：一键启动完整应用栈

### 第二轮 - Bug修复
- ✅ **边界状态切换修复**：修复粒子在立方体边界状态切换时WebGPU缓冲区更新失败导致卡死的问题
- ✅ **WebSocket广播修复**：确保所有客户端都能正确接收粒子死亡事件和同步更新
- ✅ **粒子轨迹重复问题修复**：优化计算着色器中的粒子位置更新逻辑

### 第三轮 - 功能增强
- ✅ **能量系统**：
  - 粒子移动消耗能量
  - 能量过低时进入休眠状态
  - 休眠时自动恢复能量
  - 可手动添加能量
- ✅ **地形高度场**：
  - 基于Perlin噪声的3D地形
  - 地形影响粒子移动速度和方向
- ✅ **时间轴回放**：
  - 自动记录粒子历史状态
  - 可加载并回放历史数据
  - 支持时间轴拖动定位

## 技术栈

### 前端
- **TypeScript** - 类型安全的JavaScript
- **WebGPU** - 现代GPU计算和渲染API
- **WGSL** - WebGPU着色语言
- **Three.js** - 3D图形库
- **Vite** - 快速的构建工具

### 后端
- **Node.js** - JavaScript运行时
- **Express** - Web框架
- **TypeScript** - 类型安全
- **WebSocket (ws)** - 实时通信
- **PostgreSQL** - 关系型数据库
- **node-postgres (pg)** - PostgreSQL客户端

### DevOps
- **Docker** - 容器化
- **Docker Compose** - 多容器编排

## 快速开始

### 方式一：Docker Compose (推荐)

```bash
# 克隆项目
cd particle-life-simulation

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问:
- 前端: http://localhost:3000
- 后端API: http://localhost:3001
- WebSocket: ws://localhost:3001/ws

### 方式二：本地开发

#### 前置要求
- Node.js 20+
- PostgreSQL 15+
- 支持WebGPU的浏览器 (Chrome 113+, Edge 113+, Safari 16.4+)

#### 1. 启动数据库
```bash
# 使用Docker启动PostgreSQL
docker run -d \
  --name particle-postgres \
  -e POSTGRES_DB=particle_life \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine
```

#### 2. 启动后端
```bash
cd backend
npm install
npm run dev
```

后端运行在 http://localhost:3001

#### 3. 启动前端
```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000

## API 端点

### 统计数据
- `GET /api/stats` - 获取实时统计和最新保存的统计
- `POST /api/stats` - 保存统计数据
- `GET /api/history` - 获取统计历史记录

### 粒子历史
- `GET /api/particle-history` - 获取粒子历史位置数据
  - 参数: `startTime`, `endTime`, `particleId`, `limit`
- `POST /api/particle-history` - 批量保存粒子历史数据

### 健康检查
- `GET /health` - 服务健康检查

## WebSocket 消息格式

### 客户端发送
```json
{
  "type": "particle_update",
  "particles": [
    {
      "id": "particle-1",
      "position": { "x": 0, "y": 0, "z": 0 },
      "velocity": { "x": 1, "y": 0, "z": 0 },
      "state": "foraging",
      "energy": 75
    }
  ]
}
```

```json
{
  "type": "sync_request"
}
```

### 服务器发送
```json
{
  "type": "particle_sync",
  "particles": [...],
  "timestamp": 1234567890
}
```

```json
{
  "type": "particle_death",
  "particleId": "particle-1",
  "timestamp": 1234567890
}
```

```json
{
  "type": "full_sync",
  "particles": [...],
  "timestamp": 1234567890
}
```

## 项目结构

```
particle-life-simulation/
├── frontend/
│   ├── src/
│   │   ├── gpu/
│   │   │   └── ParticleSystem.ts      # WebGPU粒子系统
│   │   ├── renderer/
│   │   │   └── SceneRenderer.ts       # Three.js场景渲染
│   │   ├── services/
│   │   │   └── WebSocketService.ts    # WebSocket服务
│   │   ├── shaders/
│   │   │   ├── particle.wgsl          # 粒子计算着色器
│   │   │   └── heatmap.wgsl           # 热力图着色器
│   │   ├── types.ts                    # 类型定义
│   │   └── main.ts                     # 应用入口
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts             # 数据库配置
│   │   ├── services/
│   │   │   └── websocket.ts            # WebSocket服务
│   │   ├── routes/
│   │   │   └── api.ts                  # API路由
│   │   └── index.ts                    # 服务入口
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 配置说明

### 粒子模拟参数 (frontend/src/main.ts)
```typescript
const CONFIG: SimulationConfig = {
  particleCount: 512,           // 粒子数量
  boundarySize: 20,              // 立方体边界大小
  speed: 5,                       // 粒子移动速度
  energyDecayRate: 2,             // 能量消耗速率
  sleepThreshold: 10,             // 休眠能量阈值
  wakeThreshold: 50,              // 唤醒能量阈值
  reproductionThreshold: 80,      // 繁殖能量阈值
  attackDistance: 2,              // 攻击距离
  terrainInfluence: 0.3,          // 地形影响力
};
```

### 环境变量
后端可通过环境变量配置：
- `DB_HOST` - 数据库主机 (默认: localhost)
- `DB_PORT` - 数据库端口 (默认: 5432)
- `DB_NAME` - 数据库名 (默认: particle_life)
- `DB_USER` - 数据库用户 (默认: postgres)
- `DB_PASSWORD` - 数据库密码 (默认: postgres)
- `PORT` - 服务端口 (默认: 3001)

## 操作说明

### UI控制
- **重置**：重置所有粒子到初始状态
- **暂停/继续**：暂停或继续粒子模拟
- **添加能量**：给所有粒子增加能量
- **加载历史**：从数据库加载粒子历史数据
- **播放回放**：播放历史粒子运动回放
- **时间轴滑块**：拖动定位到特定历史时刻

### 视角控制
- **鼠标拖动**：旋转摄像机视角
- **鼠标滚轮**：缩放视角

### 粒子状态说明
- 🟢 **绿色** - 觅食状态：粒子正在寻找能量
- 🔴 **红色** - 攻击状态：粒子正在攻击其他粒子
- 🟣 **紫色** - 繁殖状态：粒子准备繁殖
- 🔵 **青色** - 休眠状态：粒子能量耗尽正在恢复

## 数据库表结构

### particle_stats
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| timestamp | TIMESTAMP | 记录时间 |
| total_particles | INTEGER | 粒子总数 |
| foraging_particles | INTEGER | 觅食状态粒子数 |
| attacking_particles | INTEGER | 攻击状态粒子数 |
| reproducing_particles | INTEGER | 繁殖状态粒子数 |
| sleeping_particles | INTEGER | 休眠状态粒子数 |
| average_energy | FLOAT | 平均能量 |
| avg_speed | FLOAT | 平均速度 |

### particle_history
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| timestamp | TIMESTAMP | 记录时间 |
| particle_id | VARCHAR(255) | 粒子ID |
| state | VARCHAR(50) | 粒子状态 |
| position_x | FLOAT | X坐标 |
| position_y | FLOAT | Y坐标 |
| position_z | FLOAT | Z坐标 |
| energy | FLOAT | 能量值 |

## 故障排除

### WebGPU不支持
如果浏览器不支持WebGPU，请：
1. 使用Chrome 113+、Edge 113+或Safari 16.4+
2. 在Chrome中开启实验性功能：`chrome://flags/#enable-webgpu-developer-features`

### WebSocket连接失败
1. 确保后端服务正在运行
2. 检查防火墙设置
3. 查看浏览器控制台错误信息

### 数据库连接失败
1. 确保PostgreSQL服务正在运行
2. 检查环境变量配置
3. 验证数据库用户权限

## 开发计划

### 待实现功能
- [ ] 粒子繁殖系统
- [ ] 粒子碰撞检测
- [ ] 食物源系统
- [ ] 粒子进化机制
- [ ] 多物种交互
- [ ] 性能优化
- [ ] 移动端适配

## 许可证

MIT License
