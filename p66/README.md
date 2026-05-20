# musicscore - 传统乐谱识别工具

一个用 Go 语言开发的跨平台命令行工具，用于识别传统乐谱（工尺谱、减字谱）图像并转换为 MIDI 和 MusicXML 格式。

## 功能特性

- **图像处理**
  - 自动降噪
  - 灰度转换
  - 二值化处理
  - 符号分割（连通区域检测）

- **乐谱识别**
  - 支持工尺谱识别
  - 支持减字谱识别
  - 基于符号特征的分类

- **导出格式**
  - MIDI (.mid)
  - MusicXML (.xml)

- **历史记录**
  - SQLite 数据库存储
  - 识别历史查询
  - 记录状态跟踪

## 项目结构

```
musicscore/
├── cmd/musicscore/
│   └── main.go           # 命令行入口
├── internal/
│   ├── image/
│   │   └── processor.go  # 图像处理模块
│   ├── recognition/
│   │   └── recognizer.go # 乐谱识别模块
│   ├── export/
│   │   └── exporter.go   # 格式导出模块
│   └── storage/
│       └── sqlite.go     # 数据存储模块
├── pkg/models/
│   └── models.go         # 数据模型定义
├── go.mod                # Go 模块定义
└── README.md
```

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd musicscore

# 安装依赖
go mod download

# 编译
go build -o musicscore ./cmd/musicscore
```

## 使用方法

### 识别乐谱

```bash
# 基本用法
./musicscore recognize -i score.png

# 或使用短命令
./musicscore r -i score.jpg

# 指定乐谱类型（工尺谱）
./musicscore recognize -i score.png -t gongche -v

# 指定乐谱类型（减字谱）
./musicscore recognize -i score.png -t jianzi -v

# 指定输出目录
./musicscore recognize -i score.png -o ./output

# 调整图像处理参数
./musicscore recognize -i score.png --denoise 5 --threshold 150 -v
```

### 查看历史记录

```bash
./musicscore history

# 或使用短命令
./musicscore h
```

### 删除历史记录

```bash
./musicscore delete <id>

# 或使用短命令
./musicscore d <id>
```

### 查看版本

```bash
./musicscore version
./musicscore v
```

### 查看帮助

```bash
./musicscore help
```

## 命令行选项

### recognize 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input <path>` | 输入图像文件 | 必填 |
| `-o, --output <dir>` | 输出目录 | 与输入文件同目录 |
| `-t, --type <type>` | 乐谱类型: gongche/g, jianzi/j | gongche |
| `--db <path>` | 数据库路径 | ~/.musicscore/history.db |
| `--denoise <level>` | 降噪级别 | 3 |
| `--threshold <value>` | 二值化阈值 | 127 |
| `-v, --verbose` | 启用详细输出 | false |

### 支持的图像格式

- PNG
- JPEG

## 数据模型

### 工尺谱符号

- 合、四、一、上、尺、工、凡、六、五、乙

### 减字谱徽位

- 一徽至十三徽

## 技术栈

- **语言**: Go 1.21+
- **数据库**: SQLite
- **图像处理**: Go 标准库 image 包
- **数据格式**: MIDI, MusicXML

## 依赖库

- github.com/mattn/go-sqlite3 - SQLite 驱动
- (可选) github.com/spf13/cobra - 命令行框架

## 输出文件

处理完成后，将在输出目录生成以下文件：

1. `{title}.mid` - MIDI 音频文件
2. `{title}.xml` - MusicXML 乐谱文件
3. `{input}_processed.png` - 处理后的二值图像

## 数据库结构

### recognition_history 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| input_path | TEXT | 输入文件路径 |
| score_type | TEXT | 乐谱类型 |
| output_midi | TEXT | MIDI 输出路径 |
| output_xml | TEXT | MusicXML 输出路径 |
| created_at | DATETIME | 创建时间 |
| completed_at | DATETIME | 完成时间 |
| status | TEXT | 状态: processing/completed/failed |
| error | TEXT | 错误信息 |

## 开发说明

### 添加新的乐谱类型

1. 在 `pkg/models/models.go` 中添加新的 ScoreType
2. 在 `internal/recognition/recognizer.go` 中实现识别逻辑
3. 更新命令行帮助文档

### 改进图像处理

编辑 `internal/image/processor.go` 中的相关函数：

- `denoise()` - 降噪算法
- `threshold()` - 二值化算法
- `segmentSymbols()` - 符号分割

## 许可证

MIT License
