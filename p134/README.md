# 加密货币三角套利监控系统

一个完整的全栈应用，实时监控Binance、Coinbase、Kraken等交易所的加密货币价格，自动检测三角套利机会。

## 功能特性

### 后端
- 🔌 **多交易所WebSocket连接**: Binance、Coinbase、Kraken实时价格
- 🔺 **高性能三角套利计算**: 图结构优化，O(k*m)复杂度替代O(n³)
- 💾 **Redis缓存**: 实时价格数据高速缓存
- 🗄️ **PostgreSQL存储**: 套利机会历史记录持久化
- 📡 **Socket.io实时推送**: 向前端推送实时数据和套利警报
- 🧹 **智能数据清理**: 过期数据自动清理，防止数据错乱
- 🛡️ **价格有效性校验**: 异常价格过滤，防止错误计算
- 🚫 **重复机会检测**: 5秒内相似机会去重

### 前端
- 📊 **实时仪表盘**: 展示各交易所价格、价差、当前套利机会
- 📈 **历史图表**: 利润率趋势图表
- 🔔 **浏览器通知**: 发现套利机会时发送桌面通知
- ⚙️ **自定义配置**: 支持自定义监控的交易对三角组合
- 🎨 **现代化UI**: 深色主题，响应式设计
- 📱 **性能指标展示**: 计算次数、耗时等实时监控

## 技术栈

### 后端
- Node.js + Express
- Socket.io (WebSocket)
- Redis (ioredis)
- PostgreSQL + Sequelize
- Axios

### 前端
- Vue 3 (Composition API)
- Vue Router
- Chart.js + vue-chartjs
- Tailwind CSS
- Socket.io-client
- Vite

## 性能优化亮点

### 算法优化
- **原算法**: O(n³) 三重循环，10币种会卡死
- **新算法**: 图结构 + 基准货币，复杂度降至 O(k*m)
  - k = 基准货币数量 (4个: USDT, BTC, ETH, BNB)
  - m = 每个货币的平均邻接币种数
- **结果**: 即使50个币种也能毫秒级完成计算

### 数据结构优化
- 使用 Map() 替代 对象存储，O(1) 查找
- 价格图自动构建双向汇率边
- setImmediate 异步计算，避免阻塞事件循环

### 稳定性优化
- WebSocket 断线自动重连 + 指数退避
- 30秒数据超时自动清理
- 价格异常检测 (价差>50%、bid>ask、价格为0)
- 重复套利机会去重缓存

## 快速开始

### 方式一: Docker Compose (推荐)

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问:
- 前端: http://localhost:5173
- 后端API: http://localhost:3000

### 方式二: 本地开发

#### 前置要求
- Node.js 18+
- Redis 7+
- PostgreSQL 15+

#### 启动后端

```bash
cd backend
npm install

# 复制并配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和Redis连接

# 启动服务
npm run dev
```

#### 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # 数据库、Redis配置
│   │   ├── exchanges/       # 交易所客户端 (Binance, Coinbase, Kraken)
│   │   ├── arbitrage/       # 套利计算器 (图算法优化)
│   │   ├── models/          # 数据模型
│   │   └── server.js        # 主服务器
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # Vue组件
│   │   ├── views/           # 页面视图
│   │   ├── router/          # 路由配置
│   │   ├── style.css        # 全局样式
│   │   └── main.js          # 入口文件
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
└── docker-compose.yml
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/opportunities | 获取历史套利机会 |
| GET | /api/prices/:exchange | 获取指定交易所的当前价格 |
| GET | /api/triangles | 获取当前监控的三角组合 |
| POST | /api/triangles | 更新监控的三角组合 |
| GET | /api/spreads | 获取各交易所价差数据 |
| GET | /api/status | 获取系统状态和性能指标 |

## WebSocket 事件

| 事件名 | 说明 |
|--------|------|
| priceUpdate | 价格更新，包含当前价差 |
| arbitrageOpportunity | 发现套利机会 |
| arbitrageAlert | 套利警报（触发通知） |
| trianglesUpdated | 监控三角组合已更新 |

## 默认监控的套利三角

- BTCUSDT → ETHBTC → ETHUSDT
- BTCUSDT → LTCBTC → LTCUSDT
- ETHUSDT → BTCETH → BTCUSDT
- BTCUSDT → XRPBTC → XRPUSDT
- BTCUSDT → ADABTC → ADAUSDT
- BTCUSDT → SOLBTC → SOLUSDT
- BTCUSDT → DOTBTC → DOTUSDT

系统会自动根据可用交易对动态发现更多套利路径。

## 套利原理

三角套利利用三个交易对之间的价格差异获利：

例如：
1. 用 USDT 买入 BTC (BTCUSDT)
2. 用 BTC 买入 ETH (ETHBTC)  
3. 卖出 ETH 换回 USDT (ETHUSDT)

如果最终 USDT 数量增加，就存在套利机会。系统使用图结构遍历所有有效三边路径。

## 注意事项

⚠️ **重要提醒**:
1. 本系统仅用于监控和学习，不构成投资建议
2. 实际交易需要考虑手续费、滑点、延迟等因素
3. 交易所可能有API请求限制，请合理使用
4. 加密货币市场波动大，请谨慎操作
5. 当前算法仅扫描基准货币开头的路径，可根据需要扩展

## 许可证

MIT
