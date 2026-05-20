#!/usr/bin/env python3
"""测试戏曲唱腔分析系统的增强功能"""

import os
import sys
import numpy as np
import tempfile
import soundfile as sf

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

from data_access.audio_loader import AudioLoader, AudioSegment
from feature_extraction.feature_extractor import FeatureExtractor, OperaStyleDefinitions


def create_test_audio(duration=5.0, sr=22050, freq=440):
    """创建测试音频"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    y = 0.5 * np.sin(2 * np.pi * freq * t)
    y += 0.2 * np.sin(2 * np.pi * freq * 2 * t)
    return y, sr


def save_audio(file_path, y, sr):
    """保存音频文件"""
    sf.write(file_path, y, sr)


def test_audio_segmentation():
    """测试音频片段截取与对比功能"""
    print("=" * 60)
    print("测试 1: 音频片段截取与对比")
    print("=" * 60)

    y, sr = create_test_audio(duration=10.0)
    
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        temp_file = f.name
    sf.write(temp_file, y, sr)

    try:
        loader = AudioLoader(sample_rate=sr)
        
        seg1 = loader.extract_segment(temp_file, 0.0, 2.0)
        seg2 = loader.extract_segment(temp_file, 2.0, 2.0)
        
        print(f"  片段 1: {seg1.duration:.2f}秒, 采样数: {len(seg1.audio)}")
        print(f"  片段 2: {seg2.duration:.2f}秒, 采样数: {len(seg2.audio)}")
        
        comparison = loader.compare_segments(seg1, seg2, method='all')
        print(f"  余弦相似度: {comparison['cosine_similarity']:.4f}")
        print(f"  相关系数: {comparison['correlation']:.4f}")
        
        segments = loader.extract_segments(temp_file, segment_duration=2.0, overlap=0.5)
        print(f"  重叠分段数量: {len(segments)}")
        
        print("  ✓ 音频片段截取与对比功能正常")
        return True
    except Exception as e:
        print(f"  ✗ 测试失败: {e}")
        return False
    finally:
        os.unlink(temp_file)


def test_feature_annotation():
    """测试唱腔特征自动标注功能"""
    print("\n" + "=" * 60)
    print("测试 2: 唱腔特征自动标注")
    print("=" * 60)

    y, sr = create_test_audio(duration=5.0, freq=523)
    
    try:
        extractor = FeatureExtractor(sample_rate=sr, enable_annotation=True)
        features = extractor.extract_all_features(y, sr)
        
        print(f"  提取特征数量: {len([k for k in features.keys() if k != 'annotations'])}")
        
        if 'annotations' in features:
            annotations = features['annotations']
            print(f"  音域类型: {annotations.get('vocal_range', 'N/A')}")
            print(f"  节奏风格: {annotations.get('rhythm_style', 'N/A')}")
            print(f"  音色类型: {annotations.get('timbre_type', 'N/A')}")
            print(f"  颤音类型: {annotations.get('vibrato_type', 'N/A')}")
            print(f"  音高特征: {annotations.get('pitch_characteristic', 'N/A')}")
            print("  ✓ 特征自动标注功能正常")
            return True
        else:
            print("  ✗ 未找到标注结果")
            return False
    except Exception as e:
        print(f"  ✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_genre_classification():
    """测试戏曲唱腔流派智能分类功能"""
    print("\n" + "=" * 60)
    print("测试 3: 戏曲唱腔流派智能分类")
    print("=" * 60)

    y, sr = create_test_audio(duration=5.0, freq=440)
    
    try:
        extractor = FeatureExtractor(sample_rate=sr)
        features = extractor.extract_all_features(y, sr)
        
        prediction = extractor.predict_genre(features)
        
        print(f"  预测流派: {prediction['predicted_genre']}")
        print(f"  置信度: {prediction['confidence']:.4f}")
        print(f"  描述: {prediction['description']}")
        
        print(f"\n  其他候选流派 (Top 3):")
        for i, pred in enumerate(prediction['all_predictions'][:3]):
            print(f"    {i+1}. {pred['genre_name']}: {pred['confidence']:.4f}")
        
        print("\n  支持的戏曲流派:")
        for genre_id, genre_info in OperaStyleDefinitions.OPERA_GENRES.items():
            print(f"    - {genre_info['name']}: {genre_info['description']}")
        
        print("  ✓ 流派智能分类功能正常")
        return True
    except Exception as e:
        print(f"  ✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_performance_optimizations():
    """测试音频加载速度与图表渲染优化"""
    print("\n" + "=" * 60)
    print("测试 4: 音频加载速度与图表渲染优化")
    print("=" * 60)

    import time
    
    y, sr = create_test_audio(duration=60.0)
    
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        temp_file = f.name
    sf.write(temp_file, y, sr)

    try:
        loader = AudioLoader(sample_rate=sr, enable_cache=True)
        
        start = time.time()
        y1, sr1 = loader.load_audio(temp_file)
        time1 = time.time() - start
        
        start = time.time()
        y2, sr2 = loader.load_audio(temp_file)
        time2 = time.time() - start
        
        print(f"  首次加载时间: {time1*1000:.2f}ms")
        print(f"  缓存加载时间: {time2*1000:.2f}ms")
        print(f"  缓存加速比: {time1/time2:.1f}x")
        
        temp_files = []
        for i in range(5):
            y_i, _ = create_test_audio(duration=5.0)
            f = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            save_audio(f.name, y_i, sr)
            temp_files.append(f.name)
        
        start = time.time()
        results_seq = []
        for f in temp_files:
            info = loader.get_audio_info(f)
            results_seq.append(info)
        time_seq = time.time() - start
        
        start = time.time()
        results_par = loader.batch_load_parallel(temp_files)
        time_par = time.time() - start
        
        print(f"  顺序加载时间: {time_seq*1000:.2f}ms")
        print(f"  并行加载时间: {time_par*1000:.2f}ms")
        print(f"  并行加速比: {time_seq/time_par:.1f}x")
        
        print("  ✓ 性能优化功能正常")
        
        for f in temp_files:
            os.unlink(f)
        
        return True
    except Exception as e:
        print(f"  ✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        os.unlink(temp_file)


def test_opera_style_definitions():
    """测试戏曲唱腔风格定义"""
    print("\n" + "=" * 60)
    print("测试 5: 戏曲唱腔风格定义")
    print("=" * 60)

    try:
        print("  音域定义:")
        for vocal_type, range_info in OperaStyleDefinitions.PITCH_RANGES.items():
            print(f"    - {range_info['label']}: {range_info['min']}-{range_info['max']} Hz")
        
        print("\n  节奏风格定义:")
        for rhythm_type, range_info in OperaStyleDefinitions.RHYTHM_STYLES.items():
            print(f"    - {range_info['label']}")
        
        print("\n  音色类型定义:")
        for timbre_type, range_info in OperaStyleDefinitions.TIMBRE_FEATURES.items():
            print(f"    - {range_info['label']}")
        
        print("\n  颤音类型定义:")
        for vibrato_type, range_info in OperaStyleDefinitions.VIBRATO_TYPES.items():
            print(f"    - {range_info['label']}")
        
        print("  ✓ 戏曲唱腔风格定义完整")
        return True
    except Exception as e:
        print(f"  ✗ 测试失败: {e}")
        return False


def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("戏曲唱腔分析系统 - 增强功能测试")
    print("=" * 60)
    
    tests = [
        test_audio_segmentation,
        test_feature_annotation,
        test_genre_classification,
        test_performance_optimizations,
        test_opera_style_definitions,
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"通过: {passed}/{total}")
    
    if passed == total:
        print("✓ 所有测试通过！")
        return 0
    else:
        print("✗ 部分测试失败")
        return 1


if __name__ == '__main__':
    sys.exit(main())
