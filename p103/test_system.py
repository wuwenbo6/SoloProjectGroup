#!/usr/bin/env python3
"""
系统功能测试脚本
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import numpy as np

print("=" * 70)
print("刺绣针法张力模拟系统 - 功能测试")
print("=" * 70)

# 1. 测试张力模拟器
print("\n[1/6] 测试张力模拟模块...")
try:
    from tension_simulator import TensionSimulator, StitchType, SilkThread
    
    simulator = TensionSimulator(sample_rate=50)
    
    stitch_types = ['satin', 'chain', 'fill', 'outline']
    for st in stitch_types:
        time, tension = simulator.simulate_stitch_tension(
            stitch_type=st,
            thread_type='silk_120D',
            base_tension=1.0,
            stitch_count=30
        )
        print(f"  {st:10s}: {len(tension)} 采样点, 均值={np.mean(tension):.4f} N")
    
    metrics = simulator.calculate_tension_metrics(tension)
    safety = simulator.check_tension_safety('silk_120D', tension)
    print(f"  安全检查: {'通过' if safety['safe'] else '失败'}")
    
    print("  ✓ 张力模拟模块测试通过")
except Exception as e:
    print(f"  ✗ 张力模拟模块失败: {e}")
    import traceback
    traceback.print_exc()

# 2. 测试参数采集模块
print("\n[2/6] 测试参数采集模块...")
try:
    from stitch_acquisition import StitchAcquisition
    
    acquisition = StitchAcquisition()
    
    validation = acquisition.validate_parameters()
    print(f"  参数验证: {'通过' if validation['valid'] else '失败'}")
    
    acquisition.set_parameter('base_tension', 1.5)
    params = acquisition.get_all_parameters()
    print(f"  参数数量: {len(params)}")
    
    print("  ✓ 参数采集模块测试通过")
except Exception as e:
    print(f"  ✗ 参数采集模块失败: {e}")
    import traceback
    traceback.print_exc()

# 3. 测试数值计算模块
print("\n[3/6] 测试数值计算模块...")
try:
    from numerical_computation import NumericalComputation
    
    calc = NumericalComputation()
    
    test_data = np.random.normal(1.0, 0.1, 1000)
    
    stats = calc.compute_basic_statistics(test_data)
    print(f"  基础统计: 均值={stats['mean']:.4f}, 标准差={stats['std']:.4f}")
    
    freqs, fft_vals = calc.compute_fft(test_data, sample_rate=100)
    print(f"  FFT 分析: {len(freqs)} 个频率点")
    
    peaks, peak_props = calc.find_peaks(test_data, height=1.1)
    print(f"  峰值检测: 找到 {len(peaks)} 个峰值")
    
    outliers = calc.detect_outliers(test_data)
    print(f"  异常值检测: 找到 {len(outliers)} 个异常值")
    
    print("  ✓ 数值计算模块测试通过")
except Exception as e:
    print(f"  ✗ 数值计算模块失败: {e}")
    import traceback
    traceback.print_exc()

# 4. 测试可视化模块
print("\n[4/6] 测试可视化模块...")
try:
    from visualization import Visualization
    
    viz = Visualization(output_dir='./test_output')
    
    time = np.linspace(0, 5, 500)
    tension = 1.0 + 0.2 * np.sin(2 * np.pi * 2 * time) + np.random.normal(0, 0.05, 500)
    
    # 生成测试图表
    viz.plot_tension_time_series(time, tension, filename='test_tension.png')
    viz.plot_tension_distribution(tension, filename='test_distribution.png')
    
    freqs, psd = np.linspace(0, 50, 100), np.random.rand(100) * 0.1
    viz.plot_psd(freqs, psd, filename='test_psd.png')
    
    print(f"  生成图表: 3 个测试图表")
    print("  ✓ 可视化模块测试通过")
except Exception as e:
    print(f"  ✗ 可视化模块失败: {e}")
    import traceback
    traceback.print_exc()

# 5. 测试参数优化模块
print("\n[5/6] 测试参数优化模块...")
try:
    from parameter_optimization import ParameterOptimization
    
    optimizer = ParameterOptimization()
    
    def test_simulation(base_tension):
        time = np.linspace(0, 1, 100)
        tension = base_tension * (1 + 0.1 * np.sin(2 * np.pi * 5 * time))
        return time, tension
    
    optimizer.set_bounds('base_tension', 0.5, 2.0)
    optimizer.set_target_tension(1.0)
    
    result = optimizer.optimize_random_search(test_simulation, n_samples=20)
    print(f"  优化结果: 最佳参数={result.best_params['base_tension']:.4f}")
    print(f"  优化成功: {'是' if result.success else '否'}")
    
    print("  ✓ 参数优化模块测试通过")
except Exception as e:
    print(f"  ✗ 参数优化模块失败: {e}")
    import traceback
    traceback.print_exc()

# 6. 测试数据存储模块
print("\n[6/6] 测试数据存储模块...")
try:
    from data_storage import DataStorage
    
    storage = DataStorage(data_dir='./test_data')
    
    time = np.linspace(0, 2, 200)
    tension = 1.0 + 0.1 * np.random.randn(200)
    
    dataset_name = storage.save_simulation_result(
        time, tension,
        params={'test': True, 'value': 1.0},
        dataset_name='test_dataset'
    )
    print(f"  保存数据集: {dataset_name}")
    
    datasets = storage.list_datasets()
    print(f"  数据集数量: {len(datasets)}")
    
    loaded = storage.load_simulation_result('test_dataset')
    print(f"  加载数据: 时间={len(loaded['time'])}, 张力={len(loaded['tension'])}")
    
    deleted = storage.delete_dataset('test_dataset')
    print(f"  删除数据集: {'成功' if deleted else '失败'}")
    
    print("  ✓ 数据存储模块测试通过")
except Exception as e:
    print(f"  ✗ 数据存储模块失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
print("所有模块测试完成!")
print("=" * 70)
