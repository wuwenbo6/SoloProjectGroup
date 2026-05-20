# 唱机音频处理系统 (Vinyl Processor)

一个完整的黑胶唱片/唱机音频采集、处理和管理系统，支持音频采集、杂音去除、转速校正、音频分段、文件导出和曲目库管理。

## 功能特性

### 1. 音频采集 (AudioCapture)
- 实时音频录音支持
- 多音频设备选择
- 音频文件加载（WAV、MP3、FLAC等）
- 波形可视化
- 临时文件保存

### 2. 杂音去除 (NoiseReducer)
- 电源哼声去除（50/60Hz 谐波滤除）
- 爆音/点击声去除
- 基于频谱的降噪处理
- 带通滤波
- 音频平滑处理
- 自动降噪流程
- 噪声样本估计
- 频谱对比可视化

### 3. 转速校正 (SpeedCorrector)
- 基频检测与转速偏差估计
- 自动转速校正
- 基于节拍的速度校正
- 抖晃检测与校正
- 转速分析可视化
- 校正报告生成

### 4. 音频分段 (AudioSegmenter)
- 静音检测分段
- 能量变化检测
- 频谱变化检测
- 组合检测算法
- 手动分段支持
- 短段合并
- 分段信息获取
- 分段结果可视化

### 5. 文件导出 (FileExporter)
- 多格式支持（WAV、FLAC、AIFF、OGG）
- 批量导出音轨
- 元数据导出（JSON/CSV）
- 音频归一化
- 淡入淡出处理
- 限制器处理
- M3U播放列表生成
- 处理报告导出

### 6. 曲目库管理 (LibraryManager)
- 专辑信息管理
- 曲目信息管理
- SQLite数据库存储
- 搜索功能
- 处理历史记录
- 统计信息生成
- 曲库导入/导出（JSON格式）

## 安装依赖

```bash
pip install -r requirements.txt
```

依赖包列表：
- numpy >= 1.21.0
- scipy >= 1.7.0
- librosa >= 0.9.0
- soundfile >= 0.10.0
- sounddevice >= 0.4.0
- noisereduce >= 2.0.0
- pydub >= 0.25.0
- matplotlib >= 3.4.0
- sqlalchemy >= 1.4.0
- ffmpeg-python >= 0.2.0

## 使用方法

### 命令行使用

```bash
# 显示曲库统计
python main.py --stats

# 录音模式
python main.py --record --album "My Album" --artist "Artist Name"

# 处理已有音频文件
python main.py -i input.wav -o ./output --album "My Album" --artist "Artist Name"
```

### Python API 使用示例

```python
from vinyl_processor import AudioCapture, NoiseReducer, SpeedCorrector
from vinyl_processor import AudioSegmenter, FileExporter, LibraryManager

SAMPLE_RATE = 44100

# 1. 音频采集
capture = AudioCapture(SAMPLE_RATE)
audio, sr = capture.load_audio_file('input.wav')

# 2. 杂音去除
reducer = NoiseReducer(SAMPLE_RATE)
clean_audio = reducer.auto_clean(audio)

# 3. 转速校正
corrector = SpeedCorrector(SAMPLE_RATE)
corrected_audio, speed_ratio = corrector.auto_correct(clean_audio)

# 4. 音频分段
segmenter = AudioSegmenter(SAMPLE_RATE)
segments = segmenter.auto_segment(corrected_audio, method='combined')

# 5. 文件导出
exporter = FileExporter(SAMPLE_RATE)
exported_files = exporter.export_batch(segments, './output', 'my_track')
exporter.create_m3u_playlist(exported_files, './output/playlist.m3u')

# 6. 曲库管理
library = LibraryManager()
album_id = library.add_album(title="My Album", artist="Artist Name")

for i, file_path in enumerate(exported_files):
    library.add_track(
        album_id=album_id,
        title=f"Track {i+1}",
        file_path=file_path,
        track_number=i+1
    )

# 获取统计信息
stats = library.get_statistics()
print(f"专辑数量: {stats['album_count']}")
print(f"曲目数量: {stats['track_count']}")
```

## 模块详细说明

### AudioCapture 音频采集模块

主要方法：
- `list_devices()` - 列出可用音频设备
- `start_recording(device_id)` - 开始录音
- `stop_recording()` - 停止录音
- `load_audio_file(file_path)` - 加载音频文件
- `save_temp_recording(audio, file_path)` - 保存临时录音
- `plot_waveform(audio, output_path)` - 绘制波形图

### NoiseReducer 杂音去除模块

主要方法：
- `reduce_noise(audio, noise_sample, stationary, prop_decrease)` - 频谱降噪
- `remove_clicks(audio, threshold, window_size)` - 去除爆音
- `remove_hum(audio, hum_freq, Q)` - 去除电源哼声
- `bandpass_filter(audio, low_freq, high_freq, order)` - 带通滤波
- `auto_clean(audio, noise_sample)` - 自动降噪处理
- `estimate_noise_from_silence(audio, silence_threshold)` - 从静音段估计噪声
- `plot_spectrum_comparison(original, cleaned, output_path)` - 绘制频谱对比

### SpeedCorrector 转速校正模块

主要方法：
- `detect_speed_deviation(audio, reference_freq)` - 检测转速偏差
- `correct_speed(audio, speed_ratio)` - 应用转速校正
- `auto_correct(audio, reference_freq)` - 自动转速校正
- `correct_by_tempo(audio, target_bpm)` - 基于节拍速度校正
- `detect_wow_flutter(audio, window_size)` - 抖晃检测
- `correct_wow_flutter(audio, window_size)` - 抖晃校正
- `plot_speed_analysis(audio, output_path)` - 绘制转速分析图

### AudioSegmenter 音频分段模块

主要方法：
- `detect_silence(audio, threshold, min_silence_duration)` - 检测静音
- `split_by_silence(audio, threshold, min_silence_duration, min_segment_duration)` - 按静音分段
- `detect_track_boundaries(audio, method, **kwargs)` - 检测曲目边界
- `split_audio(audio, boundaries, min_duration)` - 分割音频
- `auto_segment(audio, method, min_duration)` - 自动分段
- `manual_segment(audio, split_points)` - 手动分段
- `merge_short_segments(segments, min_duration, max_gap)` - 合并短段

### FileExporter 文件导出模块

主要方法：
- `export_audio(audio, file_path, format, bit_depth)` - 导出单音频
- `export_batch(segments, output_dir, base_name, format, bit_depth)` - 批量导出
- `export_metadata(segments, file_path, format, additional_info)` - 导出元数据
- `normalize_audio(audio, target_peak)` - 音频归一化
- `apply_fade(audio, fade_in, fade_out)` - 淡入淡出
- `apply_limiter(audio, threshold, release_time)` - 限制器
- `create_m3u_playlist(audio_files, playlist_path, base_path)` - 创建播放列表

### LibraryManager 曲库管理模块

主要方法：
- `add_album(title, artist, year, genre, cover_image, notes)` - 添加专辑
- `get_album(album_id)` - 获取专辑信息
- `update_album(album_id, **kwargs)` - 更新专辑信息
- `delete_album(album_id, delete_files)` - 删除专辑
- `list_albums(limit)` - 列出专辑
- `add_track(album_id, title, file_path, ...)` - 添加曲目
- `get_track(track_id)` - 获取曲目信息
- `update_track(track_id, **kwargs)` - 更新曲目信息
- `delete_track(track_id, delete_file)` - 删除曲目
- `get_album_tracks(album_id)` - 获取专辑所有曲目
- `search_tracks(query)` - 搜索曲目
- `get_statistics()` - 获取统计信息
- `export_library(file_path)` - 导出曲库
- `import_library(file_path, merge)` - 导入曲库

## 数据库结构

曲库管理使用 SQLite 数据库，包含以下表：

### albums 专辑表
- id (INTEGER, PRIMARY KEY)
- title (TEXT, NOT NULL)
- artist (TEXT)
- year (INTEGER)
- genre (TEXT)
- cover_image (TEXT)
- notes (TEXT)
- created_at (TEXT)
- updated_at (TEXT)

### tracks 曲目表
- id (INTEGER, PRIMARY KEY)
- album_id (INTEGER, FOREIGN KEY)
- title (TEXT, NOT NULL)
- track_number (INTEGER)
- duration (REAL)
- file_path (TEXT)
- file_format (TEXT)
- bit_depth (INTEGER)
- sample_rate (INTEGER)
- peak_level (REAL)
- rms_level (REAL)
- date_recorded (TEXT)
- notes (TEXT)
- created_at (TEXT)
- updated_at (TEXT)

### processing_history 处理历史表
- id (INTEGER, PRIMARY KEY)
- track_id (INTEGER, FOREIGN KEY)
- process_type (TEXT)
- parameters (TEXT, JSON)
- timestamp (TEXT)

数据库默认位置：`~/.vinyl_processor/library.db`

## 注意事项

1. **音频质量**：建议使用 44.1kHz/16bit 或更高质量的音频输入
2. **降噪参数**：对于不同的录音质量，可能需要调整降噪参数以获得最佳效果
3. **转速校正**：自动转速校正基于基频检测，对于无音调的音乐可能效果有限
4. **分段精度**：自动分段依赖于曲目间的静音或明显的能量/频谱变化
5. **存储空间**：处理长音频文件时需要足够的内存和磁盘空间

## 许可证

MIT License
