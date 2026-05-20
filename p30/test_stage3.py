#!/usr/bin/env python3
"""
第三阶段综合测试 - 重构边缘端AI推理链路和系统稳定性增强
"""

import time
import sys
import logging
import numpy as np
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

TEST_RESULTS = {}


class SimpleModel:
    """简单测试模型"""
    
    def __init__(self, name="TestModel", delay_ms=50, failure_rate=0.0):
        self.name = name
        self.delay_ms = delay_ms
        self.failure_rate = failure_rate
        self.call_count = 0
    
    def predict(self, x: np.ndarray) -> tuple:
        """预测方法"""
        self.call_count += 1
        
        time.sleep(self.delay_ms / 1000.0)
        
        if self.failure_rate > 0 and np.random.random() < self.failure_rate:
            raise RuntimeError(f"Model {self.name} prediction failed!")
        
        if isinstance(x, np.ndarray):
            result = np.mean(x)
        else:
            result = float(sum(x)) / len(x) if x else 0.0
        
        confidence = 0.7 + 0.3 * np.random.random()
        return (result, confidence)


def test_inference_pipeline():
    """测试1: 推理流水线"""
    print("\n" + "=" * 70)
    print("测试1: 推理流水线 - 异步处理、队列、批量优化")
    print("=" * 70)
    
    try:
        from edge.inference.inference_pipeline import (
            InferencePipeline, BatchInferenceOptimizer, DynamicBatcher
        )
        
        model = SimpleModel("PipelineTest", delay_ms=20)
        pipeline = InferencePipeline(
            model,
            max_queue_size=100,
            preprocess_workers=1,
            inference_workers=2,
            postprocess_workers=1
        )
        
        pipeline.start()
        print("  ✓ 推理流水线启动成功")
        
        test_images = [np.random.rand(64, 64, 3).astype(np.float32) for _ in range(10)]
        
        start_time = time.time()
        task_ids = []
        for i, img in enumerate(test_images):
            task_id = pipeline.submit(img, metadata={'index': i})
            task_ids.append(task_id)
        
        print(f"  ✓ 已提交 {len(task_ids)} 个推理任务")
        
        results = []
        for task_id in task_ids:
            result = pipeline.get_result(task_id, timeout=5.0)
            if result:
                results.append(result)
        
        elapsed = time.time() - start_time
        
        print(f"  ✓ 完成 {len(results)} 个推理任务")
        print(f"  ✓ 总耗时: {elapsed:.3f}s")
        print(f"  ✓ 平均吞吐量: {len(results)/elapsed:.2f} tasks/s")
        
        stats = pipeline.get_stats()
        print(f"  ✓ 流水线统计:")
        print(f"    - 总任务数: {stats.total_tasks}")
        print(f"    - 已完成: {stats.completed_tasks}")
        print(f"    - 平均延迟: {stats.avg_latency_ms:.2f}ms")
        print(f"    - 吞吐量: {stats.throughput_per_sec:.2f}/s")
        
        pipeline.stop()
        
        TEST_RESULTS['inference_pipeline'] = {
            'status': 'PASS',
            'tasks_completed': len(results),
            'throughput': len(results)/elapsed
        }
        print("\n  ✓ 推理流水线测试通过!")
        return True
        
    except Exception as e:
        print(f"  ✗ 推理流水线测试失败: {e}")
        import traceback
        traceback.print_exc()
        TEST_RESULTS['inference_pipeline'] = {'status': 'FAIL', 'error': str(e)}
        return False


def test_model_compression():
    """测试2: 模型轻量化压缩"""
    print("\n" + "=" * 70)
    print("测试2: 模型轻量化压缩 - 量化、剪枝、知识蒸馏")
    print("=" * 70)
    
    try:
        from edge.inference.model_compression import (
            Quantizer, Pruner, KnowledgeDistiller, ModelCompressor,
            QuantizationType, PruningType, ModelSizeEstimator
        )
        
        model = SimpleModel("CompressionTest", delay_ms=10)
        teacher_model = SimpleModel("Teacher", delay_ms=10)
        student_model = SimpleModel("Student", delay_ms=5)
        
        quantizer = Quantizer(model)
        quantizer.quantize_int8()
        print("  ✓ INT8量化配置完成")
        
        quantized_model = quantizer.get_quantized_model()
        print(f"  ✓ 量化模型类型: {quantized_model.quant_type.value}")
        
        pruner = Pruner(model)
        pruner.prune_unstructured(pruning_ratio=0.5)
        print("  ✓ 非结构化剪枝配置完成 (50%)")
        
        pruned_model = pruner.get_pruned_model()
        print(f"  ✓ 剪枝模型类型: {pruned_model.prune_type.value}")
        
        distiller = KnowledgeDistiller(teacher_model, student_model)
        print("  ✓ 知识蒸馏器配置完成")
        
        compressor = ModelCompressor(model)
        compressor.apply_quantization(QuantizationType.INT8)
        compressor.apply_pruning(PruningType.UNSTRUCTURED, 0.5)
        print("  ✓ 模型压缩器执行完成")
        
        stats = compressor.get_compression_stats()
        print(f"  ✓ 压缩统计:")
        print(f"    - 原始大小: {stats.original_size_mb:.2f} MB")
        print(f"    - 压缩后大小: {stats.compressed_size_mb:.4f} MB")
        print(f"    - 压缩比: {stats.compression_ratio:.1f}x")
        print(f"    - 加速比: {stats.speedup_ratio:.1f}x")
        print(f"    - 精度损失: {stats.accuracy_drop:.2%}")
        
        size_est = ModelSizeEstimator()
        rec = size_est.recommend_optimization(
            target_latency_ms=50,
            target_size_mb=5,
            current_latency_ms=100,
            current_size_mb=20
        )
        print(f"  ✓ 推荐策略数量: {len(rec['recommendations'])}")
        
        TEST_RESULTS['model_compression'] = {
            'status': 'PASS',
            'compression_ratio': stats.compression_ratio,
            'speedup_ratio': stats.speedup_ratio
        }
        print("\n  ✓ 模型轻量化压缩测试通过!")
        return True
        
    except Exception as e:
        print(f"  ✗ 模型轻量化压缩测试失败: {e}")
        import traceback
        traceback.print_exc()
        TEST_RESULTS['model_compression'] = {'status': 'FAIL', 'error': str(e)}
        return False


def test_data_sync():
    """测试3: 数据同步协议优化"""
    print("\n" + "=" * 70)
    print("测试3: 数据同步协议优化 - 压缩、增量、批量")
    print("=" * 70)
    
    try:
        from edge.sync.data_sync import (
            DataCompressor, DeltaEncoder, IncrementalSyncManager,
            BatchAggregator, OptimizedSyncProtocol,
            CompressionAlgorithm, SyncMode
        )
        
        compressor = DataCompressor()
        
        test_data = b"x" * 10000
        compressed, stats = compressor.compress(test_data, CompressionAlgorithm.ZLIB)
        print(f"  ✓ ZLIB压缩: {len(test_data)} -> {len(compressed)} bytes")
        print(f"    压缩比: {stats['compression_ratio']:.2f}x")
        
        compressed_gz, stats_gz = compressor.compress(test_data, CompressionAlgorithm.GZIP)
        print(f"  ✓ GZIP压缩: {len(test_data)} -> {len(compressed_gz)} bytes")
        print(f"    压缩比: {stats_gz['compression_ratio']:.2f}x")
        
        decompressed = compressor.decompress(compressed, CompressionAlgorithm.ZLIB)
        assert decompressed == test_data, "压缩后解压数据不一致"
        print("  ✓ 压缩-解压一致性验证通过")
        
        sync_manager = IncrementalSyncManager()
        
        data_v1 = b"Version 1 data: initial content"
        data_v2 = b"Version 2 data: updated content"
        
        sync_prep1 = sync_manager.prepare_sync("test_record", data_v1, "data")
        print(f"  ✓ 首次同步准备: version={sync_prep1['version']}, mode={sync_prep1['sync_mode']}")
        
        sync_prep2 = sync_manager.prepare_sync("test_record", data_v2, "data")
        print(f"  ✓ 增量同步准备: version={sync_prep2['version']}, mode={sync_prep2['sync_mode']}")
        
        aggregator = BatchAggregator(max_batch_size=10000, max_wait_time=0.1)
        
        for i in range(5):
            item = {'id': i, 'data': b"item data " + str(i).encode()}
            added = aggregator.add_item(item)
            if not added:
                print(f"  ! 批次已满，刷新批次")
                batch = aggregator.flush()
                print(f"    - 刷新批次大小: {len(batch)} items")
        
        current_stats = aggregator.get_current_stats()
        print(f"  ✓ 批量聚合器统计: queue_size={current_stats['queue_size']}")
        
        protocol = OptimizedSyncProtocol()
        protocol.start()
        
        for i in range(10):
            record_id = f"sync_item_{i}"
            data = {"index": i, "timestamp": time.time(), "payload": "x" * 100}
            queued = protocol.queue_sync(record_id, data, "test_data")
            if not queued:
                print(f"  ! 排队失败: {record_id}")
        
        time.sleep(0.15)
        
        protocol.force_sync()
        print("  ✓ 强制同步完成")
        
        sync_stats = protocol.get_stats()
        print(f"  ✓ 同步协议统计:")
        print(f"    - 总发送数据: {sync_stats.total_data_sent} bytes")
        print(f"    - 压缩后发送: {sync_stats.compressed_data_sent} bytes")
        print(f"    - 节省带宽: {sync_stats.bandwidth_saved} bytes")
        print(f"    - 压缩比: {sync_stats.compression_ratio:.2f}x")
        print(f"    - 同步次数: {sync_stats.sync_count}")
        
        protocol.stop()
        
        TEST_RESULTS['data_sync'] = {
            'status': 'PASS',
            'compression_ratio': stats['compression_ratio'],
            'bandwidth_saved': sync_stats.bandwidth_saved
        }
        print("\n  ✓ 数据同步协议优化测试通过!")
        return True
        
    except Exception as e:
        print(f"  ✗ 数据同步协议优化测试失败: {e}")
        import traceback
        traceback.print_exc()
        TEST_RESULTS['data_sync'] = {'status': 'FAIL', 'error': str(e)}
        return False


def test_fault_diagnosis():
    """测试4: 故障自动诊断与重启"""
    print("\n" + "=" * 70)
    print("测试4: 故障自动诊断与重启 - 心跳、监控、恢复")
    print("=" * 70)
    
    try:
        from edge.monitoring.fault_diagnosis import (
            HeartbeatManager, ResourceMonitor, ProcessMonitor,
            FaultDiagnoser, RecoveryEngine, AutoRestartManager,
            FaultMonitorDaemon, DeviceInfo, FaultType, FaultSeverity,
            RecoveryAction, HealthStatus
        )
        
        heartbeat_manager = HeartbeatManager()
        heartbeat_manager.start()
        
        device = DeviceInfo(
            device_id="test_device_001",
            device_name="TestDevice",
            device_type="camera",
            ip_address="192.168.1.100",
            heartbeat_interval=1.0,
            heartbeat_timeout=5.0
        )
        heartbeat_manager.register_device(device)
        print("  ✓ 设备注册成功")
        
        heartbeat_manager.update_heartbeat("test_device_001")
        timed_out = heartbeat_manager.check_timeouts()
        print(f"  ✓ 心跳更新成功，超时设备数: {len(timed_out)}")
        
        resource_monitor = ResourceMonitor(
            cpu_threshold=90.0,
            memory_threshold=90.0,
            disk_threshold=95.0
        )
        
        metrics = resource_monitor.collect_metrics()
        print(f"  ✓ 资源指标收集: CPU={metrics.cpu_percent:.1f}%, "
              f"内存={metrics.memory_percent:.1f}%, 磁盘={metrics.disk_percent:.1f}%")
        
        anomalies = resource_monitor.detect_anomalies(metrics)
        print(f"  ✓ 异常检测: 发现 {len(anomalies)} 个异常")
        
        history = resource_monitor.get_history(minutes=1)
        print(f"  ✓ 历史数据: {len(history)} 条记录")
        
        process_monitor = ProcessMonitor()
        crashed = process_monitor.check_processes()
        print(f"  ✓ 进程检查完成: 发现 {len(crashed)} 个崩溃进程")
        
        diagnoser = FaultDiagnoser()
        test_anomalies = [
            {
                'type': FaultType.HIGH_CPU.value,
                'severity': FaultSeverity.WARNING.value,
                'description': "CPU usage high for testing",
                'value': 85.0,
                'threshold': 80.0
            }
        ]
        faults = diagnoser.diagnose(test_anomalies, [])
        print(f"  ✓ 故障诊断: 生成 {len(faults)} 个故障记录")
        
        recovery_engine = RecoveryEngine()
        
        restart_manager = AutoRestartManager()
        restart_manager.set_policy(
            FaultType.HIGH_CPU.value,
            min_interval=60.0,
            max_restarts=3
        )
        should_restart, should_escalate = restart_manager.should_restart(FaultType.HIGH_CPU.value)
        print(f"  ✓ 重启策略检查: should_restart={should_restart}, should_escalate={should_escalate}")
        
        monitor_daemon = FaultMonitorDaemon(check_interval=0.5)
        health_before = monitor_daemon.get_health_status()
        print(f"  ✓ 初始健康状态: {health_before['status']}")
        
        monitor_daemon.start()
        time.sleep(0.6)
        
        health_after = monitor_daemon.get_health_status()
        print(f"  ✓ 监控后健康状态: {health_after['status']}")
        print(f"    - 活跃故障数: {health_after['active_faults']}")
        
        monitor_daemon.stop()
        heartbeat_manager.stop()
        
        TEST_RESULTS['fault_diagnosis'] = {
            'status': 'PASS',
            'health_status': health_after['status'],
            'faults_detected': len(faults)
        }
        print("\n  ✓ 故障自动诊断与重启测试通过!")
        return True
        
    except Exception as e:
        print(f"  ✗ 故障自动诊断与重启测试失败: {e}")
        import traceback
        traceback.print_exc()
        TEST_RESULTS['fault_diagnosis'] = {'status': 'FAIL', 'error': str(e)}
        return False


def test_stability_enhancement():
    """测试5: 系统稳定性增强"""
    print("\n" + "=" * 70)
    print("测试5: 系统稳定性增强 - 重试、熔断、限流、降级")
    print("=" * 70)
    
    try:
        from edge.stability.stability_enhancer import (
            RetryHandler, CircuitBreaker, RateLimiter, Bulkhead,
            FallbackHandler, TimeoutHandler, StabilityManager,
            RetryConfig, CircuitBreakerConfig, RateLimitConfig, BulkheadConfig,
            RetryStrategy, CircuitState, DegradationLevel, ErrorCategory,
            ErrorClassifier, with_stability
        )
        
        retry_config = RetryConfig(
            max_attempts=3,
            initial_delay=0.01,
            strategy=RetryStrategy.EXPONENTIAL,
            max_delay=0.1,
            jitter=False
        )
        retry_handler = RetryHandler(retry_config)
        
        call_count = [0]
        def flaky_operation():
            call_count[0] += 1
            if call_count[0] < 3:
                raise ConnectionError("Temporary error")
            return "success"
        
        result = retry_handler.execute(flaky_operation, operation_name="flaky_test")
        print(f"  ✓ 重试机制: 重试 {call_count[0]-1} 次后成功")
        assert result == "success"
        
        cb_config = CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=2,
            reset_timeout=1.0,
            half_open_max_calls=2
        )
        circuit_breaker = CircuitBreaker("test_cb", cb_config)
        
        print(f"  ✓ 断路器初始状态: {circuit_breaker.state.value}")
        assert circuit_breaker.state == CircuitState.CLOSED
        
        for i in range(3):
            circuit_breaker.record_failure(RuntimeError("test error"))
        
        print(f"  ✓ 断路器状态: {circuit_breaker.state.value} (触发阈值后)")
        assert circuit_breaker.state == CircuitState.OPEN, f"Expected OPEN, got {circuit_breaker.state}"
        assert not circuit_breaker.can_execute()
        
        time.sleep(1.1)
        can_execute = circuit_breaker.can_execute()
        print(f"  ✓ 断路器状态: {circuit_breaker.state.value} (重置超时后)")
        assert circuit_breaker.state == CircuitState.HALF_OPEN, f"Expected HALF_OPEN, got {circuit_breaker.state}"
        
        circuit_breaker.record_success()
        circuit_breaker.record_success()
        print(f"  ✓ 断路器状态: {circuit_breaker.state.value} (成功恢复后)")
        assert circuit_breaker.state == CircuitState.CLOSED
        
        rl_config = RateLimitConfig(
            max_requests=10,
            time_window=1.0,
            max_burst=5,
            enable_burst=True
        )
        rate_limiter = RateLimiter("test_rl", rl_config)
        
        acquired = 0
        for i in range(15):
            if rate_limiter.try_acquire():
                acquired += 1
        
        print(f"  ✓ 限流机制: 成功获取 {acquired}/15 次")
        assert acquired >= 10
        
        bh_config = BulkheadConfig(
            max_concurrent_calls=3,
            max_queue_size=10,
            timeout_seconds=1.0
        )
        bulkhead = Bulkhead("test_bh", bh_config)
        
        for i in range(3):
            assert bulkhead.acquire(timeout=0.1)
        print(f"  ✓ 舱壁模式: 成功获取 3 个并发调用")
        
        assert not bulkhead.acquire(timeout=0.1)
        print(f"  ✓ 舱壁模式: 第 4 个调用被正确拒绝")
        
        for i in range(3):
            bulkhead.release(latency_ms=100.0)
        
        fallback_handler = FallbackHandler()
        
        def primary_operation():
            raise RuntimeError("Primary failed")
        
        def fallback_operation():
            return "fallback_result"
        
        fallback_handler.register_fallback("test_op", fallback_operation)
        result, degraded = fallback_handler.execute_with_fallback(
            primary_operation, "test_op"
        )
        print(f"  ✓ 降级机制: 降级结果='{result}', was_degraded={degraded}")
        assert degraded
        assert result == "fallback_result"
        
        timeout_handler = TimeoutHandler(default_timeout=0.5)
        
        def slow_operation():
            time.sleep(1.0)
            return "done"
        
        try:
            timeout_handler.execute_with_timeout(slow_operation, timeout=0.2, operation_name="slow_test")
            assert False, "Should have timed out"
        except TimeoutError:
            print("  ✓ 超时机制: 正确抛出超时异常")
        
        is_retryable = ErrorClassifier.is_retryable(ConnectionError("Network error"))
        print(f"  ✓ 错误分类: ConnectionError 可重试={is_retryable}")
        assert is_retryable
        
        is_retryable = ErrorClassifier.is_retryable(ValueError("Invalid input"))
        print(f"  ✓ 错误分类: ValueError 可重试={is_retryable}")
        assert not is_retryable
        
        manager = StabilityManager()
        
        manager.configure_retry("api_call", RetryConfig(max_attempts=3, initial_delay=0.01))
        manager.configure_circuit_breaker("api_call", CircuitBreakerConfig(failure_threshold=3))
        manager.configure_rate_limiter("api_call", RateLimitConfig(max_requests=100, time_window=60))
        manager.configure_bulkhead("api_call", BulkheadConfig(max_concurrent_calls=5))
        
        def stable_operation():
            return "stable_result"
        
        result = manager.execute_stable(
            stable_operation,
            "api_call",
            enable_retry=True,
            enable_circuit_breaker=True,
            enable_rate_limit=True,
            enable_bulkhead=True,
            enable_timeout=True,
            enable_fallback=False
        )
        print(f"  ✓ 稳定执行结果: {result}")
        assert result == "stable_result"
        
        health = manager.health_check()
        print(f"  ✓ 健康检查: 总体健康状态={health['overall_health']}")
        assert health['overall_health'] == 'healthy'
        
        stats = manager.get_all_stats()
        print(f"  ✓ 综合统计:")
        print(f"    - 操作数: {len(stats['operation_stats'])}")
        print(f"    - 断路器数: {len(stats['circuit_breakers'])}")
        print(f"    - 限流器数: {len(stats['rate_limiters'])}")
        print(f"    - 舱壁数: {len(stats['bulkheads'])}")
        
        TEST_RESULTS['stability_enhancement'] = {
            'status': 'PASS',
            'retry_count': call_count[0]-1,
            'health_status': health['overall_health']
        }
        print("\n  ✓ 系统稳定性增强测试通过!")
        return True
        
    except Exception as e:
        print(f"  ✗ 系统稳定性增强测试失败: {e}")
        import traceback
        traceback.print_exc()
        TEST_RESULTS['stability_enhancement'] = {'status': 'FAIL', 'error': str(e)}
        return False


def print_summary():
    """打印测试总结"""
    print("\n" + "=" * 70)
    print("第三阶段测试总结")
    print("=" * 70)
    
    passed = sum(1 for r in TEST_RESULTS.values() if r['status'] == 'PASS')
    total = len(TEST_RESULTS)
    
    print(f"\n通过测试: {passed}/{total}")
    print("\n详细结果:")
    
    for test_name, result in TEST_RESULTS.items():
        status = "✓ PASS" if result['status'] == 'PASS' else "✗ FAIL"
        print(f"  {test_name:40s} : {status}")
        
        if result['status'] == 'PASS':
            for key, value in result.items():
                if key != 'status':
                    if isinstance(value, float):
                        print(f"      {key}: {value:.4f}")
                    else:
                        print(f"      {key}: {value}")
        else:
            print(f"      错误: {result.get('error', 'Unknown')}")
    
    print("\n" + "=" * 70)
    if passed == total:
        print("🎉 第三阶段所有测试通过!")
    else:
        print(f"⚠️  有 {total - passed} 个测试失败")
    print("=" * 70)
    
    return passed == total


def main():
    """主测试函数"""
    print("\n" + "*" * 70)
    print("*" + " " * 68 + "*")
    print("*" + " " * 15 + "农业病虫害边缘计算系统" + " " * 20 + "*")
    print("*" + " " * 20 + "第三阶段测试" + " " * 28 + "*")
    print("*" + " " * 68 + "*")
    print("*" + " " * 5 + "功能: 推理链路重构、模型压缩、同步优化、故障诊断、稳定性增强" + " " * 2 + "*")
    print("*" + " " * 68 + "*")
    print("*" * 70 + "\n")
    
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python 版本: {sys.version.split()[0]}")
    
    all_passed = True
    
    all_passed &= test_inference_pipeline()
    all_passed &= test_model_compression()
    all_passed &= test_data_sync()
    all_passed &= test_fault_diagnosis()
    all_passed &= test_stability_enhancement()
    
    final_success = print_summary()
    
    return 0 if final_success else 1


if __name__ == "__main__":
    exit(main())
