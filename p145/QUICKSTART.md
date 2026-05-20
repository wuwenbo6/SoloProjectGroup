# 传感器异常检测系统 - 快速启动指南

## 功能概述

✅ **已实现功能：**
- ✅ 实时数据采集与Kafka消息队列
- ✅ LSTM自编码器异常检测
- ✅ 钉钉机器人实时报警
- ✅ InfluxDB时序数据存储
- ✅ **新增：趋势预测（未来5分钟振动趋势）**
- ✅ **新增：故障分类诊断（轴承磨损/不对中/不平衡/松动）**
- ✅ **新增：运维报告PDF生成与下载**

## 环境要求

- Python 3.8+
- Node.js 16+
- Docker & Docker Compose

## 快速启动步骤

### 第一步：启动基础设施服务

```bash
cd backend
docker-compose up -d
```

这会启动：
- ZooKeeper (端口 2181)
- Kafka (端口 9092)
- InfluxDB (端口 8086)

### 第二步：配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，配置钉钉Webhook：

```env
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=你的token
```

### 第三步：安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 第四步：启动后端服务

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

后端API文档：http://localhost:8000/docs

### 第五步：安装前端依赖

```bash
cd frontend
npm install
```

### 第六步：启动前端服务

```bash
cd frontend
npm run dev
```

前端访问地址：http://localhost:3000

## 新增功能说明

### 1. 趋势预测 - 诊断页面

**访问路径：故障诊断 → 趋势预测**

功能说明：
- 使用LSTM模型预测未来5分钟的振动趋势
- 显示趋势方向（上升/下降/稳定）
- 异常风险等级评估

API接口：
```
GET /api/trend/predict/{sensor_id}?minutes=5
```

### 2. 故障诊断分析

**访问路径：故障诊断 → 故障诊断分析**

支持的故障类型：
| 故障类型 | 中文名称 | 严重程度 |
|---------|---------|---------|
| normal | 正常运行 | 正常 |
| bearing_wear | 轴承磨损 | 中等 |
| misalignment | 不对中 | 高 |
| imbalance | 不平衡 | 中等 |
| looseness | 松动 | 高 |

诊断特性：
- 时域特征分析（RMS、峰值、波峰因子、峭度等）
- 频域特征分析（主频、谐波比等）
- 置信度评估
- 智能维护建议

API接口：
```
GET /api/fault/classify/{sensor_id}?duration_minutes=5
```

### 3. 运维报告PDF生成

**访问路径：运维报告**

报告类型：
- 日报（24小时数据）
- 周报（7天数据）
- 小时报（1小时数据）

报告内容：
- 设备运行状态摘要
- 振动趋势分析与预测
- 故障诊断结果
- 异常事件记录
- 维护建议
- 特征参数统计

API接口：
```bash
# 生成报告
POST /api/report/generate/{sensor_id}?report_type=daily

# 报告列表
GET /api/report/list

# 下载报告
GET /api/report/download/{filename}
```

## 性能优化说明

### Kafka消费优化
- ✅ 配置 `fetch_max_wait_ms=100` 降低延迟
- ✅ 批量消费模式提升吞吐量
- ✅ 线程安全的数据缓冲处理

### GPU显存优化
- ✅ 使用 `tf.function` 构建推理函数，避免重复建图
- ✅ 启用内存增长模式 `set_memory_growth=True`
- ✅ 显式内存释放与垃圾回收
- ✅ 避免 `model.predict()` 在循环中调用

## 使用流程建议

1. **启动模拟器**：在前端点击"开始模拟"生成测试数据
2. **模型训练**：在"模型管理"页面训练LSTM模型
3. **查看实时监控**：在"实时监控"页面查看实时数据和异常报警
4. **故障诊断**：在"故障诊断"页面查看趋势预测和故障分析
5. **生成报告**：在"运维报告"页面生成并下载PDF报告

## 常见问题

### Q: InfluxDB初始化失败？
A: 首次启动InfluxDB后，需要手动创建Organization和Bucket：
- 访问 http://localhost:8086
- 默认用户名：admin，密码：password123
- 创建Organization：`iot-org`
- 创建Bucket：`sensor-data`

### Q: Kafka连接失败？
A: 检查Kafka容器是否正常启动：
```bash
docker-compose ps
docker logs kafka
```

### Q: 趋势预测无数据？
A: 需要先启动数据模拟器，让系统采集至少1小时数据后才能进行预测。

### Q: 报告生成失败？
A: 确保后端服务有写权限，检查 `models/reports` 目录是否存在。

## API完整列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sensors | 获取传感器列表 |
| POST | /api/sensor/data | 发送传感器数据 |
| GET | /api/sensor/{id}/latest | 获取最新数据 |
| GET | /api/sensor/{id}/fft | FFT频谱分析 |
| GET | /api/sensor/{id}/spectrogram | 频谱图 |
| GET | /api/anomalies | 异常事件列表 |
| GET | /api/trend/predict/{id} | 趋势预测 |
| GET | /api/fault/classify/{id} | 故障诊断 |
| POST | /api/report/generate/{id} | 生成PDF报告 |
| GET | /api/report/list | 报告列表 |
| GET | /api/report/download/{filename} | 下载报告 |
