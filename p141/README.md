# 室内定位系统

基于Wi-Fi CSI和IMU数据融合的室内定位系统，使用卡尔曼滤波进行位置估计，神经网络进行指纹库定位。

## 项目结构

```
.
├── app/
│   ├── __init__.py          # Flask应用初始化
│   ├── routes.py            # 基础路由
│   ├── api/
│   │   ├── __init__.py
│   │   ├── devices.py       # 设备管理API
│   │   ├── data.py          # CSI和IMU数据接收API
│   │   └── tracking.py      # 轨迹跟踪API
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # 数据库模型
│   └── utils/
│       ├── __init__.py
│       ├── kalman_filter.py # 卡尔曼滤波实现
│       ├── fingerprint.py   # 指纹库定位
│       └── positioning.py   # 位置处理整合
├── templates/
│   └── index.html           # Leaflet前端地图页面
├── models/                   # 训练好的模型存储
├── data/                     # 指纹库数据存储
├── config.py                 # 配置文件
├── run.py                    # 应用启动脚本
├── train_fingerprint.py      # 指纹库训练脚本
└── requirements.txt          # Python依赖
```

## 功能特性

### 1. 后端服务 (Flask)
- 设备注册和管理API
- Wi-Fi CSI振幅相位数据接收
- 手机IMU数据接收
- 实时位置推送 (Socket.IO)

### 2. 定位算法
- **卡尔曼滤波融合**: 融合CSI和IMU数据，平滑位置估计
- **神经网络指纹库**: 离线训练CSI指纹，实时匹配定位
- **RSSI距离估计**: 基于信号强度的初步位置估计

### 3. 前端展示 (Leaflet)
- 实时设备位置显示
- 历史轨迹回放
- 多设备支持
- 详细位置信息面板

### 4. 数据存储
- SQLite数据库存储历史轨迹
- CSI和IMU原始数据记录
- 设备信息管理

## 安装与运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 训练指纹模型 (可选)

```bash
python train_fingerprint.py --samples 1000 --epochs 50
```

参数说明：
- `--samples`: 合成样本数量
- `--epochs`: 训练轮数
- `--grid-size`: 网格大小(米)

### 3. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

## API接口文档

### 设备管理

#### 注册设备
```
POST /api/devices/register
Content-Type: application/json

{
    "device_id": "esp32_001",
    "device_type": "esp32",
    "name": "ESP32设备1",
    "description": "一楼大厅采集节点"
}
```

#### 获取设备列表
```
GET /api/devices/
```

#### 获取单个设备信息
```
GET /api/devices/{device_id}
```

#### 设备心跳
```
POST /api/devices/{device_id}/heartbeat
```

### 数据采集

#### 上传CSI数据
```
POST /api/data/csi
Content-Type: application/json

{
    "device_id": "esp32_001",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "rssi": -45.5,
    "amplitude": [1.2, 1.5, 1.3, ...],
    "phase": [0.1, 0.5, -0.3, ...],
    "num_subcarriers": 64,
    "channel": 6
}
```

#### 上传IMU数据
```
POST /api/data/imu
Content-Type: application/json

{
    "device_id": "phone_001",
    "accel_x": 0.01,
    "accel_y": 0.02,
    "accel_z": 9.81,
    "gyro_x": 0.1,
    "gyro_y": 0.0,
    "gyro_z": 0.05,
    "mag_x": 12.5,
    "mag_y": 30.2,
    "mag_z": 45.8,
    "orientation_x": 0.0,
    "orientation_y": 0.0,
    "orientation_z": 90.0
}
```

### 位置跟踪

#### 获取当前位置
```
GET /api/tracking/position/{device_id}
```

#### 设置/重置位置
```
POST /api/tracking/position/{device_id}
Content-Type: application/json

{
    "x": 5.0,
    "y": 10.0
}
```

#### 获取历史轨迹
```
GET /api/tracking/trajectory/{device_id}?limit=1000&start_time=2024-01-01T00:00:00
```

#### 清除轨迹
```
DELETE /api/tracking/trajectory/{device_id}
```

#### 获取活跃设备
```
GET /api/tracking/devices?timeout=300
```

## ESP32设备接入示例

```python
import urequests
import network
import time

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect('SSID', 'password')

while not wlan.isconnected():
    time.sleep(1)

device_id = 'esp32_001'

# 注册设备
urequests.post('http://server:5000/api/devices/register', json={
    'device_id': device_id,
    'device_type': 'esp32',
    'name': 'ESP32采集节点'
})

# 采集并上传CSI数据
while True:
    # 采集CSI数据...
    csi_data = {
        'device_id': device_id,
        'rssi': -45.5,
        'amplitude': [1.2, 1.5, ...],
        'phase': [0.1, 0.5, ...],
        'num_subcarriers': 64
    }
    
    try:
        urequests.post('http://server:5000/api/data/csi', json=csi_data)
    except:
        pass
    
    time.sleep(0.1)
```

## 手机IMU数据采集

可以使用以下方式采集手机IMU数据：
1. 开发专用Android/iOS应用
2. 使用Sensor Logger类APP导出数据
3. 通过WebSocket实时传输

## 配置说明

在 `config.py` 中可以配置：

- 地图中心坐标和缩放级别
- 卡尔曼滤波参数
- 指纹库路径
- 数据库连接

## 技术栈

- **后端**: Flask, Flask-SocketIO, Flask-SQLAlchemy
- **数据库**: SQLite
- **算法**: NumPy, SciPy, Scikit-learn, TensorFlow
- **前端**: Leaflet, Socket.IO-client

## 注意事项

1. 首次运行前建议先训练指纹模型
2. 确保设备时间同步，避免时间戳错误
3. 生产环境建议使用更强大的数据库(PostgreSQL)
4. 考虑添加数据验证和错误处理
5. 生产环境应配置适当的认证机制

## License

MIT License
