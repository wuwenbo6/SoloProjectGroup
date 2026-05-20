import sys
import numpy as np
from parameters import ParameterManager
from simulation import StressSimulation
from multi_joint_simulation import MultiJointStructure, create_frame_structure
from anomaly_detection import AnomalyDetector, WarningLevel
from data_comparison import DataComparator, generate_sample_test_data
from computation_optimizer import ComputationOptimizer, FastDataProcessor


def test_multi_joint_simulation():
    print("\n" + "="*60)
    print("🔗 测试1: 多榫卯结构协同受力模拟")
    print("="*60)
    
    try:
        structure = create_frame_structure(n_joints=3)
        
        structure.add_load(
            position=(0.45, 0, 0),
            magnitude=1500.0,
            direction=(0, -1, 0),
            load_type='concentrated'
        )
        
        results = structure.run_co_simulation()
        
        print(f"\n结构摘要:")
        print(f"  梁数量: {results['structure_summary']['n_beams']}")
        print(f"  榫卯数量: {results['structure_summary']['n_joints']}")
        print(f"  总载荷: {results['structure_summary']['total_load']:.0f} N")
        print(f"  整体最大应力: {results['structure_summary']['overall_max_stress_mpa']:.2f} MPa")
        print(f"  整体安全系数: {results['structure_summary']['overall_safety_factor']:.3f}")
        print(f"  总变形量: {results['structure_summary']['total_deformation_mm']:.3f} mm")
        
        print(f"\n各榫卯载荷分布:")
        for joint_id, load_info in results['load_distribution'].items():
            print(f"  {joint_id}: {load_info['total_load']:.1f} N "
                  f"(轴向: {load_info['axial_component']:.1f} N, "
                  f"剪切: {load_info['shear_component']:.1f} N)")
        
        print("\n✅ 多榫卯协同受力模拟测试通过")
        return True
        
    except Exception as e:
        print(f"\n❌ 多榫卯协同受力模拟测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_anomaly_detection():
    print("\n" + "="*60)
    print("⚠️  测试2: 受力过程异常预警")
    print("="*60)
    
    try:
        detector = AnomalyDetector()
        
        pm = ParameterManager()
        pm.set_structure_parameters(
            wood_type='oak',
            joint_type='mortise_tenon',
            beam_width=0.05,
            beam_height=0.05,
            beam_length=0.3,
            tenon_length=0.03,
            tenon_width=0.02,
            mortise_depth=0.015,
            load_magnitude=5000.0,
            load_direction='bending',
            friction_coefficient=0.5
        )
        
        sim = StressSimulation(pm)
        results = sim.run_simulation()
        
        warnings = detector.analyze_simulation_results(results)
        
        print(f"\n检测到 {len(warnings)} 个异常:")
        for warning in warnings:
            print(f"  [{warning.level.name}] {warning.category}: {warning.message}")
        
        print(f"\n异常摘要:")
        summary = detector.get_warning_summary()
        print(f"  总警告数: {summary['total_warnings']}")
        print(f"  按级别分布: {summary['by_level']}")
        print(f"  整体状态: {summary['overall_status']}")
        
        detector.clear_warnings()
        detector.set_threshold('safety_factor_min', 3.0)
        
        pm2 = ParameterManager()
        pm2.set_structure_parameters(
            wood_type='oak',
            joint_type='mortise_tenon',
            beam_width=0.05,
            beam_height=0.05,
            beam_length=0.3,
            tenon_length=0.03,
            tenon_width=0.02,
            mortise_depth=0.015,
            load_magnitude=500.0,
            load_direction='bending',
            friction_coefficient=0.5
        )
        
        sim2 = StressSimulation(pm2)
        results2 = sim2.run_simulation()
        
        warnings2 = detector.analyze_simulation_results(results2)
        
        print(f"\n正常工况测试:")
        print(f"  安全系数: {results2['safety_factors']['overall']:.3f}")
        print(f"  检测到警告: {len(warnings2)} 个")
        
        print("\n✅ 异常预警功能测试通过")
        return True
        
    except Exception as e:
        print(f"\n❌ 异常预警功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_data_comparison():
    print("\n" + "="*60)
    print("📊 测试3: 仿真与实验数据对比分析")
    print("="*60)
    
    try:
        pm = ParameterManager()
        pm.set_structure_parameters(
            wood_type='oak',
            joint_type='mortise_tenon',
            beam_width=0.05,
            beam_height=0.05,
            beam_length=0.3,
            tenon_length=0.03,
            tenon_width=0.02,
            mortise_depth=0.015,
            load_magnitude=1000.0,
            load_direction='bending',
            friction_coefficient=0.5
        )
        
        sim = StressSimulation(pm)
        sim_results = sim.run_simulation()
        
        test_data = generate_sample_test_data(n_points=10, noise_level=0.05)
        
        comparator = DataComparator(tolerance=15.0)
        comparator.load_simulation_data(sim_results)
        comparator.load_experimental_data(test_data)
        
        comparison_results = comparator.run_comparison()
        
        print(f"\n对比摘要:")
        summary = comparator.get_summary()
        print(f"  对比点数: {summary['total_comparisons']}")
        print(f"  通过: {summary['passed_count']}, 未通过: {summary['failed_count']}")
        print(f"  通过率: {summary['pass_rate']:.1f}%")
        print(f"  平均误差: {summary['mean_error_percent']:.2f}%")
        print(f"  最大误差: {summary['max_error_percent']:.2f}%")
        
        if 'correlation_coefficient' in summary:
            print(f"  相关系数: {summary['correlation_coefficient']:.4f}")
            print(f"  R²: {summary['r_squared']:.4f}")
        
        print(f"  验证状态: {summary['validation_status']}")
        
        correction = comparator.generate_correction_model()
        print(f"\n建议校正模型:")
        print(f"  缩放因子: {correction['scale_factor']:.4f}")
        print(f"  偏移量: {correction['offset']:.6g}")
        print(f"  置信度: {correction['confidence']:.1%}")
        
        outliers = comparator.identify_outliers(threshold=1.5)
        if outliers:
            print(f"\n检测到 {len(outliers)} 个异常点:")
            for outlier in outliers[:3]:
                print(f"  - {outlier.metric_name}: {outlier.error_percent:.1f}%")
        
        print("\n✅ 数据对比分析功能测试通过")
        return True
        
    except Exception as e:
        print(f"\n❌ 数据对比分析功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_computation_optimization():
    print("\n" + "="*60)
    print("⚡ 测试4: 数值计算速度优化")
    print("="*60)
    
    try:
        optimizer = ComputationOptimizer(
            use_vectorization=True,
            use_caching=True,
            chunk_size=1000
        )
        
        n_points = 50000
        x_coords = np.random.uniform(0, 0.3, n_points)
        y_coords = np.random.uniform(0, 0.05, n_points)
        
        print(f"\n应力场计算性能测试 ({n_points:,} 点):")
        
        optimizer.use_vectorization = False
        import time
        start = time.time()
        _ = optimizer._stress_calculation_serial(x_coords, y_coords, 1000, 0.05, 0.05, 0.3)
        serial_time = time.time() - start
        print(f"  串行计算: {serial_time*1000:.2f} ms")
        
        optimizer.use_vectorization = True
        start = time.time()
        results = optimizer.vectorize_stress_calculation(x_coords, y_coords, 1000, 0.05, 0.05, 0.3)
        vector_time = time.time() - start
        print(f"  向量化计算: {vector_time*1000:.2f} ms")
        
        speedup = serial_time / max(vector_time, 1e-10)
        print(f"  加速比: {speedup:.2f}x")
        
        print(f"\n梁属性缓存测试:")
        start = time.time()
        for i in range(100):
            _ = optimizer.get_beam_properties(0.05, 0.05, 0.3, 'oak')
        cache_time = time.time() - start
        print(f"  100次查询时间: {cache_time*1000:.2f} ms")
        
        print(f"\n参数化研究优化:")
        param_ranges = {
            'beam_width': (0.03, 0.07),
            'beam_height': (0.03, 0.07),
            'beam_length': (0.2, 0.4)
        }
        
        start = time.time()
        study_results = optimizer.optimize_parametric_study(
            param_ranges,
            n_samples_per_param=20
        )
        study_time = time.time() - start
        print(f"  60个样本计算时间: {study_time*1000:.2f} ms")
        print(f"  应力范围: {np.min(study_results['max_stress'])/1e6:.2f} - "
              f"{np.max(study_results['max_stress'])/1e6:.2f} MPa")
        
        processor = FastDataProcessor(dtype=np.float32)
        compressed = processor.compress_stress_data(results)
        original_size = sum(v.nbytes for v in results.values() if isinstance(v, np.ndarray))
        compressed_size = sum(v.nbytes for v in compressed.values() if isinstance(v, np.ndarray))
        compression_ratio = original_size / max(compressed_size, 1)
        
        print(f"\n数据压缩:")
        print(f"  原始大小: {original_size/1024/1024:.2f} MB")
        print(f"  压缩后大小: {compressed_size/1024/1024:.2f} MB")
        print(f"  压缩率: {compression_ratio:.2f}x")
        
        stats = processor.compute_statistics_fast(results['von_mises'])
        print(f"\n应力统计:")
        print(f"  均值: {stats['mean']/1e6:.2f} MPa")
        print(f"  标准差: {stats['std']/1e6:.2f} MPa")
        print(f"  最大值: {stats['max']/1e6:.2f} MPa")
        print(f"  95%分位数: {stats['percentile_95']/1e6:.2f} MPa")
        
        print("\n✅ 计算优化功能测试通过")
        return True
        
    except Exception as e:
        print(f"\n❌ 计算优化功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_all_tests():
    print("\n" + "="*70)
    print("🚀 榫卯结构受力模拟系统 - 新功能综合测试")
    print("="*70)
    
    tests = [
        ("多榫卯协同受力模拟", test_multi_joint_simulation),
        ("异常预警功能", test_anomaly_detection),
        ("数据对比分析", test_data_comparison),
        ("计算速度优化", test_computation_optimization)
    ]
    
    results = []
    for name, test_func in tests:
        results.append(test_func())
    
    print("\n" + "="*70)
    print("📋 测试总结")
    print("="*70)
    
    for i, (name, _) in enumerate(tests):
        status = "✅ 通过" if results[i] else "❌ 失败"
        print(f"  {i+1}. {name}: {status}")
    
    passed = sum(results)
    total = len(results)
    print(f"\n总计: {passed}/{total} 项测试通过")
    
    if passed == total:
        print("\n🎉 所有新功能测试通过！系统可以正常使用。")
    else:
        print(f"\n⚠️  有 {total - passed} 项测试未通过，请检查相关功能。")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
