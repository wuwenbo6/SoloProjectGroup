#!/usr/bin/env python3
"""
GPU显存清理测试脚本
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.memory_manager import memory_manager


def test_memory_cleanup():
    print("=" * 60)
    print("GPU 显存清理测试")
    print("=" * 60)

    print("\n1. 检查 PyTorch 和 CUDA 可用性:")
    memory_info = memory_manager.get_gpu_memory_info()
    print(f"   - PyTorch 可用: {memory_info['torch_available']}")
    print(f"   - CUDA 可用: {memory_info['cuda_available']}")
    print(f"   - GPU 设备数量: {memory_info['device_count']}")

    if memory_info['cuda_available']:
        print("\n2. 当前 GPU 显存状态:")
        for device in memory_info['devices']:
            print(f"   - 设备 {device['device_id']}: {device['name']}")
            print(f"     总显存: {device['total_memory_mb']:.2f} MB")
            print(f"     已分配: {device['allocated_memory_mb']:.2f} MB")
            print(f"     已保留: {device['reserved_memory_mb']:.2f} MB")
            print(f"     空闲: {device['free_memory_mb']:.2f} MB")

    print("\n3. 测试清理功能:")
    print("   - 执行全量清理...")
    memory_manager.full_cleanup(force=True)

    if memory_info['cuda_available']:
        print("\n4. 清理后 GPU 显存状态:")
        memory_info_after = memory_manager.get_gpu_memory_info()
        for device in memory_info_after['devices']:
            freed = memory_info['devices'][device['device_id']]['reserved_memory_mb'] - device['reserved_memory_mb']
            print(f"   - 设备 {device['device_id']}:")
            print(f"     释放显存: {freed:.2f} MB")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)
    print("\n显存清理机制说明:")
    print("1. 单个视频处理后: 清理 numpy 数组缓存 + PyTorch CUDA 缓存")
    print("2. 每处理 3 个视频: 执行深度清理")
    print("3. 批量处理完成: 强制执行全量清理并重置计数器")
    print("4. API 中间件: 每次 evaluate/align 请求后自动清理")
    print("5. 手动清理: 通过 /api/cleanup-memory 端点触发")
    print("\n新增 API 端点:")
    print("  - GET  /api/gpu-memory      查看GPU显存使用情况")
    print("  - POST /api/cleanup-memory  手动触发显存清理")


if __name__ == "__main__":
    test_memory_cleanup()
