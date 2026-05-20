# 简谱识别播放器

一个基于Electron的简谱图片识别与MIDI播放应用。

## 功能特性

- 📷 **图片识别**: 使用OpenCV从简谱图片中提取音符（数字、下划线、附点）
- 🎹 **MIDI播放**: 通过Web MIDI API播放识别的乐谱
- 🎼 **乐谱显示**: 可视化显示识别的乐谱
- 📄 **多页拼接**: 支持多页谱面图片拼接处理
- 💾 **数据存储**: SQLite数据库存储乐谱和播放记录
- ⚡ **播放控制**: 支持播放、暂停、停止，以及速度调节

## 项目结构

```
p163/
├── src/
│   ├── main/
│   │   ├── main.js          # Electron主进程
│   │   └── preload.js       # 预加载脚本
│   ├── renderer/
│   │   ├── index.html       # 前端页面
│   │   ├── style.css        # 样式文件
│   │   └── renderer.js      # 前端逻辑
│   └── database/
│       └── db.js            # SQLite数据库模块
├── python/
│   ├── main.py              # Python后端入口
│   ├── note_detector.py     # OpenCV音符识别
│   ├── midi_converter.py    # MIDI事件转换
│   └── requirements.txt     # Python依赖
├── data/                    # 数据库文件目录
└── package.json             # Node.js依赖
```

## 安装说明

### 1. 安装Node.js依赖

```bash
# 清理缓存（如果有问题）
npm cache clean --force

# 安装依赖
npm install
```

如果遇到权限问题，可以尝试：
```bash
npm install --cache /tmp/npm-cache
```

### 2. 安装Python依赖

```bash
cd python
pip3 install -r requirements.txt
```

或单独安装：
```bash
pip3 install opencv-python numpy mido
```

### 3. 重建sqlite3（如需要）

```bash
npm run postinstall
```

## 使用说明

### 启动应用

```bash
npm start
```

开发模式（带DevTools）：
```bash
npm run dev
```

### 使用流程

1. **导入图片**: 点击"选择简谱图片"，可选择单张或多张图片
2. **识别音符**: 点击"识别音符"按钮，Python后端将处理图片
3. **播放乐谱**: 
   - 选择MIDI输出设备
   - 调节播放速度（BPM）
   - 点击播放按钮开始播放
4. **查看结果**:
   - 🎼 乐谱显示: 可视化展示音符
   - 📝 音符列表: 详细音符信息
   - 🎹 MIDI事件: MIDI事件详情
5. **保存乐谱**: 输入名称后点击"保存到库"
6. **乐谱库**: 点击"📚 乐谱库"查看和管理已保存的乐谱

## 技术栈

### 前端
- **Electron**: 跨平台桌面应用框架
- **Web MIDI API**: MIDI播放
- **HTML5/CSS3/JavaScript**: 界面与交互

### 后端
- **Python 3**: 核心逻辑
- **OpenCV**: 图像处理与OCR
- **NumPy**: 数值计算
- **Mido**: MIDI文件处理

### 数据库
- **SQLite3**: 本地数据存储

## 音符识别原理

1. **图像预处理**: 灰度化、二值化、降噪
2. **轮廓检测**: 提取数字候选区域
3. **模板匹配**: 识别1-7的简谱数字
4. **装饰符检测**: 
   - 下划线: 表示低八度或短音符
   - 附点: 延长音符时值
5. **MIDI转换**: 将简谱转换为标准MIDI事件

## 简谱到MIDI映射

| 简谱 | 音符 | MIDI音高 (中央C=60) |
|------|------|-------------------|
| 1    | C    | 60                |
| 2    | D    | 62                |
| 3    | E    | 64                |
| 4    | F    | 65                |
| 5    | G    | 67                |
| 6    | A    | 69                |
| 7    | B    | 71                |

## 注意事项

1. **MIDI设备**: 需要系统安装MIDI输出设备（如虚拟MIDI驱动）
2. **图片质量**: 建议使用清晰的简谱图片，分辨率300DPI以上
3. **识别精度**: 目前为基础版本，复杂谱面可能需要手动校正
4. **模板文件**: 可在 `python/templates/` 放置数字模板图片提高识别率

## 故障排除

### Python相关
```bash
# 检查Python版本
python3 --version

# 测试OpenCV安装
python3 -c "import cv2; print(cv2.__version__)"
```

### MIDI相关
- macOS: 使用内置的IAC驱动
- Windows: 安装虚拟MIDI驱动如loopMIDI
- Linux: 使用alsa或jackd

### 数据库相关
数据库文件位于 `data/scores.db`，删除可重置数据库。

## 开发计划

- [ ] 提高OCR识别精度（Tesseract集成）
- [ ] 支持更多简谱符号（升降号、连音线等）
- [ ] 导出MIDI文件功能
- [ ] 乐谱编辑功能
- [ ] 多音色支持
- [ ] 录音功能

## 许可证

ISC
