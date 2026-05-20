# 2.5D太空沙盒游戏 - 技术架构文档

## 1. 整体架构

### 1.1 架构图
```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (Client)                        │
├──────────────────┬──────────────────┬────────────────────────┤
│   React UI层     │   Phaser游戏层    │   WebSocket网络层      │
│  - 状态面板      │  - 场景渲染       │  - 连接管理           │
│  - 交易面板      │  - 输入处理       │  - 差值解压           │
│  - 玩家列表      │  - 实体渲染       │  - 状态同步           │
└──────────────────┴──────────────────┴────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        后端 (Server)                         │
├──────────────────┬──────────────────┬────────────────────────┤
│   ECS引擎核心    │   网络同步层      │   持久化层            │
│  - 实体管理      │  - WebSocket服务  │  - LevelDB           │
│  - 组件系统      │  - 差值压缩       │  - 数据序列化        │
│  - 系统调度      │  - 广播机制       │  - 快照存储          │
└──────────────────┴──────────────────┴────────────────────────┘
```

## 2. 项目目录结构

### 2.1 整体结构
```
p24/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── components/        # React组件
│   │   │   ├── StatusPanel.tsx
│   │   │   ├── TradePanel.tsx
│   │   │   └── PlayerList.tsx
│   │   ├── game/              # Phaser游戏逻辑
│   │   │   ├── scenes/
│   │   │   │   └── GameScene.ts
│   │   │   ├── entities/
│   │   │   └── GameManager.ts
│   │   ├── network/           # 网络层
│   │   │   └── WebSocketClient.ts
│   │   └── App.tsx
│   └── package.json
│
└── server/                    # 后端项目
    ├── src/
    │   ├── ecs/               # ECS核心
    │   │   ├── Entity.ts
    │   │   ├── Component.ts
    │   │   ├── System.ts
    │   │   └── World.ts
    │   ├── components/        # 组件定义
    │   │   ├── Position.ts
    │   │   ├── Velocity.ts
    │   │   ├── Health.ts
    │   │   ├── Cargo.ts
    │   │   └── Render.ts
    │   ├── systems/           # 系统实现
    │   │   ├── MovementSystem.ts
    │   │   ├── CollisionSystem.ts
    │   │   ├── MiningSystem.ts
    │   │   └── CombatSystem.ts
    │   ├── network/           # 网络模块
    │   │   ├── WebSocketServer.ts
    │   │   ├── DeltaCompressor.ts
    │   │   └── SyncManager.ts
    │   ├── persistence/       # 持久化
    │   │   └── LevelDBStore.ts
    │   └── index.ts
    └── package.json
```

## 3. ECS架构设计

### 3.1 核心抽象
- **Entity**: 唯一ID，无状态
- **Component**: 纯数据结构
- **System**: 逻辑处理单元
- **World**: 实体-组件-系统的容器

### 3.2 组件定义
```typescript
// PositionComponent
interface Position {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

// VelocityComponent
interface Velocity {
  vx: number;
  vy: number;
  vz: number;
  angularVelocity: number;
}

// HealthComponent
interface Health {
  current: number;
  max: number;
  shield: number;
}

// CargoComponent
interface Cargo {
  capacity: number;
  items: Map<string, number>;
}

// RenderComponent
interface Render {
  type: 'ship' | 'asteroid' | 'station';
  color: string;
  size: number;
}
```

### 3.3 系统实现
- **MovementSystem**: 每帧更新位置
- **CollisionSystem**: AABB碰撞检测
- **MiningSystem**: 距离检测+资源采集
- **CombatSystem**: 伤害计算+血量更新

## 4. 网络同步方案

### 4.1 差值压缩算法
1. 保存上一帧状态快照
2. 计算当前帧与上一帧的差异
3. 只发送变化的数据
4. 客户端插值平滑

### 4.2 同步频率
- 位置/速度: 每30ms同步
- 血量/货舱: 变化时同步
- 完整快照: 每5秒同步

### 4.3 数据格式
```typescript
interface DeltaUpdate {
  entityId: string;
  changes: {
    position?: Position;
    velocity?: Velocity;
    health?: Health;
    cargo?: Cargo;
  };
  timestamp: number;
}
```

## 5. 持久化方案

### 5.1 LevelDB键设计
```
entity:{id}           -> 完整实体数据
player:{socketId}    -> 玩家关联的实体ID
snapshot:{timestamp} -> 世界快照
```

### 5.2 保存策略
- 实时保存重要变化
- 定时保存完整快照
- 玩家断开时保存

## 6. 技术选型理由

### 6.1 Phaser.js
- 成熟的2D游戏引擎
- 优秀的WebGL渲染性能
- 丰富的物理引擎支持

### 6.2 React
- 组件化UI开发
- 高效的状态管理
- 丰富的生态系统

### 6.3 ECS架构
- 高性能数据导向设计
- 便于扩展新功能
- 网络同步友好

### 6.4 LevelDB
- 高性能键值存储
- Node.js良好支持
- 适合游戏数据存储
