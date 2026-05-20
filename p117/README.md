# 显微图像分析系统

基于计算机视觉和机器学习技术的显微图像分析平台，支持纤维分割、老化等级判断和破损预测。

## 功能特性

### 🔬 纤维分割
- 基于 OpenCV 和 scikit-image 的图像预处理
- 自适应阈值分割和形态学处理
- 纤维骨架提取和特征分析
- 纤维方向分布统计

### 📊 老化等级判断
- 5级老化分级系统 (Grade 1-5)
- 多特征融合评估：
  - 纤维密度和数量
  - 纹理对比度和均匀性
  - 纤维长度方差
  - 方向熵和断裂指数
- 置信度评估

### ⚠️ 破损预测
- 裂纹密度检测
- 空洞形成识别
- 纤维断裂分析
- 基体降解评估
- 分层剥落风险
- 风险等级可视化

### 📦 批量推理
- 支持同时上传多张图像
- 批量处理和分析
- 独立结果展示

## 技术栈

### 后端
- **FastAPI** - 高性能 Web 框架
- **OpenCV** - 计算机视觉库
- **scikit-image** - 图像处理
- **NumPy** - 数值计算
- **SciPy** - 科学计算

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Recharts** - 数据可视化
- **Vite** - 构建工具

## 项目结构

```
p117/
├── backend/
│   ├── main.py              # FastAPI 主应用
│   ├── image_processing.py  # 纤维分割模块
│   ├── ai_analysis.py       # AI 分析模块
│   ├── requirements.txt     # Python 依赖
│   └── uploads/             # 上传文件目录
├── frontend/
│   ├── src/
│   │   ├── components/      # React 组件
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── BatchAnalysis.tsx
│   │   │   └── AnalysisResults.tsx
│   │   ├── types.ts         # 类型定义
│   │   ├── App.tsx          # 主应用
│   │   ├── main.tsx         # 入口文件
│   │   └── index.css        # 样式文件
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

后端服务将运行在 `http://localhost:8000`

#### API 接口
- `POST /api/upload` - 单张图像上传和分析
- `POST /api/batch` - 批量图像上传和分析
- `POST /api/segment` - 仅纤维分割
- `GET /api/health` - 健康检查
- `GET /docs` - API 文档 (Swagger)

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将运行在 `http://localhost:3000`

## 使用说明

### 单张图像分析
1. 点击"单张分析"标签页
2. 拖拽图像到上传区域，或点击选择文件
3. 系统自动进行分析
4. 查看纤维分割、老化等级和破损预测结果

### 批量图像分析
1. 点击"批量分析"标签页
2. 拖拽多张图像到上传区域，或点击选择多个文件
3. 确认文件列表后点击"开始批量分析"
4. 查看每张图像的独立分析结果

## 分析结果说明

### 纤维分割指标
- **纤维数量**：检测到的纤维总数
- **纤维密度**：纤维区域占总面积百分比
- **平均长度**：纤维骨架平均长度
- **平均宽度**：纤维平均宽度
- **方向分布**：纤维角度分布直方图

### 老化等级
- **Grade 1**：轻微老化（新的或状态良好）
- **Grade 2**：轻度老化（正常使用痕迹）
- **Grade 3**：中度老化（明显老化迹象）
- **Grade 4**：重度老化（老化严重）
- **Grade 5**：严重老化（接近使用寿命终点）

### 破损风险类型
- **表面裂纹**：材料表面微裂纹
- **纤维断裂**：纤维结构断裂
- **分层剥落**：层间分离
- **空洞形成**：内部空洞和孔隙
- **基体降解**：基体材料老化降解

## 开发说明

### 添加新的图像处理算法
在 `image_processing.py` 中扩展 `FiberSegmentation` 类：
```python
def new_segmentation_method(self, image: np.ndarray) -> Dict:
    # 实现新的分割算法
    pass
```

### 添加新的老化特征
在 `ai_analysis.py` 中扩展 `AgingAnalyzer` 类：
```python
def extract_new_feature(self, image: np.ndarray) -> float:
    # 实现新的特征提取
    pass
```

### 添加新的破损类型
在 `ai_analysis.py` 的 `DamagePredictor` 类中添加：
```python
def detect_new_damage(self, image: np.ndarray) -> Dict:
    # 实现新的破损检测
    pass
```

## 许可证

MIT License
