# 量子电路模拟器

一个支持最多30个量子比特的量子电路模拟器，采用C++核心计算模块编译为WebAssembly，React前端使用Plotly绘制概率幅柱状图，Python FastAPI后端提供电路保存/加载API，MongoDB存储。

## 技术栈

- **核心计算**: C++17
- **WebAssembly**: Emscripten
- **前端**: React + Vite + Plotly.js
- **后端**: Python FastAPI
- **数据库**: MongoDB

## 项目结构

```
p23/
├── cpp/                    # C++核心模块
│   ├── src/
│   │   ├── quantum_state.h    # 量子态向量类头文件
│   │   ├── quantum_state.cpp  # 量子态向量类实现
│   │   └── bindings.cpp       # Emscripten绑定
│   ├── CMakeLists.txt         # CMake构建配置
│   └── build.sh               # 构建脚本
├── frontend/               # React前端
│   ├── src/
│   │   ├── App.jsx            # 主应用组件
│   │   └── App.css            # 样式文件
│   ├── vite.config.js         # Vite配置
│   └── package.json
└── backend/                # Python后端
    ├── main.py                # FastAPI应用
    └── requirements.txt       # Python依赖
```

## 功能特性

- ✅ 支持1-30个量子比特
- ✅ 量子门操作: Hadamard (H), Pauli-X (X), Pauli-Y (Y), Pauli-Z (Z), CNOT
- ✅ 量子测量: 单比特测量和全态测量
- ✅ 实时显示量子态向量
- ✅ Plotly.js绘制概率幅分布柱状图
- ✅ 量子电路可视化
- ✅ 电路保存、加载、删除功能
- ✅ MongoDB持久化存储

## 构建与运行

### 前置要求

- CMake 3.15+
- Emscripten SDK
- Node.js 18+
- Python 3.8+
- MongoDB

### 1. 构建C++ WASM模块

```bash
cd cpp
chmod +x build.sh
./build.sh
```

构建完成后，将生成的文件复制到前端public目录:

```bash
cp build/quantum_simulator.js ../frontend/public/
cp build/quantum_simulator.wasm ../frontend/public/
```

### 2. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端服务将在 `http://localhost:8000` 启动

API文档: `http://localhost:8000/docs`

### 3. 启动前端开发服务器

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:3000` 启动

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | API信息 |
| POST | `/api/circuits` | 创建新电路 |
| GET | `/api/circuits` | 获取所有电路 |
| GET | `/api/circuits/{id}` | 获取指定电路 |
| PUT | `/api/circuits/{id}` | 更新电路 |
| DELETE | `/api/circuits/{id}` | 删除电路 |

## 使用说明

1. 选择量子比特数量 (1-10)
2. 选择目标量子比特并应用相应的量子门
3. 观察量子电路可视化和概率幅分布图表
4. 点击"测量所有量子比特"进行量子测量
5. 保存自定义电路以便后续使用
6. 从已保存电路列表加载电路

## C++核心模块说明

### QuantumState类

```cpp
class QuantumState {
public:
    explicit QuantumState(int num_qubits);
    
    void apply_hadamard(int qubit);
    void apply_x(int qubit);
    void apply_y(int qubit);
    void apply_z(int qubit);
    void apply_cnot(int control, int target);
    
    std::vector<int> measure_all();
    int measure(int qubit);
    
    std::vector<std::complex<double>> get_statevector() const;
    std::vector<double> get_probabilities() const;
    
    void reset();
};
```

## 性能优化

- 使用位运算优化量子门应用
- 支持多达30个量子比特 (2^30状态向量)
- WebAssembly近原生性能
- 内存增长优化

## 许可证

MIT License
