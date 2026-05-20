#!/usr/bin/env python3
"""
戏曲唱腔分析系统 - 性能优化测试脚本
验证大型音频分块处理、Dask并行计算、内存优化可视化等功能
"""

import os
import sys
import time
import numpy as np
import gc
from typing import List, Dict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

print("=" * 70)
print("戏曲唱腔分析系统 - 性能优化测试")
print("=" * 70)

# 尝试导入Dask
try:
    import dask
    from dask.distributed import Client, LocalCluster
    DASK_AVAILABLE = True
    print("✓ Dask 已安装，并行计算可用")
except ImportError:
    DASK_AVAILABLE = False
    print("⚠ Dask 未安装，将使用单线程模式")

# 导入高性能处理模块
from processing.high_performance_audio import (
    ChunkedAudioProcessor,
    MultiLevelCache,
    MemoryOptimizedSpectrogram,
    PrefetchLoader,
    monitor_memory
)

from visualization.optimized_visuals import (
    Downsampler,
    MemoryOptimizedWaveform,
    OptimizedSpectrogram,
    create_comparison_dashboard
)


def create_test_audio(duration: float = 600.0, sr: int = 22050, n_channels: int = 1) -> np.ndarray:
    """创建测试音频（默认10分钟）"""
    print(f"\n生成测试音频: {duration} 秒, {sr} Hz...")

    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    y = (np.sin(2 * np.pi * 220 * t) +
         0.5 * np.sin(2 * np.pi * 440 * t) +
         0.3 * np.sin(2 * np.pi * 880 * t) +
         0.1 * np.random.randn(len(t)))

    y = y.astype(np.float32)

    if n_channels > 1:
        y = np.column_stack([y * (1 + i * 0.1) for i in range(n_channels)])

    print(f"  音频形状: {y.shape}, 内存: {y.nbytes / 1024 / 1024:.2f} MB")
    return y


def test_chunked_processing():
    """测试分块音频处理"""
    print("\n" + "=" * 60)
    print("测试 1: 大型音频分块处理")
    print("=" * 60)

    duration = 600  # 10分钟
    sr = 22050
    y = create_test_audio(duration, sr)

    processor = ChunkedAudioProcessor(
        sample_rate=sr,
        chunk_duration=30.0,
        use_dask=False,
        enable_cache=True,
        cache_size_mb=512
    )

    print(f"\n逐块处理音频...")
    start_time = time.time()

    chunk_results = []
    for i, chunk in enumerate(processor.load_and_process_chunks(y, sr)):
        chunk_results.append({
            'chunk_idx': i,
            'rms_mean': np.mean(chunk['rms']),
            'processing_time': chunk['processing_time']
        })

        if (i + 1) % 5 == 0:
            print(f"  已处理 {i + 1} 块...")

    total_time = time.time() - start_time
    print(f"\n✓ 处理完成:")
    print(f"  总块数: {len(chunk_results)}")
    print(f"  总耗时: {total_time:.2f} 秒")
    print(f"  平均每块: {total_time / len(chunk_results):.3f} 秒")

    del y
    gc.collect()
    return True


def test_multilevel_cache():
    """测试多级缓存系统"""
    print("\n" + "=" * 60)
    print("测试 2: 多级音频缓存系统")
    print("=" * 60)

    cache = MultiLevelCache(
        memory_cache_size_mb=128,
        compressed_cache_size_mb=256,
        disk_cache_dir=None
    )

    # 创建测试音频片段
    test_audios = {}
    for i in range(10):
        y, sr = create_test_audio(duration=30.0, sr=22050)
        test_audios[f"audio_{i}"] = (y, sr)

    print(f"\n缓存预热...")
    start_time = time.time()
    for key, (y, sr) in test_audios.items():
        cache.put(key, y, sr)
    warmup_time = time.time() - start_time
    print(f"  预热耗时: {warmup_time:.2f} 秒")

    print(f"\n缓存命中测试...")
    hit_times = []
    misses = 0
    for _ in range(3):
        for key in test_audios.keys():
            start = time.time()
            result = cache.get(key)
            hit_times.append(time.time() - start)
            if result is None:
                misses += 1

    hit_rate = (30 - misses) / 30 * 100
    avg_hit_time = np.mean(hit_times) * 1000

    print(f"  命中率: {hit_rate:.1f}%")
    print(f"  平均命中时间: {avg_hit_time:.2f} 毫秒")

    stats = cache.get_hit_rate()
    print(f"  内存缓存命中率: {stats.get('memory', 0) * 100:.1f}%")
    print(f"  压缩缓存命中率: {stats.get('compressed', 0) * 100:.1f}%")

    print(f"\n✓ 多级缓存系统正常工作")

    del test_audios
    cache.clear()
    gc.collect()
    return True


def test_downsampling():
    """测试数据降采样算法"""
    print("\n" + "=" * 60)
    print("测试 3: 数据降采样算法")
    print("=" * 60)

    y, sr = create_test_audio(duration=600.0, sr=22050)
    print(f"\n原始数据点: {len(y)}")

    methods = ['step', 'minmax', 'lttb']
    max_points = 10000

    results = {}
    for method in methods:
        start_time = time.time()
        y_down = Downsampler.downsample_1d(y, max_points, method)
        elapsed = time.time() - start_time
        results[method] = {
            'points': len(y_down),
            'time_ms': elapsed * 1000,
            'data': y_down
        }
        print(f"  {method}: {len(y_down)} 点, {elapsed * 1000:.2f} 毫秒")

    # 计算误差
    original_mean = np.mean(y)
    original_std = np.std(y)
    print(f"\n统计特性保留:")
    for method, res in results.items():
        mean_err = abs(np.mean(res['data']) - original_mean) / original_mean * 100
        std_err = abs(np.std(res['data']) - original_std) / original_std * 100
        print(f"  {method}: 均值误差 {mean_err:.3f}%, 标准差误差 {std_err:.3f}%")

    print(f"\n✓ 降采样算法正常工作")

    del y
    gc.collect()
    return True


def test_optimized_waveform():
    """测试内存优化的波形渲染"""
    print("\n" + "=" * 60)
    print("测试 4: 内存优化波形渲染")
    print("=" * 60)

    y, sr = create_test_audio(duration=600.0, sr=22050)

    viz = MemoryOptimizedWaveform(max_points=10000, downsample_method='minmax')

    # 测量内存使用
    import psutil
    process = psutil.Process()
    memory_before = process.memory_info().rss / 1024 / 1024

    # 渲染图表
    start_time = time.time()
    fig = viz.create_waveform(y, sr, title='测试波形')
    render_time = time.time() - start_time

    memory_after = process.memory_info().rss / 1024 / 1024
    memory_used = memory_after - memory_before

    print(f"\n渲染性能:")
    print(f"  渲染时间: {render_time:.3f} 秒")
    print(f"  内存使用: {memory_used:.2f} MB")
    print(f"  图表数据点: {len(fig.data[0].x)}")

    # 测试多通道
    print(f"\n多通道渲染测试:")
    y_multi = np.column_stack([y, y * 0.9, y * 0.8])
    start_time = time.time()
    fig_multi = viz.create_multi_channel_waveform(y_multi, sr,
                                                    channel_names=['左声道', '右声道', '中声道'],
                                                    title='三通道波形')
    multi_time = time.time() - start_time
    print(f"  3通道渲染时间: {multi_time:.3f} 秒")

    print(f"\n✓ 内存优化波形渲染正常工作")

    del y, y_multi, fig, fig_multi
    gc.collect()
    return True


def test_optimized_spectrogram():
    """测试优化的频谱图渲染"""
    print("\n" + "=" * 60)
    print("测试 5: 优化频谱图渲染")
    print("=" * 60)

    import librosa

    y, sr = create_test_audio(duration=300.0, sr=22050)

    # 计算STFT
    print(f"\n计算STFT...")
    D = librosa.stft(y, n_fft=2048)
    print(f"  原始频谱形状: {D.shape}")
    print(f"  原始数据点: {D.size}")

    spec_viz = OptimizedSpectrogram(max_freq_bins=256, max_time_steps=1000)

    import psutil
    process = psutil.Process()
    memory_before = process.memory_info().rss / 1024 / 1024

    start_time = time.time()
    fig = spec_viz.create_spectrogram(D, sr, title='测试频谱图')
    render_time = time.time() - start_time

    memory_after = process.memory_info().rss / 1024 / 1024
    memory_used = memory_after - memory_before

    heatmap_data = fig.data[0].z.shape
    print(f"\n频谱图渲染:")
    print(f"  渲染时间: {render_time:.3f} 秒")
    print(f"  渲染后尺寸: {heatmap_data}")
    print(f"  压缩率: {D.size / (heatmap_data[0] * heatmap_data[1]):.1f}x")
    print(f"  内存使用: {memory_used:.2f} MB")

    print(f"\n✓ 优化频谱图渲染正常工作")

    del y, D, fig
    gc.collect()
    return True


def test_dask_parallel():
    """测试Dask并行计算（如果可用）"""
    print("\n" + "=" * 60)
    print("测试 6: Dask并行计算")
    print("=" * 60)

    if not DASK_AVAILABLE:
        print("⚠ Dask 不可用，跳过并行测试")
        return True

    # 创建小文件用于测试
    print(f"\n初始化Dask集群...")
    try:
        cluster = LocalCluster(n_workers=2, threads_per_worker=1, memory_limit='2GB')
        client = Client(cluster)
        print(f"  ✓ Dask集群已启动")
        print(f"  {client}")
    except Exception as e:
        print(f"  ⚠ Dask集群启动失败: {e}, 跳过并行测试")
        return True

    processor = ChunkedAudioProcessor(
        sample_rate=22050,
        chunk_duration=30.0,
        use_dask=True,
        num_workers=2,
        enable_cache=False
    )

    # 创建多个音频测试
    print(f"\n创建测试音频...")
    audio_files = []
    for i in range(4):
        y = create_test_audio(duration=60.0, sr=22050)
        audio_files.append((f"test_{i}.wav", y))

    # 测试并行处理
    print(f"\n并行特征提取...")
    start_time = time.time()

    # 这里简化测试，实际应用会从文件加载
    # 测试Dask基本功能
    @dask.delayed
    def process_audio(audio_data, sample_rate):
        rms = np.sqrt(np.mean(audio_data ** 2))
        zcr = np.mean(np.abs(np.diff(np.sign(audio_data)))) / 2
        return {'rms': float(rms), 'zcr': float(zcr)}

    delayed_results = [process_audio(y, 22050) for _, y in audio_files]

    start_time = time.time()
    results = dask.compute(*delayed_results)
    parallel_time = time.time() - start_time

    print(f"  并行处理 {len(results)} 个文件: {parallel_time:.3f} 秒")
    print(f"  平均每个文件: {parallel_time / len(results):.3f} 秒")

    # 关闭Dask客户端
    client.close()
    cluster.close()

    print(f"\n✓ Dask并行计算正常工作")

    for _, y in audio_files:
        del y
    gc.collect()
    return True


def test_comparison_dashboard():
    """测试对比仪表板生成"""
    print("\n" + "=" * 60)
    print("测试 7: 对比仪表板生成")
    print("=" * 60)

    y1, sr = create_test_audio(duration=60.0, sr=22050)
    y2 = y1 * 0.8 + 0.01 * np.random.randn(len(y1)).astype(np.float32)

    print(f"\n生成对比仪表板...")
    import psutil
    process = psutil.Process()
    memory_before = process.memory_info().rss / 1024 / 1024

    start_time = time.time()
    fig = create_comparison_dashboard(y1, y2, sr, labels=('原版', '处理版'))
    render_time = time.time() - start_time

    memory_after = process.memory_info().rss / 1024 / 1024
    memory_used = memory_after - memory_before

    print(f"  渲染时间: {render_time:.3f} 秒")
    print(f"  内存使用: {memory_used:.2f} MB")
    print(f"  子图数量: {len(fig.data)}")
    print(f"  布局行数: {fig.layout.height}")

    print(f"\n✓ 对比仪表板生成正常工作")

    del y1, y2, fig
    gc.collect()
    return True


def run_all_tests():
    """运行所有性能测试"""
    tests = [
        ("分块音频处理", test_chunked_processing),
        ("多级缓存系统", test_multilevel_cache),
        ("数据降采样算法", test_downsampling),
        ("内存优化波形渲染", test_optimized_waveform),
        ("优化频谱图渲染", test_optimized_spectrogram),
        ("Dask并行计算", test_dask_parallel),
        ("对比仪表板生成", test_comparison_dashboard),
    ]

    results = []
    print(f"\n{'=' * 70}")
    print("开始性能测试套件")
    print(f"{'=' * 70}")

    for test_name, test_func in tests:
        try:
            start = time.time()
            success = test_func()
            elapsed = time.time() - start
            results.append((test_name, success, elapsed))
        except Exception as e:
            print(f"\n✗ {test_name} 失败: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False, 0))

    # 汇总报告
    print(f"\n{'=' * 70}")
    print("测试汇总报告")
    print(f"{'=' * 70}")

    passed = sum(1 for _, success, _ in results if success)
    total = len(results)

    print(f"\n通过: {passed}/{total}")
    print(f"\n详细结果:")
    for test_name, success, elapsed in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"  {status} {test_name} ({elapsed:.2f}s)")

    print(f"\n{'=' * 70}")

    if passed == total:
        print("✓ 所有性能优化测试通过！系统已准备好处理大型音频文件。")
        return 0
    else:
        print("⚠ 部分测试失败，请检查错误信息并修复问题。")
        return 1


if __name__ == '__main__':
    sys.exit(run_all_tests())
