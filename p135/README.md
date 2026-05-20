# 音频指纹识别系统

基于 Landmark 算法的音频指纹提取和匹配服务，使用 Python + FastAPI + PostgreSQL + pgvector 技术栈。

## 功能特性

- 🎵 **音频指纹提取**: 基于频谱图峰值点构建哈希（Landmark 算法）
- 🔍 **快速匹配**: 支持基于哈希和向量相似度的混合匹配
- 🎙️ **录音上传**: 支持网页端麦克风录音和识别（含完整 fallback 机制）
- 📁 **文件上传**: 支持 WAV/MP3/FLAC/OGG/M4A 格式
- 🌊 **实时流式匹配**: WebSocket 实时音频流处理，边录边识别
- 🔇 **噪声鲁棒**: 频谱减法、维纳滤波、带通滤波、中值滤波
- 🗄️ **向量数据库**: 使用 PostgreSQL + pgvector 存储指纹向量
- 📦 **批量索引**: 支持批量扫描目录建立指纹数据库，多线程加速
- ⚡ **查询优化**: 复合索引 + 向量索引，大幅提升查询性能
- 🎨 **歌曲封面**: 支持上传封面图片或设置 URL，识别结果中展示
- 📝 **歌词显示**: 支持为歌曲添加歌词，识别结果中展示

## 最近更新

### Bug 修复

1. **哈希碰撞过高问题**
   - 从 SHA1 改为 SHA256 算法，增加哈希长度
   - 添加哈希 + 频率差的组合特征
   - 增加峰值检测阈值，减少噪声峰值
   - 添加重复哈希去重机制
   - 改进时间偏移对齐和评分算法

2. **数据库查询慢问题**
   - 添加 `idx_fingerprints_hash` 哈希索引
   - 添加 `idx_fingerprints_hash_song` 复合索引（hash + song_id）
   - 添加 `idx_fingerprints_song_id` 歌曲ID索引
   - 添加 `idx_songs_title` 和 `idx_songs_artist` 元数据索引
   - 支持 HNSW 和 IVFFLAT 向量索引用于相似度搜索
   - 使用 joinedload 优化 N+1 查询问题

3. **前端录音权限 Fallback**
   - 完整的浏览器兼容性检测
   - 详细的错误类型分类（权限被拒绝、设备未找到、被占用、安全限制等）
   - 友好的错误提示和用户指导
   - 一键重试机制
   - 快速切换到文件上传模式的 fallback 选项
   - 麦克风支持检测按钮


## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心配置和数据库
│   │   ├── models/        # 数据模型
│   │   ├── schemas/       # Pydantic 模式
│   │   └── services/      # 业务逻辑服务
│   ├── main.py            # FastAPI 主应用
│   ├── batch_index.py     # 批量索引脚本
│   ├── init_db.py         # 数据库初始化脚本
│   └── requirements.txt   # Python 依赖
├── static/
│   └── index.html         # 前端网页
└── audio_samples/         # 音频样本目录
```

## 环境要求

- Python 3.8+
- PostgreSQL 12+
- pgvector 扩展
- FFmpeg (librosa 依赖)

## 安装步骤

### 1. 安装 PostgreSQL 和 pgvector

**macOS:**
```bash
brew install postgresql
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib
# 安装 pgvector (需要从源码编译或使用包管理器)
```

### 2. 创建数据库和扩展

```bash
psql postgres
```

```sql
CREATE DATABASE audio_fingerprint;
\c audio_fingerprint
CREATE EXTENSION vector;
```

### 3. 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
```

### 4. 配置环境变量

编辑 `backend/.env` 文件，修改数据库连接信息：

```env
DATABASE_URL=postgresql://username:password@localhost:5432/audio_fingerprint
```

### 5. 初始化数据库表

```bash
python init_db.py
```

## 运行服务

### 启动后端服务

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问前端界面

打开浏览器访问: http://localhost:8000/static/index.html

### API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 批量建立索引

### 扫描单个目录

```bash
python batch_index.py /path/to/audio/directory
```

### 递归扫描子目录

```bash
python batch_index.py /path/to/audio/directory -r
```

### 查看数据库统计

```bash
python batch_index.py --stats
```

### 仅初始化数据库

```bash
python batch_index.py --init-db
```

## API 接口说明

### 音频识别

```
POST /api/identify
Content-Type: multipart/form-data

参数:
- file: 音频文件
- title: 歌曲标题 (可选)
- artist: 艺术家 (可选)
- album: 专辑 (可选)
- save_to_db: 是否保存到数据库 (默认 false)
```

### 原始音频数组识别

```
POST /api/identify/raw
Content-Type: application/json

{
    "audio_data": [...],
    "sample_rate": 22050
}
```

### 获取所有歌曲

```
GET /api/songs?skip=0&limit=100
```

### 获取单首歌曲

```
GET /api/songs/{song_id}
```

### 删除歌曲

```
DELETE /api/songs/{song_id}
```

### 更新歌曲封面

```
PUT /api/songs/{song_id}/cover
Content-Type: multipart/form-data

参数:
- cover_file: 封面图片文件
```

### 设置封面 URL

```
PUT /api/songs/{song_id}/cover-url
Content-Type: multipart/form-data

参数:
- cover_url: 封面图片 URL
```

### 更新歌曲歌词

```
PUT /api/songs/{song_id}/lyrics
Content-Type: multipart/form-data

参数:
- lyrics: 歌词文本
```

### WebSocket 实时流式匹配

```
WebSocket /api/streaming/ws/match

发送消息格式:
{
    "type": "audio_chunk",
    "audio_data": "base64编码的音频数据",
    "duration": 0.5
}

接收消息格式:
{
    "type": "result",
    "data": {
        "processed": true,
        "buffer_duration": 2.5,
        "stream_time": 10.0,
        "matched": true,
        "match": {
            "song_id": 1,
            "title": "歌曲名",
            "artist": "艺术家",
            "confidence": 0.85,
            ...
        }
    }
}
```

### 使用并发批量索引

```bash
# 使用默认并发数（4线程）
python batch_index.py /path/to/audio/directory -r

# 自定义并发线程数
python batch_index.py /path/to/audio/directory -r --workers 8

# 禁用并发处理
python batch_index.py /path/to/audio/directory -r --no-concurrent
```

## 算法原理

### Landmark 指纹算法

1. **频谱图计算**: 使用 STFT 或 Mel 频谱图将音频转换为频域表示
2. **峰值检测**: 在频谱图中寻找局部最大值作为特征点
3. **哈希生成**: 将峰值点两两配对，基于频率和时间差生成哈希值
4. **时间偏移对齐**: 通过比较哈希出现的时间偏移进行精确匹配

### 噪声鲁棒处理

- **频谱减法**: 估计噪声频谱并从信号中减去
- **维纳滤波**: 基于信噪比的自适应滤波
- **带通滤波**: 保留人耳敏感的频率范围 (300Hz-3kHz)
- **中值滤波**: 去除脉冲噪声

### 匹配策略

1. **精确哈希匹配**: 相同的哈希值直接匹配，速度最快
2. **向量相似度匹配**: 使用 pgvector 余弦相似度搜索
3. **混合匹配**: 结合两者优势提高准确率

## 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| SAMPLE_RATE | 22050 | 音频采样率 (Hz) |
| N_FFT | 2048 | FFT 窗口大小 |
| HOP_LENGTH | 512 | 帧移大小 |
| N_MELS | 128 | Mel 滤波器数量 |
| PEAK_NEIGHBORHOOD_SIZE | 20 | 峰值检测邻域大小 |
| TARGET_FAN_VALUE | 15 | 每个峰值配对数量 |
| FINGERPRINT_REDUCTION | 20 | SHA1 哈希截取长度 |
| TOP_N_MATCHES | 5 | 返回匹配结果数量 |
| SCORE_THRESHOLD | 0.5 | 匹配置信度阈值 |

## 性能优化建议

1. **数据库索引**: 在指纹哈希列上建立 B-tree 索引
2. **向量索引**: 为 pgvector 建立 HNSW 或 IVFFlat 索引
3. **批量处理**: 使用批量插入提高索引速度
4. **缓存机制**: 缓存常用查询结果
5. **硬件加速**: 使用 GPU 加速频谱图计算

## 常见问题

### 1. libsndfile 相关错误

安装系统依赖：
```bash
# macOS
brew install libsndfile

# Ubuntu
sudo apt install libsndfile1
```

### 2. FFmpeg 相关错误

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

### 3. pgvector 安装失败

参考官方文档: https://github.com/pgvector/pgvector

### 4. 麦克风权限问题

在浏览器设置中允许访问麦克风，使用 HTTPS 或 localhost。

## 许可证

MIT License
