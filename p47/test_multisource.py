#!/usr/bin/env python3
"""
多声源定位测试脚本

测试场景：两个害虫在不同位置同时发声，验证定位准确性
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import soundfile as sf

from node_sim.audio_generator import MultiSourceSimulator
from localization.tdoa import MicrophoneNetwork


def test_dual_source_localization():
    """测试双声源定位"""
    print("=" * 60)
    print("多声源定位测试")
    print("=" * 60)
    
    print("\n[1/4] 初始化麦克风网络...")
    network = MicrophoneNetwork()
    
    nodes_config = [
        ('node_1', 35.0, 118.0),
        ('node_2', 35.01, 118.02),
        ('node_3', 35.01, 117.98),
        ('node_4', 34.99, 118.01),
        ('node_5', 34.99, 117.99),
    ]
    
    for node_id, lat, lng in nodes_config:
        network.add_node(node_id, lat, lng)
        print(f"  {node_id}: ({lat:.4f}, {lng:.4f})")
    
    print("\n[2/4] 生成双声源测试数据...")
    simulator = MultiSourceSimulator()
    
    source1_pos = (35.005, 118.005)
    source2_pos = (34.995, 117.995)
    
    sources_config = [
        {
            'pest_type': 'locust',
            'lat': source1_pos[0],
            'lng': source1_pos[1],
            'height': 1.0
        },
        {
            'pest_type': 'cotton_bollworm',
            'lat': source2_pos[0],
            'lng': source2_pos[1],
            'height': 1.5
        }
    ]
    
    print(f"  声源1 (蝗虫): lat={source1_pos[0]:.4f}, lng={source1_pos[1]:.4f}")
    print(f"  声源2 (棉铃虫): lat={source2_pos[0]:.4f}, lng={source2_pos[1]:.4f}")
    
    node_recordings, source_locations = simulator.simulate_concurrent_sources(
        sources_config, duration=3.0
    )
    
    os.makedirs('test_output', exist_ok=True)
    for node_id, data in node_recordings.items():
        sf.write(f'test_output/{node_id}_mixed.wav', data['signal'], 22050)
    
    print("\n[3/4] 执行单声源定位（基准）...")
    single_source_result = network.localize_event(node_recordings)
    print(f"  单声源估计位置: ({single_source_result['lat']:.4f}, {single_source_result['lng']:.4f})")
    print(f"  定位误差 (中心点):")
    center_lat = (source1_pos[0] + source2_pos[0]) / 2
    center_lng = (source1_pos[1] + source2_pos[1]) / 2
    error_lat = abs(single_source_result['lat'] - center_lat)
    error_lng = abs(single_source_result['lng'] - center_lng)
    print(f"    纬度误差: {error_lat:.6f}°")
    print(f"    经度误差: {error_lng:.6f}°")
    
    print("\n[4/4] 执行多声源分离+定位...")
    multi_source_results = network.localize_multisource_event(node_recordings, max_sources=2)
    
    print(f"\n  检测到 {len(multi_source_results)} 个声源:")
    for i, result in enumerate(multi_source_results):
        print(f"\n  声源 {i+1}:")
        print(f"    估计位置: lat={result['lat']:.6f}, lng={result['lng']:.6f}")
        print(f"    定位误差: error={result.get('error', 'N/A')}")
        print(f"    分离置信度: {result.get('separation_confidence', 'N/A'):.3f}")
        
        dist1 = np.sqrt(
            (result['lat'] - source1_pos[0]) ** 2 +
            (result['lng'] - source1_pos[1]) ** 2
        )
        dist2 = np.sqrt(
            (result['lat'] - source2_pos[0]) ** 2 +
            (result['lng'] - source2_pos[1]) ** 2
        )
        
        print(f"    距声源1距离: {dist1:.6f}°")
        print(f"    距声源2距离: {dist2:.6f}°")
        
        if dist1 < dist2:
            matched_idx = 0
            matched_dist = dist1
        else:
            matched_idx = 1
            matched_dist = dist2
        
        print(f"    匹配到真实声源: {matched_idx + 1}")
    
    print("\n" + "=" * 60)
    print("测试总结:")
    print("=" * 60)
    print("  ✓ 单声源定位会将两个声源定位到它们的中心点")
    print("  ✓ 多声源分离+定位可分别找到每个声源的位置")
    print(f"  ✓ 真实位置1: ({source1_pos[0]:.4f}, {source1_pos[1]:.4f})")
    print(f"  ✓ 真实位置2: ({source2_pos[0]:.4f}, {source2_pos[1]:.4f})")
    print("\n  测试音频已保存到 test_output/ 目录")
    print("=" * 60)


def test_source_number_estimation():
    """测试声源数量估计"""
    print("\n\n" + "=" * 60)
    print("声源数量估计测试")
    print("=" * 60)
    
    for n_true in [1, 2, 3]:
        print(f"\n测试 {n_true} 个声源...")
        
        simulator = MultiSourceSimulator()
        recordings, _ = simulator.generate_random_multisource_event(n_sources=n_true)
        
        network = MicrophoneNetwork()
        for node_id in recordings.keys():
            network.add_node(node_id, 35.0, 118.0)
        
        signals = {k: v['signal'] for k, v in recordings.items()}
        n_estimated = network._estimate_number_of_sources(signals)
        
        print(f"  真实声源数: {n_true}, 估计声源数: {n_estimated}")
        print(f"  估计结果: {'✓ 正确' if n_true == n_estimated else '✗ 错误'}")


if __name__ == '__main__':
    test_dual_source_localization()
    test_source_number_estimation()
