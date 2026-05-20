# 6-DOF 机械臂控制器 (Electron + React + Python + ROS2)

一个桌面应用程序，用于控制6自由度机械臂在3D场景中移动。使用RRT*算法进行路径规划，并考虑障碍物避障。

## 功能特性

### 前端 (Electron + React + Three.js)
- 🎮 **3D可视化**：使用Three.js和React Three Fiber实现机械臂的3D渲染
- 🎯 **拖拽目标点**：鼠标拖拽绿色球体设置目标位置
- 📐 **关节控制**：滑块控制每个关节角度
- 🛤️ **路径可视化**：显示规划的路径点和连线
- 🚧 **障碍物管理**：添加/删除立方体障碍物
- 📊 **实时状态显示**：显示末端执行器位置、关节角度

### 运动学
- ✅ **正运动学(FK)**：计算末端执行器位置
- ✅ **逆运动学(IK)**：基于雅可比矩阵的迭代求解
- ✅ **DH参数模型**：标准Denavit-Hartenberg参数

### 路径规划
- 🌟 **RRT*算法**：渐进最优路径规划
- 🧱 **障碍物避障**：AABB碰撞检测
- 🎨 **路径平滑**：后处理平滑优化

### 后端 (Python + FastAPI + ROS2)
- 🔌 **RESTful API**：FastAPI提供的完整API接口
- 🤖 **ROS2兼容**：可扩展到真实ROS2系统
- 📦 **URDF模型**：标准机械臂URDF描述文件

## 项目结构

```
p133/
├── electron/                # Electron主进程
│   └── main.js
├── src/                     # React前端
│   ├── components/          # React组件
│   │   ├── RobotArm.js      # 机械臂3D组件
│   │   └── Scene3D.js       # 3D场景组件
│   ├── utils/               # 工具函数
│   │   ├── kinematics.js    # 运动学求解
│   │   └── rrtStar.js       # RRT*路径规划
│   ├── App.js               # 主应用组件
│   ├── index.js             # 入口文件
│   └── index.css            # 样式文件
├── backend/                 # Python后端
│   ├── server.py            # FastAPI服务器
│   └── requirements.txt     # Python依赖
├── urdf/                    # 机械臂模型
│   └── robot_arm.urdf       # URDF文件
├── public/                  # 公共资源
│   └── index.html
├── package.json             # Node.js依赖
└── README.md                # 本文件
```

## 安装和运行

### 前置要求
- Node.js 18+
- Python 3.8+
- npm 或 yarn

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3. 运行方式

#### 方式一：仅运行前端开发服务器（使用内置算法）

```bash
npm start
```

访问 http://localhost:3000

#### 方式二：仅运行后端API服务器

```bash
cd backend
python server.py
```

API文档: http://localhost:8000/docs

#### 方式三：Electron桌面应用（开发模式）

```bash
npm run electron-dev
```

#### 方式四：同时运行前端和后端

```bash
npm run start-all
```

## 使用说明

### 基础操作
1. **控制关节**：在左侧面板拖动滑块调整每个关节角度
2. **设置目标**：在3D视图中拖动绿色球体设置目标位置
3. **规划路径**：点击"🔍 规划路径"按钮使用RRT*算法规划避障路径
4. **执行运动**：点击"▶️ 执行"让机械臂沿路径移动
5. **重置位置**：点击"🔄 重置位置"使机械臂回到初始姿态

### 3D视图操作
- **旋转**：鼠标右键拖动
- **缩放**：滚轮
- **平移**：鼠标中键拖动

### 障碍物管理
- 点击"添加障碍物"按钮生成随机障碍物
- 在障碍物列表中点击"×"删除障碍物
- 红色半透明立方体表示障碍物位置

## API接口说明

### 状态检查
```
GET /api/status
```

### 正运动学
```
POST /api/forward_kinematics
Content-Type: application/json
{"angles": [0, 0, 0, 0, 0, 0]}
```

### 逆运动学
```
POST /api/inverse_kinematics
Content-Type: application/json
{"target_position": [0.3, 0.4, 0.3]}
```

### 路径规划
```
POST /api/plan_path
Content-Type: application/json
{
  "start_angles": [0, 0, 0, 0, 0, 0],
  "target_position": [0.3, 0.4, 0.3],
  "obstacles": [{"position": [0.2, 0.3, 0], "size": [0.2, 0.3, 0.2]}]
}
```

### 关节限位
```
GET /api/joint_limits
```

## 技术栈

### 前端
- **React 18**：UI框架
- **Three.js**：3D渲染引擎
- **React Three Fiber**：React的Three.js绑定
- **Electron**：桌面应用框架
- **Axios**：HTTP客户端

### 后端
- **Python 3**：编程语言
- **FastAPI**：Web框架
- **NumPy**：数值计算
- **UVicorn**：ASGI服务器

## 机械臂DH参数

| 关节 i | θ (rad) | d (m) | a (m) | α (rad) | 限位 (rad) |
|-------|---------|-------|-------|---------|-----------|
| 1     | 0       | 0.15  | 0     | π/2     | (-π, π)   |
| 2     | 0       | 0     | 0.20  | 0       | (-π/2, π/2)|
| 3     | 0       | 0     | 0.15  | 0       | (-π/2, π/2)|
| 4     | 0       | 0     | 0     | π/2     | (-π, π)   |
| 5     | 0       | 0.10  | 0     | -π/2    | (-π/2, π/2)|
| 6     | 0       | 0.08  | 0     | 0       | (-π, π)   |

## 扩展到ROS2

如果需要连接真实的ROS2系统：

1. 安装ROS2 Humble/Hawksbill
2. 修改 `backend/server.py` 添加ROS2节点
3. 使用 `sensor_msgs/JointState` 发布关节状态
4. 使用 `moveit_msgs` 进行运动规划

## 已知问题

- RRT*算法性能随迭代次数增加而下降
- 逆运动学求解可能陷入局部最优
- 3D渲染在低端设备上可能卡顿

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
