#!/usr/bin/env python3
"""
新功能综合测试脚本 - 验证4个新增功能
"""

import sys
import os
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("=" * 70)
print("刺绣张力模拟系统 - 新功能综合测试")
print("=" * 70)

# 1. 测试多针法协同张力模拟
print("\n[1/4] 测试多针法协同张力模拟功能...")
try:
    from tension_simulator import TensionSimulator
    
    simulator = TensionSimulator(sample_rate=100)
    
    stitch_sequence = [
        {'type': 'fill', 'base_tension': 1.0, 'start_time': 0.0, 'end_time': 5.0, 'needle_id': 0},
        {'type': 'satin', 'base_tension': 1.5, 'start_time': 2.0, 'end_time': 7.0, 'needle_id': 1},
        {'type': 'chain', 'base_tension': 0.8, 'start_time': 4.0, 'end_time': 9.0, 'needle_id': 2},
    ]
    
    start_t = time.time()
    coord_result = simulator.simulate_multi_stitch_coordination(
        stitch_sequence, thread_type='silk_120D',
        total_duration=10.0, coupling_strength=0.15
    )
    elapsed = time.time() - start_t
    
    print(f"  ✓ 多针法协同模拟完成")
    print(f"    模拟时间: {elapsed:.3f}s")
    print(f"    数据点数: {len(coord_result['time'])}")
    print(f"    针法数量: {len(coord_result['individual_tensions'])}")
    print(f"    耦合强度: {coord_result['coupling_strength']}")
    
    for stitch in coord_result['individual_tensions']:
        print(f"    针{stitch['needle_id']}: {stitch['stitch_type']} - {len(stitch['tension'])}点")
    
except Exception as e:
    print(f"  ✗ 多针法协同模拟失败: {e}")
    import traceback
    traceback.print_exc()

# 2. 测试异常预警功能
print("\n[2/4] 测试张力过程异常预警功能...")
try:
    time_arr = np.linspace(0, 10, 1000)
    tension = 1.0 + 0.2 * np.sin(2 * np.pi * 1 * time_arr)
    noise = np.random.normal(0, 0.05, len(tension))
    
    # 注入异常
    anomaly_indices = [200, 201, 202, 500, 501, 800]
    for idx in anomaly_indices:
        tension[idx] += 0.5 * np.random.choice([-1, 1])
    
    start_t = time.time()
    anomaly_result = simulator.detect_anomalies(time_arr, tension, 
                                                 window_size=50, threshold=3.0)
    elapsed = time.time() - start_t
    
    print(f"  ✓ 异常检测完成")
    print(f"    检测时间: {elapsed:.3f}s")
    print(f"    发现异常: {anomaly_result['anomaly_count']}个")
    print(f"    异常率: {anomaly_result['anomaly_rate']:.4%}")
    print(f"    突变检测: {len(anomaly_result['sudden_changes'])}个")
    
except Exception as e:
    print(f"  ✗ 异常预警失败: {e}")
    import traceback
    traceback.print_exc()

# 3. 测试仿真与实验数据对比
print("\n[3/4] 测试仿真与实际刺绣测试数据对比分析功能...")
try:
    sim_time, sim_tension = simulator.simulate_stitch_tension(
        stitch_type='fill', thread_type='silk_120D',
        base_tension=1.0, stitch_count=50
    )
    
    # 模拟实验数据（添加噪声和系统偏差）
    exp_time = sim_time
    exp_tension = sim_tension * (1 + 0.05 * np.sin(2 * np.pi * 0.5 * sim_time))
    exp_tension += np.random.normal(0, 0.03, len(exp_tension))
    
    start_t = time.time()
    comp_result = simulator.compare_with_experimental(
        sim_time, sim_tension, exp_time, exp_tension
    )
    elapsed = time.time() - start_t
    
    print(f"  ✓ 仿真-实验对比完成")
    print(f"    对比时间: {elapsed:.3f}s")
    print(f"    MAE:  {comp_result['mae']:.4f} N")
    print(f"    RMSE: {comp_result['rmse']:.4f} N")
    print(f"    MAPE: {comp_result['mape']:.2f} %")
    print(f"    相关系数: {comp_result['correlation']:.4f}")
    print(f"    准确度得分: {comp_result['accuracy_score']:.1f}/100")
    
except Exception as e:
    print(f"  ✗ 仿真对比失败: {e}")
    import traceback
    traceback.print_exc()

# 4. 测试数值计算速度优化
print("\n[4/4] 测试数值计算速度优化效果...")
try:
    from numerical_computation import NumericalComputation
    
    calc = NumericalComputation()
    
    # 大样本测试
    large_data = np.random.normal(1.0, 0.2, 100000)
    
    print(f"  测试数据量: {len(large_data):,}个点")
    
    # 基础统计
    start_t = time.time()
    stats = calc.compute_basic_statistics(large_data, use_cache=False)
    elapsed1 = time.time() - start_t
    print(f"    基础统计: {elapsed1*1000:.2f}ms")
    
    # 滚动窗口统计（向量化）
    start_t = time.time()
    rolling_stats = calc.compute_rolling_window_stats(large_data, window_size=1000)
    elapsed2 = time.time() - start_t
    print(f"    滚动统计: {elapsed2*1000:.2f}ms")
    
    # 快速Z-score计算
    start_t = time.time()
    z_scores = calc.fast_rolling_zscore(large_data, window_size=1000)
    elapsed3 = time.time() - start_t
    print(f"    Z-score计算: {elapsed3*1000:.2f}ms")
    
    # FFT分析
    start_t = time.time()
    freqs, fft_vals = calc.compute_fft(large_data, sample_rate=1000)
    elapsed4 = time.time() - start_t
    print(f"    FFT分析: {elapsed4*1000:.2f}ms")
    
    # 批量统计
    large_matrix = np.random.normal(1.0, 0.2, (100, 10000))
    start_t = time.time()
    batch_stats = calc.compute_batch_statistics(large_matrix)
    elapsed5 = time.time() - start_t
    print(f"    批量统计(100×10000): {elapsed5*1000:.2f}ms")
    
    total_elapsed = elapsed1 + elapsed2 + elapsed3 + elapsed4 + elapsed5
    print(f"  ✓ 所有计算完成, 总耗时: {total_elapsed*1000:.2f}ms")
    print(f"    平均每10万点处理速度: {total_elapsed/5*1000:.2f}ms")
    
except Exception as e:
    print(f"  ✗ 数值计算失败: {e}")
    import traceback
    traceback.print_exc()

# 5. 测试可视化模块新功能
print("\n[5/5] 测试可视化模块新功能...")
try:
    from visualization import Visualization
    
    viz = Visualization(output_dir='./test_output_new')
    
    # 多针法协同可视化
    path1 = viz.plot_multi_stitch_coordination(coord_result)
    print(f"  ✓ 多针法协同图: {path1}")
    
    # 异常检测可视化
    path2 = viz.plot_anomaly_detection(time_arr, tension, anomaly_result)
    print(f"  ✓ 异常检测图: {path2}")
    
    # 仿真对比可视化
    path3 = viz.plot_experimental_comparison(exp_time, exp_tension,
                                             sim_time, sim_tension, comp_result)
    print(f"  ✓ 仿真对比图: {path3}")
    
except Exception as e:
    print(f"  ✗ 可视化失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
print("所有新功能测试完成!")
print("=" * 70)
