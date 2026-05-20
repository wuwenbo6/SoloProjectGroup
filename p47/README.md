# 全栈物联网害虫声纹监测系统

基于声纹识别、多声源分离和自适应阈值的分布式害虫监测系统。

## 功能特性

### 核心检测功能
- 🎵 **声纹识别**: 使用CNN和梅尔频谱特征识别害虫种类
- 🔀 **多声源分离**: 基于独立成分分析(ICA)分离同时发声的多个声源
- 📍 **多声源定位**: 分别定位每个分离后的声源，解决传统TDOA定位到中心点的问题

### 自适应阈值功能
- 🌬️ **噪声类型识别**: 自动识别风噪声、农机声、交通噪声等干扰
- 📊 **环境噪声学习**: 自动分析环境底噪特征，动态调整检测阈值
- 🎚️ **敏感度可调**: 支持0-1范围的敏感度参数，灵活控制检测严格度
- 🛡️ **误报防护**: 自动过滤低信噪比信号，减少误报率

### 其他功能
- 🗺️ **热力图展示**: Leaflet地图可视化害虫分布
- 🔊 **音频回放**: 点击标记播放原始检测音频
- 📡 **分布式节点**: 模拟多个麦克风阵列节点
- 🔢 **声源数量估计**: 基于协方差矩阵特征值分析自动估计声源数量

## 项目结构

```
p47/
├── acoustic/           # 声纹识别模块
│   ├── feature_extractor.py    # 梅尔频谱特征提取
│   └── pest_classifier.py      # CNN害虫分类器
├── localization/       # 定位模块
│   └── tdoa.py                # TDOA定位算法
├── node_sim/           # 节点模拟器
│   ├── audio_generator.py      # 害虫声音生成器
│   └── simulate.py             # 节点模拟与数据上传
├── api/                # Django后端API
│   ├── pest_monitor/           # Django项目配置
│   ├── api_app/                # API应用
│   └── manage.py
├── frontend/           # 前端
│   ├── index.html              # Leaflet地图页面
│   └── app.js                  # 前端逻辑
└── media/              # 媒体文件存储
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
cd api
python manage.py migrate
python ../init_db.py
```

### 3. 启动后端服务

```bash
cd api
python manage.py runserver 0.0.0.0:8000
```

### 4. 打开前端页面

在浏览器中打开 `frontend/index.html`

### 5. 模拟测试数据

生成模拟的害虫检测事件：

```bash
python -m node_sim.simulate quick_test
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/nodes/` | GET | 获取所有节点 |
| `/api/nodes/register/` | POST | 注册节点 |
| `/api/detections/` | GET | 获取所有检测记录 |
| `/api/detections/upload/` | POST | 上传音频检测 |
| `/api/locations/` | GET | 获取定位结果 |
| `/api/heatmap/` | GET | 获取热力图数据 |
| `/api/stats/` | GET | 获取统计信息 |

## 支持的害虫类型

- 蝗虫 (locust)
- 棉铃虫 (cotton_bollworm)
- 蚜虫 (aphid)
- 粉虱 (whitefly)

## 技术栈

**后端**:
- Django + Django REST Framework
- Librosa (音频特征提取)
- TensorFlow/Keras (CNN分类)
- SciPy (TDOA优化, ICA信号处理)
- Scikit-learn (聚类和降维)
- GCC-PHAT (广义互相关时延估计)

**前端**:
- Leaflet.js (地图)
- Leaflet.heat (热力图)
- 原生JavaScript

## 自适应阈值工作原理

### 核心问题

传统固定阈值在不同环境下表现不稳定：
- 低噪声环境下过于严格，漏检率高
- 高噪声环境下过于宽松，误报率高

### 自适应检测流程

1. **环境噪声学习阶段**
   - 系统自动收集环境噪声样本
   - 提取RMS能量、频谱质心、过零率等特征
   - 建立噪声剖面基线

2. **动态阈值计算**
   - 根据噪声统计特性计算RMS检测阈值
   - 信噪比阈值随噪声水平动态调整
   - 置信度乘数根据噪声强度自适应调整

3. **噪声类型过滤**
   - 识别风噪声：低频宽带噪声，幅度缓慢波动
   - 识别农机声：周期性振动，特定频率范围
   - 识别交通噪声：脉冲式，频率随时间变化

4. **检测流程图**

```
音频输入 → 特征提取 → 噪声类型判断 → 是干扰？→ 过滤拒绝
                        ↓ 否
                    自适应阈值 → 信噪比估算 → 置信度调整 → 害虫检测结果
```

## 测试命令

运行多声源定位测试：
```bash
python3 test_multisource.py
```

运行自适应阈值功能测试：
```bash
python3 test_adaptive_threshold.py
```
