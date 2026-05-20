# Quake Detect - 分布式地震检测系统

基于Android设备传感器的分布式地震检测系统，使用STA/LTA算法检测P波，并通过云端聚合多设备数据评估震级和震中。

## 系统架构

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Android    │      │  Firebase   │      │  Node.js    │
│  设备集群   │─────▶│  Firestore  │─────▶│  后端服务   │
│  (STA/LTA)  │      │             │      │  (聚合分析) │
└─────────────┘      └─────────────┘      └──────┬──────┘
                                                  │
                                                  ▼
                                          ┌─────────────┐
                                          │  前端网页   │
                                          │  (热力图)   │
                                          └─────────────┘
```

## 项目结构

```
p162/
├── android/                    # Android应用
│   ├── app/
│   │   └── src/main/
│   │       ├── java/com/quakedetect/app/
│   │       │   ├── data/          # Room数据库
│   │       │   ├── algorithm/     # STA/LTA + 滤波算法
│   │       │   └── service/       # 传感器监测服务
│   │       └── res/
│   └── build.gradle.kts
├── backend/                    # Node.js后端
│   └── src/
│       ├── server.js              # Express + Socket.io服务器
│       ├── quakeAnalyzer.js       # TDoA地震分析算法
│       └── firebase.js            # Firebase集成
└── frontend/                   # 前端网页
    ├── index.html
    ├── styles.css
    └── app.js                     # Leaflet地图 + 热力图
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

服务将在 `http://localhost:3000` 启动

### 2. 运行算法测试

```bash
cd backend
node test-algorithm.js
```

### 3. 测试系统

发送模拟检测数据（模拟多台设备）：

```bash
# 发送3次检测模拟地震事件
curl -X POST http://localhost:3000/api/test-detection
curl -X POST http://localhost:3000/api/test-detection
curl -X POST http://localhost:3000/api/test-detection
```

### 4. 查看前端

打开浏览器访问 `http://localhost:3000`

## API接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/detections` | 获取最近检测数据 |
| GET | `/api/quake-events` | 获取地震事件列表 |
| GET | `/api/heatmap` | 获取热力图数据 |
| POST | `/api/test-detection` | 发送模拟检测数据 |

## 核心算法

### 信号处理 (Android端)

| 模块 | 文件 | 功能 |
|------|------|------|
| **重力滤波** | [GravityFilter.kt](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/android/app/src/main/java/com/quakedetect/app/algorithm/HighPassFilter.kt#L60-L84) | 一阶互补滤波去除重力分量 |
| **高通滤波** | [HighPassFilter.kt](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/android/app/src/main/java/com/quakedetect/app/algorithm/HighPassFilter.kt#L6-L58) | 二阶Butterworth，1Hz截止，过滤步行等低频噪声 |
| **频谱分析** | [FrequencyAnalyzer.kt](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/android/app/src/main/java/com/quakedetect/app/algorithm/HighPassFilter.kt#L86-L150) | 区分地震波(2-4Hz)和步行(1-2Hz) |
| **STA/LTA检测** | [StaLtaDetector.kt](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/android/app/src/main/java/com/quakedetect/app/algorithm/StaLtaDetector.kt) | 结合频谱特征的P波检测 |

**误报抑制策略**:
- STA窗口: 20点，LTA窗口: 200点
- 触发阈值: STA/LTA > 3.5
- 最小持续: 10个采样点
- 必须同时满足: 地震频段能量 > 40%

### 时间同步与定位 (后端)

| 算法 | 文件 | 功能 |
|------|------|------|
| **时钟偏移校正** | [synchronizeDetections()](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/backend/src/quakeAnalyzer.js#L105-L144) | 5轮迭代估计设备时钟偏差 |
| **TDoA定位** | [tdoaLocate()](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/backend/src/quakeAnalyzer.js#L146-L193) | 波达时间差，P波波速5km/s |
| **混合定位** | [calculateEpicenter()](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/backend/src/quakeAnalyzer.js#L195-L208) | 70% TDoA + 30% 加权中心 |
| **异常值过滤** | [filterOutliers()](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/backend/src/quakeAnalyzer.js#L240-L253) | IQR方法去除离群点 |

**定位精度**:
- 3台以上设备: 使用TDoA + 加权中心混合
- 2台设备: 仅加权中心
- 时间同步误差 < 500ms: excellent

## Android应用配置

1. 在 Firebase 控制台创建项目
2. 下载 `google-services.json` 放入 `android/app/` 目录
3. 在 `backend/.env` 中配置 Firebase 服务账号

## 核心文件参考

- [HighPassFilter.kt](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/android/app/src/main/java/com/quakedetect/app/algorithm/HighPassFilter.kt) - 信号处理滤波器
- [StaLtaDetector.kt](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/android/app/src/main/java/com/quakedetect/app/algorithm/StaLtaDetector.kt) - 改进的STA/LTA算法
- [quakeAnalyzer.js](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/backend/src/quakeAnalyzer.js) - TDoA震级震中评估算法
- [test-algorithm.js](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p162/backend/test-algorithm.js) - 算法测试脚本
