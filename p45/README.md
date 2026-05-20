# 联盟链浏览器

基于 Hyperledger Besu 风格的联盟链浏览器，支持公开交易和隐私交易的查看与管理。

## 项目架构

```
联盟链浏览器
├── explorer-api/      # 后端API (Spring Boot + Web3j)
├── indexer/           # 区块链索引器
├── mock-chain/        # 模拟区块链节点
└── frontend/          # 前端界面 (Next.js)
```

### 模块说明

#### 1. explorer-api (后端API)
- **端口**: 8080
- **功能**:
  - 区块查询API
  - 交易查询API
  - 隐私交易管理API
  - 合约调用图谱API
  - 统计信息API

#### 2. indexer (区块链索引器)
- **端口**: 8081
- **功能**:
  - 监听区块链新区块
  - 索引交易数据
  - 支持公开交易和隐私交易
  - 模拟数据生成

#### 3. mock-chain (模拟联盟链)
- **端口**: 8082
- **功能**:
  - 模拟 3 个组织节点 (Org1, Org2, Org3)
  - Tessera 隐私管理器模拟
  - 区块自动生成
  - 模拟智能合约调用

#### 4. frontend (前端界面)
- **端口**: 3000
- **功能**:
  - 仪表板统计展示
  - 区块列表/详情
  - 交易列表/详情
  - 交易流可视化
  - 合约调用图谱
  - 隐私交易解密演示

## 技术栈

### 后端
- Java 17
- Spring Boot 3.2.0
- Spring Data JPA
- Web3j 4.10.3
- H2 Database (内存)
- Lombok

### 前端
- Next.js 14
- React 18
- Chart.js (图表)
- React Flow (图谱可视化)
- Axios (HTTP 客户端)

## 快速开始

### 前置要求

- JDK 17+
- Maven 3.8+
- Node.js 18+
- npm 9+

### 一键启动

```bash
# 编译并启动所有服务
./start.sh
```

### 手动启动

1. **编译后端项目**
```bash
mvn clean install -DskipTests
```

2. **启动模拟区块链**
```bash
cd mock-chain
mvn spring-boot:run
```

3. **启动后端API**
```bash
cd explorer-api
mvn spring-boot:run
```

4. **启动索引器**
```bash
cd indexer
mvn spring-boot:run
```

5. **启动前端**
```bash
cd frontend
npm install
npm run dev
```

### 停止服务

```bash
./stop.sh
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| Explorer API | http://localhost:8080/api |
| Indexer | http://localhost:8081 |
| Mock Chain | http://localhost:8082 |

## API 文档

### 区块相关
- `GET /api/blocks` - 获取区块列表
- `GET /api/blocks/hash/{hash}` - 根据哈希获取区块
- `GET /api/blocks/number/{number}` - 根据区块号获取区块
- `GET /api/blocks/latest` - 获取最新区块号

### 交易相关
- `GET /api/transactions` - 获取交易列表
- `GET /api/transactions/private` - 获取隐私交易列表
- `GET /api/transactions/hash/{hash}` - 根据哈希获取交易
- `GET /api/transactions/block/{blockNumber}` - 获取区块内交易
- `GET /api/transactions/privacy-group/{groupId}` - 获取隐私组交易

### 隐私交易相关
- `GET /api/privacy/participants/{transactionHash}` - 获取交易参与方
- `GET /api/privacy/org/{orgName}/participants` - 获取组织参与的交易
- `GET /api/privacy/org/{orgName}/public-key` - 获取组织公钥
- `POST /api/privacy/decrypt` - 解密payload

### 合约调用相关
- `GET /api/contract-calls/{contractAddress}` - 获取合约调用记录
- `GET /api/contract-calls/addresses` - 获取所有合约地址

### 统计信息
- `GET /api/stats` - 获取整体统计信息

## 隐私交易演示

1. 进入「隐私交易管理」页面
2. 选择一笔隐私交易
3. 选择解密的组织（Org1/Org2/Org3）
4. 点击「开始解密」查看解密结果

## 合约调用图谱

1. 进入「合约调用图谱」页面
2. 左侧查看组织到合约到账本的交易流
3. 右侧查看具体的合约调用记录
4. 点击节点可查看详细信息

## 项目目录结构

```
.
├── explorer-api/
│   ├── src/main/java/com/explorer/
│   │   ├── controller/       # REST 控制器
│   │   ├── service/          # 业务逻辑
│   │   ├── privacy/          # 隐私交易处理
│   │   ├── entity/           # 数据实体
│   │   ├── repository/       # 数据访问层
│   │   ├── config/           # 配置类
│   │   └── dto/              # 数据传输对象
│   └── src/main/resources/   # 配置文件
│
├── indexer/
│   ├── src/main/java/com/indexer/
│   │   ├── listener/         # 区块链监听器
│   │   ├── entity/           # 数据实体
│   │   └── repository/       # 数据访问层
│   └── src/main/resources/   # 配置文件
│
├── mock-chain/
│   ├── src/main/java/com/mockchain/
│   │   ├── node/             # 节点模拟
│   │   ├── privacy/          # Tessera 模拟
│   │   └── simulator/        # 区块链模拟器
│   └── src/main/resources/   # 配置文件
│
├── frontend/
│   ├── pages/                # Next.js 页面
│   ├── lib/                  # 工具库和API客户端
│   └── styles/               # 样式文件
│
├── start.sh                  # 启动脚本
├── stop.sh                   # 停止脚本
└── pom.xml                   # Maven 父项目
```

## 模拟组织配置

系统内置 3 个组织节点：

| 组织 | 公钥 | 说明 |
|------|------|------|
| Org1 | BULeR8JyUWhiuuCMU/HLA0Q5pzkYT+cHII3ZKBey3Bo= | 发起方 |
| Org2 | QfeDAys9MPDs2XHExtc84jKGHxZg/aj52DTh0vtA3Xc= | 参与方 |
| Org3 | 1iTZde/ndBHvzhcl7V68x44Vx7pl8nwx9LqnM/AfJUg= | 参与方 |

## 日志文件

启动后日志位于 `logs/` 目录：
- `mock-chain.log` - 模拟链日志
- `explorer-api.log` - 后端API日志
- `indexer.log` - 索引器日志
- `frontend.log` - 前端日志

## 开发说明

### 添加新的 API 端点
1. 在 `explorer-api/src/main/java/com/explorer/controller/` 创建 Controller
2. 在 `service/` 层实现业务逻辑
3. 如果需要数据持久化，在 `entity/` 添加实体和 `repository/` 添加接口

### 扩展模拟数据
1. 在 `mock-chain/src/main/java/com/mockchain/simulator/MockBlockchainService.java` 修改生成逻辑
2. 调整生成参数（区块间隔、交易数量等）

## License

MIT License