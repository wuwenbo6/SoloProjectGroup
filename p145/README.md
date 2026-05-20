# 传感器异常检测系统

基于 Python + InfluxDB + Kafka 的工业传感器异常检测系统，使用 LSTM 自编码器进行实时异常检测，前端 Vue3 展示频谱图和小波时频图。

## 功能特性

### 后端功能
- ✅ 传感器数据接收（振动、摆度、温度）
- ✅ Kafka 消息队列处理
- ✅ InfluxDB 时序数据存储
- ✅ LSTM 自编码器异常检测
- ✅ 钉钉机器人实时报警
- ✅ 模拟数据生成器
- ✅ 模型训练接口（支持 CSV 上传训练）
- ✅ 历史数据查询 API

### 前端功能
- ✅ 实时数据监控面板
- ✅ 频谱图（FFT）展示
- ✅ 小波时频图分析
- ✅ 历史数据回放
- ✅ 异常段标记功能
- ✅ 异常事件记录和统计
- ✅ 模型管理和训练界面

## 技术栈

### 后端
- **FastAPI**: Web 框架
- **InfluxDB**: 时序数据库
- **Kafka**: 消息队列
- **TensorFlow/Keras**: LSTM 自编码器模型
- **NumPy/Pandas**: 数据处理
- **SciPy/PyWavelets**: 信号分析（FFT、小波变换）
- **httpx**: HTTP 客户端（钉钉报警）

### 前端
- **Vue 3**: 前端框架
- **Vite**: 构建工具
- **Element Plus**: UI 组件库
- **ECharts/Vue-ECharts**: 数据可视化
- **Axios**: HTTP 客户端
- **Pinia**: 状态管理

## 项目结构

```
p145/
├── backend/                 # 后端服务
│   ├── main.py             # FastAPI 主应用
│   ├── config.py           # 配置文件
│   ├── database.py         # InfluxDB 管理
│   ├── kafka_producer.py   # Kafka 生产者
│   ├── kafka_consumer.py   # Kafka 消费者
│   ├── anomaly_detector.py # LSTM 异常检测器
│   ├── dingtalk_alert.py   # 钉钉报警
│   ├── signal_processing.py # 信号处理（FFT、小波）
│   ├── simulator.py        # 模拟数据生成器
│   ├── requirements.txt    # Python 依赖
│   ├── .env.example        # 环境变量示例
│   └── docker-compose.yml  # Docker 服务编排
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── main.js         # 入口文件
│   │   ├── App.vue         # 根组件
│   │   ├── router/         # 路由配置
│   │   ├── views/          # 页面组件
│   │   │   ├── Dashboard.vue   # 实时监控
│   │   │   ├── Analysis.vue    # 频谱分析
│   │   │   ├── History.vue     # 历史回放
│   │   │   ├── Anomalies.vue   # 异常记录
│   │   │   └── Model.vue       # 模型管理
│   │   └── api/            # API 接口
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 快速开始

### 1. 启动基础设施服务

首先启动 InfluxDB 和 Kafka：

```bash
cd backend
docker-compose up -d
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，配置钉钉 Webhook 等
```

### 3. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 4. 启动后端服务

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 安装前端依赖

```bash
cd frontend
npm install
```

### 6. 启动前端服务

```bash
cd frontend
npm run dev
```

## 使用说明

### 1. 启动模拟器

在前端点击「启动模拟」按钮，系统会自动生成模拟传感器数据并发送到 Kafka。

### 2. 训练模型

进入「模型管理」页面，可以：
- 使用模拟数据训练模型
- 上传 CSV 文件训练模型

训练完成后，模型会自动保存并加载。

### 3. 查看实时数据

进入「实时监控」页面，查看：
- 实时振动、摆度、温度数据
- 频谱分析图
- 信号特征统计

### 4. 频谱分析

进入「频谱分析」页面，查看：
- FFT 频谱图
- 小波时频图
- 信号时域波形

### 5. 历史数据回放

进入「历史回放」页面：
- 选择时间范围查询历史数据
- 控制播放速度回放数据
- 手动标记异常段

### 6. 异常记录

进入「异常记录」页面：
- 查看所有检测到的异常事件
- 查看异常统计和传感器分布

## API 接口

### 传感器数据
- `POST /api/sensor/data` - 发送传感器数据
- `GET /api/sensor/{sensor_id}/latest` - 获取最新数据
- `POST /api/sensor/history` - 查询历史数据

### 信号分析
- `GET /api/sensor/{sensor_id}/fft` - FFT 频谱分析
- `GET /api/sensor/{sensor_id}/spectrogram` - 频谱图
- `GET /api/sensor/{sensor_id}/wavelet` - 小波变换

### 异常检测
- `GET /api/anomalies` - 获取异常事件

### 模型管理
- `POST /api/model/train` - 使用模拟数据训练
- `POST /api/model/train/upload` - 上传 CSV 训练
- `GET /api/model/status` - 获取模型状态

### 模拟器
- `POST /api/simulator/start` - 启动模拟器
- `POST /api/simulator/stop` - 停止模拟器
- `GET /api/simulator/status` - 模拟器状态

## 模型说明

### LSTM 自编码器

系统使用 LSTM 自编码器进行异常检测：

1. **输入**: 时序窗口 `(sequence_length, 3)` - 振动、摆度、温度
2. **编码器**: LSTM 层将输入压缩为潜在表示
3. **解码器**: LSTM 层重建原始输入
4. **异常判断**: 计算重建误差，超过阈值则判定为异常

### 训练数据格式

CSV 训练文件必须包含以下列：

| 列名 | 说明 | 单位 |
|------|------|------|
| vibration | 振动值 | mm/s |
| swing | 摆度值 | μm |
| temperature | 温度值 | °C |

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| INFLUXDB_URL | InfluxDB 地址 | http://localhost:8086 |
| INFLUXDB_TOKEN | InfluxDB Token | - |
| INFLUXDB_ORG | 组织名 | iot-org |
| INFLUXDB_BUCKET | 数据桶 | sensor-data |
| KAFKA_BOOTSTRAP_SERVERS | Kafka 地址 | localhost:9092 |
| KAFKA_TOPIC | Kafka 主题 | sensor-data |
| DINGTALK_WEBHOOK | 钉钉 Webhook | - |
| MODEL_PATH | 模型保存路径 | ./models/lstm_autoencoder.h5 |
| ANOMALY_THRESHOLD | 异常阈值系数 | 3.0 |
| SEQUENCE_LENGTH | 序列长度 | 100 |

### 钉钉机器人配置

1. 在钉钉群中创建自定义机器人
2. 开启「加签」（可选，安全设置）
3. 复制 Webhook 地址到 `.env` 文件

## 注意事项

1. **首次运行**: 需要先训练模型，否则无法进行异常检测
2. **Kafka 依赖**: 确保 Kafka 和 Zookeeper 正常运行
3. **InfluxDB 初始化**: 首次启动 InfluxDB 需要手动创建 organization 和 bucket
4. **性能考虑**: 实时处理高频数据时，建议增加硬件资源

## 开发计划

- [ ] 支持更多信号分析算法
- [ ] 模型在线学习和更新
- [ ] 异常原因分析和建议
- [ ] 多传感器关联分析
- [ ] WebSocket 实时推送
- [ ] 数据导出功能

## 许可证

MIT License
