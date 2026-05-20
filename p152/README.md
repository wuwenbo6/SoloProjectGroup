# 化学方程式配平器 - Electron应用

一个功能完整的化学方程式识别与配平桌面应用，支持OCR识别、摄像头拍摄、图片上传和手写识别。

## 功能特性

### 核心功能
- ✅ **化学方程式配平** - 基于线性代数矩阵求解整数解的算法
- ✅ **OCR识别** - 使用Tesseract.js识别印刷体化学方程式
- ✅ **摄像头捕捉** - 实时拍摄并识别化学方程式
- ✅ **图片上传** - 支持拖拽和点击上传图片
- ✅ **历史记录** - SQLite数据库存储配平历史
- ✅ **步骤展示** - 显示完整的配平过程和矩阵

### 扩展功能
- 🔧 **手写识别框架** - 预留训练和推理接口，可扩展深度学习模型

## 技术栈

### 前端
- **Electron** - 桌面应用框架
- **Tesseract.js** - OCR光学字符识别
- **HTML5/CSS3/JavaScript** - 前端界面

### 后端
- **Python 3** - 配平算法实现
- **线性代数** - 高斯消元法求解整数解
- **SQLite** - 本地数据库存储

## 安装说明

### 前置要求
- Node.js 16+
- Python 3.7+
- npm 或 yarn

### 安装步骤

1. **安装Node.js依赖**
```bash
npm install
```

2. **Python环境**
   - 本项目的配平算法使用Python标准库，无需额外安装包
   - 如需使用手写识别功能，可安装深度学习框架：
   ```bash
   pip install numpy tensorflow torch  # 可选，用于手写识别扩展
   ```

## 使用方法

### 启动应用
```bash
npm start
```

### 开发模式
```bash
npm run dev
```

### 使用说明

1. **手动输入**
   - 在文本框中输入化学方程式，如: `H2 + O2 -> H2O`
   - 点击"配平方程式"按钮

2. **摄像头识别**
   - 切换到"摄像头"标签
   - 点击"开启摄像头"按钮
   - 将化学方程式对准摄像头
   - 点击"拍摄识别"

3. **图片上传**
   - 切换到"图片上传"标签
   - 拖拽图片到上传区域或点击选择
   - 点击"识别方程式"

4. **查看历史**
   - 右侧面板显示所有配平历史记录
   - 点击删除按钮可删除单条记录

## 配平算法原理

### 线性代数方法

化学方程式配平本质上是求解线性方程组的整数解：

1. **构建元素矩阵**
   - 行：化学元素
   - 列：化合物（反应物为正，生成物为负）

2. **高斯消元**
   - 将矩阵转化为行阶梯形式
   - 识别主元列和自由列

3. **整数求解**
   - 对自由变量赋值为1
   - 回代求解其他变量
   - 乘以LCM消除分母
   - 除以GCD得到最简整数解

### 示例：H2 + O2 -> H2O

```
元素矩阵：
  H2  O2  H2O
H  2   0   -2
O  0   2   -1

求解得到系数：[2, 1, 2]
配平结果：2H2 + O2 -> 2H2O
```

## 项目结构

```
chemical-equation-balancer/
├── package.json              # 项目配置
├── src/
│   ├── main.js              # Electron主进程
│   ├── index.html           # 应用界面
│   ├── renderer.js          # 前端逻辑
│   └── styles.css           # 样式文件
├── backend/
│   ├── balancer.py          # 化学配平算法
│   ├── handwriting_recognition.py  # 手写识别框架
│   └── requirements.txt     # Python依赖
└── README.md
```

## 手写识别扩展

本项目预留了手写化学方程式识别的完整框架：

### 接口说明

```python
from backend.handwriting_recognition import (
    HandwritingRecognizer,
    recognize_handwriting,
    train_handwriting_model
)

# 初始化识别器
recognizer = HandwritingRecognizer()

# 训练模型
recognizer.train_model("path/to/training_data", epochs=100)

# 识别手写方程式
result = recognizer.recognize_equation(image_data)
```

### 实现建议

1. **数据集**：使用或创建手写化学符号数据集
2. **模型**：CNN + RNN + CTC Loss 端到端识别
3. **框架**：TensorFlow/PyTorch 实现
4. **预处理**：二值化、去噪、归一化、字符分割

## 支持的方程式格式

### 正确示例
- `H2 + O2 -> H2O`
- `Fe + O2 -> Fe2O3`
- `C2H5OH + O2 -> CO2 + H2O`
- `NaOH + HCl -> NaCl + H2O`

### 支持的分隔符
- `->` 箭头
- `=` 等号
- `→` Unicode箭头

## 常见问题

### Q: OCR识别不准确怎么办？
A: 
- 确保图片清晰，光照充足
- 化学方程式占据图片主要部分
- 使用高对比度背景
- 可以手动编辑识别结果

### Q: 配平失败怎么办？
A:
- 检查方程式格式是否正确
- 确保使用 `->` 分隔反应物和生成物
- 检查化学式书写是否正确
- 某些复杂的氧化还原反应可能需要特殊处理

### Q: 如何备份历史记录？
A: 数据库文件位于用户数据目录，可直接复制备份：
- macOS: `~/Library/Application Support/chemical-equation-balancer/equations.db`
- Windows: `%APPDATA%/chemical-equation-balancer/equations.db`

## 开发计划

- [ ] 支持更复杂的化学方程式（含括号、离子方程式）
- [ ] 实现手写识别深度学习模型
- [ ] 添加化学方程式库
- [ ] 支持反应类型分类
- [ ] 导出配平报告
- [ ] 多语言支持

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
