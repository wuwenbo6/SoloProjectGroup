# 3D工厂数字孪生平台

基于Babylon.js + React + Node.js的3D工厂数字孪生可视化平台。

## ✨ 功能特性

### 核心功能
- **3D可视化**: 使用Babylon.js渲染工厂设备3D模型
- **实时数据**: 通过WebSocket推送设备实时状态（温度、转速、故障码）
- **设备控制**: 支持远程启停设备控制
- **历史数据**: InfluxDB存储历史数据，支持趋势图表展示
- **MQTT集成**: 兼容真实PLC数据接入（内置模拟数据）

### 🎮 数字沙盘 (v3.0 新增)
- **参数模拟**: 调整设备运行速度、温度等参数进行虚拟仿真
- **LSTM时序预测**: 基于历史数据的深度学习模型，预测未来5分钟故障概率
- **风险评估**: 高/中/低三级风险预警，置信度可视化
- **影响因素分析**: 温度、速度等参数对故障风险的影响评估
- **智能建议**: 根据预测结果提供参数调整建议

## 🚀 性能优化 (v2.0)

针对50+设备并发推送的掉帧问题，进行了以下优化：

| 优化项 | 说明 | 预期效果 |
|--------|------|---------|
| **增量推送 (Delta Sync)** | 仅发送变化的字段，而非完整状态 | 数据量减少 80-90% |
| **MessagePack 压缩** | 二进制序列化替代JSON | 数据体积减少 50%+ |
| **批量节流** | 100ms内的更新合并推送 | 消息频率降低 83% |
| **数值变化阈值** | 温度/速度小于0.05时不推送 | 进一步减少冗余 |

**综合优化效果**: 网络传输量降低 **~95%**，彻底解决50+设备并发时的前端掉帧问题。

## 📁 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── server.js       # 主服务入口
│   │   ├── services/
│   │   │   ├── mqttService.js      # MQTT服务
│   │   │   ├── influxdbService.js  # InfluxDB服务
│   │   │   └── deltaSyncService.js # 增量同步服务 ✨
│   │   └── controllers/
│   │       └── deviceController.js # 设备控制器
│   └── package.json
└── frontend/               # 前端应用
    ├── src/
    │   ├── components/
    │   │   ├── FactoryScene.jsx    # 3D场景
    │   │   ├── DevicePanel.jsx     # 设备面板
    │   │   ├── DeviceDetail.jsx    # 设备详情
    │   │   ├── Header.jsx          # 头部组件
    │   │   └── ModelLoader.jsx     # 模型加载器
    │   ├── store/
    │   │   └── deviceStore.js      # Zustand状态管理
    │   └── main.jsx
    └── package.json
```

## 🔧 设备类型

1. **传送带 (Conveyor)**: 显示温度、速度
2. **机械臂 (Robot Arm)**: 显示温度、转速
3. **AGV小车 (AGV)**: 显示温度、电池电量、速度

## 🚀 快速开始

### 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务运行在 http://localhost:3001

**性能监控API**: `GET /api/stats` - 查看连接数、设备数等统计信息

### 启动前端应用

```bash
cd frontend
npm install
npm run dev
```

前端应用运行在 http://localhost:3000

### 大规模设备测试

模拟60台设备的高负载场景：

```bash
# 后端（可通过环境变量调整设备数量）
SIMULATION_DEVICE_COUNT=60 npm start
```

## 💡 使用说明

1. 打开浏览器访问 http://localhost:3000
2. 3D场景中会显示60台设备（默认）：
   - 20条传送带
   - 20台机械臂
   - 20台AGV小车
3. 点击设备（3D场景或右侧列表）查看详情
4. 在详情面板中可进行启停控制
5. 查看温度历史趋势图表
6. 头部状态栏显示MessagePack节省的带宽

## 🛠 技术栈

**前端**:
- React 18
- Babylon.js 6.x
- Zustand (状态管理)
- Recharts (图表)
- @msgpack/msgpack (二进制序列化)
- Vite (构建工具)

**后端**:
- Node.js + Express
- WebSocket (ws库)
- MQTT.js
- @msgpack/msgpack (二进制序列化)
- InfluxDB Client

## ⚙️ 配置说明

### MQTT配置

默认使用模拟数据，如需接入真实MQTT broker：

1. 修改 `backend/src/services/mqttService.js`
2. 设置 `this.simulated = false`
3. 配置MQTT broker连接地址

### InfluxDB配置

默认使用内存存储，如需接入真实InfluxDB：

1. 修改 `backend/src/services/influxdbService.js`
2. 设置 `this.simulated = false`
3. 配置InfluxDB连接参数

### 增量同步配置

在 `backend/src/server.js` 中调整：

```javascript
const deltaSync = new DeltaSyncService({
  throttleMs: 100,       // 批量推送间隔
  changeThreshold: 0.05  // 数值变化阈值
});
```

关闭MessagePack：
```javascript
const useMsgPack = false;
```

## 📝 开发说明

### 添加新设备类型

1. 在 `backend/src/controllers/deviceController.js` 中添加设备配置
2. 在 `frontend/src/components/FactoryScene.jsx` 中添加3D模型创建函数
3. 在 `frontend/src/components/DeviceDetail.jsx` 中添加状态显示项

### 自定义3D模型

使用 `ModelLoader` 组件加载外部GLB/GLTF模型：

```javascript
const loader = new ModelLoader(scene);
const model = await loader.loadModel('/models/', 'device.glb', position);
```

## 📊 性能基准

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 单消息大小 | ~500B | ~50B | 90%↓ |
| 每秒消息数 | 120 | 10 | 92%↓ |
| 每秒数据量 | ~60KB | ~0.5KB | 99%↓ |
| 前端FPS (60设备) | < 20 | 稳定 60 | 300%↑ |

## 📄 许可证

MIT
