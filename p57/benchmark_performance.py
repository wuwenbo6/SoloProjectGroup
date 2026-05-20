import sys
import os
import time
import numpy as np
import pandas as pd
import gc

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core import (
    BenchmarkSuite,
    PerformanceMonitor,
    MemoryOptimizer,
    MultiLevelCache,
    get_cache,
    get_monitor,
    DASK_AVAILABLE
)
from data_access.data_loader import DataManager
from visualization.dashboard import VisualizationDataValidator


def generate_test_data(n_rows=10000, n_cols=10):
    print(f"\n生成测试数据: {n_rows} 行, {n_cols} 列")
    
    np.random.seed(42)
    
    dates = pd.date_range('2020-01-01', periods=min(n_rows, 1000))
    if n_rows > len(dates):
        dates = np.tile(dates, (n_rows // len(dates) + 1))[:n_rows]
    
    data = {
        'material_type': np.random.choice(['牛皮', '驴皮', '羊皮', '马皮', '复合皮'], n_rows),
        'source': np.random.choice(['陕西', '河北', '山西', '四川', '浙江'], n_rows),
        'thickness': np.random.uniform(0.5, 3.0, n_rows),
        'tensile_strength': np.random.uniform(10, 50, n_rows),
        'water_content': np.random.uniform(5, 25, n_rows),
        'collagen_ratio': np.random.uniform(60, 95, n_rows),
        'age_years': np.random.randint(1, 200, n_rows),
        'storage_condition': np.random.choice(['干燥阴凉', '恒温恒湿', '自然环境'], n_rows),
        'collection_date': dates,
        'quality_score': np.random.uniform(0, 100, n_rows)
    }
    
    df = pd.DataFrame(data)
    print(f"测试数据生成完成，大小: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB")
    return df


def benchmark_memory_optimization(df):
    print("\n" + "="*70)
    print("📊 内存优化性能基准测试")
    print("="*70)
    
    original_memory = df.memory_usage(deep=True).sum() / 1024 / 1024
    print(f"\n原始内存占用: {original_memory:.2f} MB")
    
    start_time = time.time()
    optimized_df = MemoryOptimizer.optimize_dataframe(df, verbose=False)
    optimization_time = time.time() - start_time
    
    optimized_memory = optimized_df.memory_usage(deep=True).sum() / 1024 / 1024
    savings_percent = (1 - optimized_memory / original_memory) * 100
    
    print(f"优化后内存占用: {optimized_memory:.2f} MB")
    print(f"节省: {savings_percent:.1f}% ({original_memory - optimized_memory:.2f} MB)")
    print(f"优化耗时: {optimization_time:.4f} 秒")
    
    return {
        'original_memory_mb': original_memory,
        'optimized_memory_mb': optimized_memory,
        'savings_percent': savings_percent,
        'optimization_time_sec': optimization_time
    }


def benchmark_cache_system(df):
    print("\n" + "="*70)
    print("💾 缓存系统性能基准测试")
    print("="*70)
    
    cache = MultiLevelCache(memory_cache_size=100)
    
    cache_key = 'test_dataframe'
    large_object = {'data': df, 'metadata': {'test': True, 'timestamp': time.time()}}
    
    print("\n测试缓存写入性能:")
    start_time = time.time()
    cache.put(cache_key, large_object, ttl_seconds=60)
    write_time = time.time() - start_time
    print(f"写入耗时: {write_time:.4f} 秒")
    
    print("\n测试缓存读取性能:")
    start_time = time.time()
    cached_obj = cache.get(cache_key)
    read_time = time.time() - start_time
    print(f"读取耗时: {read_time:.4f} 秒")
    print(f"读取成功: {cached_obj is not None}")
    
    print("\n测试连续读取性能:")
    read_times = []
    for i in range(100):
        start_time = time.time()
        _ = cache.get(cache_key)
        read_times.append(time.time() - start_time)
    
    print(f"平均读取耗时: {np.mean(read_times):.6f} 秒")
    print(f"最小读取耗时: {np.min(read_times):.6f} 秒")
    print(f"最大读取耗时: {np.max(read_times):.6f} 秒")
    
    stats = cache.get_stats()
    print(f"\n缓存统计:")
    print(f"  缓存命中率: {stats['memory_cache'].get('hit_rate', 0):.1%}")
    print(f"  内存缓存大小: {stats['memory_cache'].get('size', 0)}")
    
    return {
        'write_time_sec': write_time,
        'read_time_sec': read_time,
        'avg_read_time_sec': np.mean(read_times),
        'hit_rate': stats['memory_cache'].get('hit_rate', 0)
    }


def benchmark_visualization_optimization(df):
    print("\n" + "="*70)
    print("📈 可视化优化性能基准测试")
    print("="*70)
    
    validator = VisualizationDataValidator()
    
    print(f"\n原始数据大小: {len(df)} 行")
    
    start_time = time.time()
    optimized_df = validator.optimize_for_visualization(df, sample_size=5000)
    optimize_time = time.time() - start_time
    
    print(f"可视化优化耗时: {optimize_time:.4f} 秒")
    print(f"优化后数据大小: {len(optimized_df)} 行")
    
    print("\n测试分层采样性能:")
    start_time = time.time()
    sampled_df = validator.sample_large_data(df, max_rows=1000, method='stratified')
    sample_time = time.time() - start_time
    print(f"分层采样耗时: {sample_time:.4f} 秒")
    print(f"采样后数据大小: {len(sampled_df)} 行")
    
    print("\n测试热力图聚合性能:")
    start_time = time.time()
    heatmap_df = validator.aggregate_for_heatmap(df, 'material_type', 'source', 'tensile_strength')
    heatmap_time = time.time() - start_time
    print(f"热力图聚合耗时: {heatmap_time:.4f} 秒")
    print(f"聚合后热力图大小: {heatmap_df.shape}")
    
    return {
        'visual_optimize_time_sec': optimize_time,
        'sampling_time_sec': sample_time,
        'heatmap_agg_time_sec': heatmap_time,
        'original_size': len(df),
        'optimized_size': len(optimized_df)
    }


def benchmark_data_loading(df, temp_file_path):
    print("\n" + "="*70)
    print("📦 数据加载性能基准测试")
    print("="*70)
    
    df.to_csv(temp_file_path, index=False, encoding='utf-8-sig')
    file_size = os.path.getsize(temp_file_path) / 1024 / 1024
    print(f"\n测试文件大小: {file_size:.2f} MB")
    
    data_manager = DataManager(use_cache=False)
    
    print("\n测试标准加载性能:")
    start_time = time.time()
    loaded_df = data_manager.load_from_file(temp_file_path)
    load_time = time.time() - start_time
    print(f"加载耗时: {load_time:.4f} 秒")
    print(f"加载数据行数: {len(loaded_df)}")
    
    print("\n测试缓存加载性能:")
    data_manager_with_cache = DataManager(use_cache=True)
    _ = data_manager_with_cache.load_from_file(temp_file_path)
    
    start_time = time.time()
    cached_df = data_manager_with_cache.load_from_file(temp_file_path)
    cache_load_time = time.time() - start_time
    print(f"缓存加载耗时: {cache_load_time:.4f} 秒")
    
    speedup = load_time / cache_load_time if cache_load_time > 0 else float('inf')
    print(f"缓存加速比: {speedup:.2f}x")
    
    return {
        'standard_load_time_sec': load_time,
        'cache_load_time_sec': cache_load_time,
        'speedup': speedup,
        'file_size_mb': file_size
    }


def benchmark_dask_parallel_processing(df, temp_file_path):
    print("\n" + "="*70)
    print("⚡ Dask并行处理性能基准测试")
    print("="*70)
    
    if not DASK_AVAILABLE:
        print("\n⚠️  Dask未安装，跳过并行处理测试")
        return None
    
    df.to_csv(temp_file_path, index=False, encoding='utf-8-sig')
    
    from core import DaskParallelProcessor
    
    print("\n测试Dask并行加载:")
    start_time = time.time()
    with DaskParallelProcessor(memory_limit='4GB') as processor:
        ddf = processor.load_csv_parallel(temp_file_path, chunk_size='10MB')
        result_df = processor.compute(ddf)
    dask_load_time = time.time() - start_time
    print(f"Dask加载耗时: {dask_load_time:.4f} 秒")
    print(f"分区数量: {ddf.npartitions}")
    
    print("\n测试Pandas串行加载对比:")
    start_time = time.time()
    pandas_df = pd.read_csv(temp_file_path)
    pandas_load_time = time.time() - start_time
    print(f"Pandas加载耗时: {pandas_load_time:.4f} 秒")
    
    load_speedup = pandas_load_time / dask_load_time if dask_load_time > 0 else 0
    print(f"加载加速比: {load_speedup:.2f}x")
    
    print("\n测试Dask并行特征转换:")
    def feature_transform(partition):
        partition['new_feature1'] = partition['thickness'] * partition['tensile_strength']
        partition['new_feature2'] = partition['collagen_ratio'] / partition['water_content']
        partition['new_feature3'] = np.log1p(partition['age_years'])
        return partition
    
    start_time = time.time()
    with DaskParallelProcessor(memory_limit='4GB') as processor:
        ddf = processor.load_csv_parallel(temp_file_path, chunk_size='10MB')
        ddf_transformed = processor.apply_parallel(ddf, feature_transform)
        result_transformed = processor.compute(ddf_transformed)
    dask_transform_time = time.time() - start_time
    print(f"Dask并行转换耗时: {dask_transform_time:.4f} 秒")
    
    print("\n测试Pandas串行转换对比:")
    start_time = time.time()
    pandas_transformed = feature_transform(pandas_df.copy())
    pandas_transform_time = time.time() - start_time
    print(f"Pandas串行转换耗时: {pandas_transform_time:.4f} 秒")
    
    transform_speedup = pandas_transform_time / dask_transform_time if dask_transform_time > 0 else 0
    print(f"转换加速比: {transform_speedup:.2f}x")
    
    return {
        'dask_load_time_sec': dask_load_time,
        'pandas_load_time_sec': pandas_load_time,
        'load_speedup': load_speedup,
        'dask_transform_time_sec': dask_transform_time,
        'pandas_transform_time_sec': pandas_transform_time,
        'transform_speedup': transform_speedup,
        'n_partitions': ddf.npartitions
    }


def benchmark_end_to_end_performance():
    print("\n" + "="*70)
    print("🏁 端到端性能基准测试")
    print("="*70)
    
    monitor = get_monitor()
    
    monitor.start_timer('end_to_end')
    
    monitor.start_timer('data_loading')
    data_manager = DataManager(use_cache=True)
    material_df = data_manager.load_from_museum()
    pigment_df = data_manager.get_pigment_data()
    monitor.end_timer('data_loading')
    
    print(f"\n数据加载完成，材质数据: {len(material_df)} 行，颜料数据: {len(pigment_df)} 行")
    
    monitor.start_timer('analysis')
    from analysis.material_analyzer import EnhancedAnalysisManager
    analyzer = EnhancedAnalysisManager(enable_cache=True)
    results = analyzer.run_enhanced_analysis(material_df, pigment_df,
                                              enable_aging_prediction=True,
                                              enable_similarity_search=True)
    monitor.end_timer('analysis')
    print(f"分析完成，结果包含: {list(results.keys())}")
    
    monitor.start_timer('visualization_prep')
    validator = VisualizationDataValidator()
    opt_material = validator.optimize_for_visualization(material_df)
    opt_pigment = validator.optimize_for_visualization(pigment_df)
    monitor.end_timer('visualization_prep')
    print(f"可视化准备完成，优化后材质数据: {len(opt_material)} 行，颜料数据: {len(opt_pigment)} 行")
    
    total_time = monitor.end_timer('end_to_end')
    print(f"\n端到端总耗时: {total_time:.4f} 秒")
    
    all_metrics = monitor.get_all_metrics()
    print("\n详细性能指标:")
    for name, metric in all_metrics.items():
        print(f"  {name}:")
        print(f"    调用次数: {metric['count']}")
        print(f"    总耗时: {metric['total_time']:.4f} 秒")
        print(f"    平均耗时: {metric['avg_time']:.4f} 秒")
    
    return all_metrics


def run_full_benchmark():
    print("\n" + "="*70)
    print("🎯 皮影戏材质分析系统 - 完整性能基准测试")
    print("="*70)
    
    test_sizes = [1000, 10000, 100000]
    all_results = {}
    
    for size in test_sizes:
        print(f"\n\n{'='*70}")
        print(f"测试数据规模: {size} 行")
        print('='*70)
        
        df = generate_test_data(n_rows=size)
        temp_file = f'temp_test_data_{size}.csv'
        
        try:
            results = {}
            results['memory_optimization'] = benchmark_memory_optimization(df)
            results['cache_system'] = benchmark_cache_system(df)
            results['visualization'] = benchmark_visualization_optimization(df)
            results['data_loading'] = benchmark_data_loading(df, temp_file)
            results['dask_parallel'] = benchmark_dask_parallel_processing(df, temp_file)
            
            all_results[size] = results
            
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
            gc.collect()
    
    print("\n\n" + "="*70)
    print("🏆 性能基准测试结果汇总")
    print("="*70)
    
    for size in test_sizes:
        print(f"\n{'='*70}")
        print(f"数据规模: {size} 行")
        print('='*70)
        
        results = all_results[size]
        
        print("\n📊 内存优化:")
        if 'memory_optimization' in results:
            mem = results['memory_optimization']
            print(f"  节省: {mem['savings_percent']:.1f}%")
            print(f"  耗时: {mem['optimization_time_sec']:.4f} 秒")
        
        print("\n💾 缓存系统:")
        if 'cache_system' in results:
            cache = results['cache_system']
            print(f"  缓存加速: {(1/cache['avg_read_time_sec']):.0f}x")
            print(f"  命中率: {cache['hit_rate']:.1%}")
        
        print("\n📈 可视化优化:")
        if 'visualization' in results:
            vis = results['visualization']
            print(f"  优化耗时: {vis['visual_optimize_time_sec']:.4f} 秒")
            print(f"  采样耗时: {vis['sampling_time_sec']:.4f} 秒")
        
        print("\n📦 数据加载:")
        if 'data_loading' in results:
            load = results['data_loading']
            print(f"  标准加载: {load['standard_load_time_sec']:.4f} 秒")
            print(f"  缓存加载: {load['cache_load_time_sec']:.4f} 秒")
            print(f"  加速比: {load['speedup']:.2f}x")
        
        if results.get('dask_parallel'):
            print("\n⚡ Dask并行处理:")
            dask = results['dask_parallel']
            print(f"  加载加速比: {dask['load_speedup']:.2f}x")
            print(f"  转换加速比: {dask['transform_speedup']:.2f}x")
    
    print("\n\n运行端到端性能测试...")
    benchmark_end_to_end_performance()
    
    print("\n" + "="*70)
    print("✅ 性能基准测试完成!")
    print("="*70)


if __name__ == '__main__':
    run_full_benchmark()
