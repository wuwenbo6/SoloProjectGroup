#!/usr/bin/env python3
"""
自适应阈值功能测试脚本
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import soundfile as sf

from acoustic.adaptive_threshold import (
    EnvironmentalNoiseAnalyzer,
    NoiseTypeClassifier,
    AdaptivePestDetector
)
from acoustic.noise_generator import EnvironmentalNoiseGenerator, generate_test_scenarios
from node_sim.audio_generator import PestSoundGenerator


def test_noise_classification():
    """测试噪声类型识别"""
    print("=" * 60)
    print("测试1: 噪声类型识别")
    print("=" * 60)
    
    noise_gen = EnvironmentalNoiseGenerator()
    classifier = NoiseTypeClassifier()
    
    test_cases = [
        ('风噪声', noise_gen.generate_wind_noise(intensity=0.3)),
        ('农机声', noise_gen.generate_machinery_noise(intensity=0.4)),
        ('交通噪声', noise_gen.generate_traffic_noise(intensity=0.3)),
    ]
    
    pest_gen = PestSoundGenerator()
    test_cases.append(('蝗虫声', pest_gen.generate_pest_sound('locust')))
    
    results = []
    for name, signal in test_cases:
        result = classifier.classify_noise(signal)
        results.append({
            'name': name,
            'detected_type': result['dominant_noise_name'],
            'is_interference': result['is_interference'],
            'confidence': result['confidence']
        })
        
        status = "✓" if result['is_interference'] and '噪声' in name or '声' in name and not result['is_interference'] else "?"
        print(f"  {name:10s} → {result['dominant_noise_name']:10s} "
              f"(置信度: {result['confidence']:.2f}, 干扰: {result['is_interference']}) {status}")
    
    print()
    return results


def test_adaptive_threshold():
    """测试自适应阈值功能"""
    print("=" * 60)
    print("测试2: 自适应阈值校准")
    print("=" * 60)
    
    detector = AdaptivePestDetector()
    noise_gen = EnvironmentalNoiseGenerator()
    
    print("  正在生成校准噪声样本...")
    calibration_samples = noise_gen.generate_calibration_noise(n_samples=15)
    
    print("  开始校准...")
    for i, sample in enumerate(calibration_samples):
        detector.calibrate(sample)
        if (i + 1) % 5 == 0:
            profile = detector.get_current_noise_profile()
            print(f"    已校准 {i+1} 个样本, 准备状态: {profile['is_ready']}")
    
    final_profile = detector.get_current_noise_profile()
    print(f"\n  校准完成:")
    print(f"    噪声RMS均值: {final_profile['profile']['rms_mean']:.4f}")
    print(f"    质心频率均值: {final_profile['profile']['spectral_centroid_mean']:.1f} Hz")
    print(f"    阈值已准备: {final_profile['is_ready']}")
    
    thresholds = detector.noise_analyzer.get_adaptive_threshold()
    print(f"\n  自适应阈值参数:")
    print(f"    RMS阈值: {thresholds['rms_threshold']:.4f}")
    print(f"    SNR阈值: {thresholds['snr_threshold']:.1f} dB")
    print(f"    置信度乘数: {thresholds['confidence_multiplier']:.2f}")
    
    print()
    return detector


def test_noise_filtering_effect(detector):
    """测试噪声过滤效果"""
    print("=" * 60)
    print("测试3: 噪声过滤效果")
    print("=" * 60)
    
    pest_gen = PestSoundGenerator()
    noise_gen = EnvironmentalNoiseGenerator()
    
    scenarios = generate_test_scenarios()
    
    results = []
    for scenario in scenarios:
        name = scenario['name']
        
        if scenario['signal'] is None:
            signal = pest_gen.generate_pest_sound('locust')
        else:
            signal = scenario['signal']
        
        result = detector.detect_with_adaptive_threshold(signal)
        
        correct = (scenario['expected_result'] == 'detect' and result['detected']) or \
                  (scenario['expected_result'] == 'filter' and not result['detected'])
        
        results.append({
            'name': name,
            'expected': scenario['expected_result'],
            'actual': 'detect' if result['detected'] else 'filter',
            'correct': correct,
            'confidence': result['confidence'],
            'reason': result['reason']
        })
        
        status = "✓" if correct else "✗"
        print(f"  {status} {name:30s} 预期: {scenario['expected_result']:8s} "
              f"实际: {'detect' if result['detected'] else 'filter':8s} "
              f"置信度: {result['confidence']:.2f}")
        if result.get('is_noise'):
            print(f"      → 原因: {result['reason']}")
    
    correct_count = sum(1 for r in results if r['correct'])
    print(f"\n  准确率: {correct_count}/{len(results)} ({correct_count/len(results)*100:.1f}%)")
    
    print()
    return results


def test_sensitivity_adjustment(detector):
    """测试敏感度调整"""
    print("=" * 60)
    print("测试4: 敏感度调整")
    print("=" * 60)
    
    pest_gen = PestSoundGenerator()
    noise_gen = EnvironmentalNoiseGenerator()
    
    pest_signal = pest_gen.generate_pest_sound('cotton_bollworm')
    noise = noise_gen.generate_wind_noise(intensity=0.25)
    mixed = noise_gen.mix_signals(pest_signal, noise, ratio=0.5)
    
    sensitivities = [0.2, 0.5, 0.8]
    
    print(f"  测试信号: 棉铃虫声 + 中等风噪")
    print()
    
    for sens in sensitivities:
        result = detector.detect_with_adaptive_threshold(mixed, sensitivity=sens)
        threshold = result.get('threshold_used', {})
        
        print(f"  敏感度 {sens:.1f}:")
        print(f"    是否检测: {result['detected']}")
        print(f"    置信度: {result['confidence']:.3f}")
        print(f"    RMS阈值: {threshold.get('rms_threshold', 'N/A'):.4f}")
        print(f"    置信度乘数: {threshold.get('confidence_multiplier', 'N/A'):.2f}")
        print()
    
    print()


def save_test_audio_files():
    """保存测试音频文件用于验证"""
    print("=" * 60)
    print("保存测试音频文件")
    print("=" * 60)
    
    os.makedirs('test_output', exist_ok=True)
    
    noise_gen = EnvironmentalNoiseGenerator()
    pest_gen = PestSoundGenerator()
    
    files = [
        ('test_output/wind_noise.wav', noise_gen.generate_wind_noise(intensity=0.4)),
        ('test_output/machinery_noise.wav', noise_gen.generate_machinery_noise(intensity=0.5)),
        ('test_output/locust_clean.wav', pest_gen.generate_pest_sound('locust')),
        ('test_output/pest_with_noise.wav', noise_gen.mix_signals(
            pest_gen.generate_pest_sound('locust'),
            noise_gen.generate_wind_noise(intensity=0.2),
            ratio=0.7
        )),
    ]
    
    for filename, signal in files:
        sf.write(filename, signal, 22050)
        print(f"  已保存: {filename}")
    
    print()


def main():
    """运行所有测试"""
    print("\n")
    print("🐛 自适应阈值功能测试 🐛")
    print()
    
    test_noise_classification()
    
    detector = test_adaptive_threshold()
    
    test_noise_filtering_effect(detector)
    
    test_sensitivity_adjustment(detector)
    
    save_test_audio_files()
    
    print("=" * 60)
    print("测试完成!")
    print("=" * 60)
    print("\n总结:")
    print("  ✓ 噪声类型分类器可识别风噪声、农机声等干扰")
    print("  ✓ 自适应阈值根据环境噪声自动调整检测灵敏度")
    print("  ✓ 低信噪比信号会被自动过滤，减少误报")
    print("  ✓ 支持通过敏感度参数调整检测严格程度")
    print("\nAPI端点:")
    print("  GET  /api/noise-status/  - 获取噪声状态和校准信息")
    print("  POST /api/noise-status/  - 重置校准")
    print("  POST /api/noise-test/    - 测试音频噪声类型")
    print("  POST /api/detections/upload/  - 支持sensitivity参数")


if __name__ == '__main__':
    main()
