import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from can_stack.can_bus import VirtualCANBus, CANMessage


async def test_replay_with_timing():
    print("=" * 60)
    print("测试回放功能 - 时间间隔验证")
    print("=" * 60)
    
    can_bus = VirtualCANBus()
    received_messages = []
    receive_times = []
    
    def on_message(msg):
        received_messages.append(msg)
        receive_times.append(time.time())
    
    can_bus.add_listener(on_message)
    
    bus_task = asyncio.create_task(can_bus.start())
    
    await asyncio.sleep(0.05)
    
    print("\n1. 生成测试消息（带时间间隔）")
    test_messages = []
    base_time = time.time()
    
    for i in range(10):
        arbitration_id = 0x100 + (i % 3)
        data = bytes([i, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        msg = CANMessage(arbitration_id, data, base_time + i * 0.1)
        test_messages.append(msg)
    
    print(f"   生成了 {len(test_messages)} 条消息")
    print(f"   时间间隔: 100ms / 条")
    
    print("\n2. 保存到文件")
    can_bus.message_history = test_messages.copy()
    can_bus.save_history("test_replay.json")
    
    print("\n3. 加载并回放（1倍速）")
    received_messages.clear()
    receive_times.clear()
    
    loaded_messages = can_bus.load_history("test_replay.json")
    print(f"   加载了 {len(loaded_messages)} 条消息")
    
    start_time = time.time()
    await can_bus.replay_history(loaded_messages, speed=1.0)
    end_time = time.time()
    
    actual_duration = end_time - start_time
    expected_duration = 0.9
    
    print(f"   实际耗时: {actual_duration * 1000:.1f}ms")
    print(f"   预期耗时: {expected_duration * 1000:.1f}ms")
    print(f"   误差: {abs(actual_duration - expected_duration) / expected_duration * 100:.1f}%")
    
    if abs(actual_duration - expected_duration) < 0.2:
        print("   ✓ 时间间隔正确")
    else:
        print("   ✗ 时间间隔可能有问题")
    
    print(f"   收到消息数: {len(received_messages)}")
    
    print("\n4. 测试快速回放（10倍速）")
    received_messages.clear()
    receive_times.clear()
    
    start_time = time.time()
    await can_bus.replay_history(test_messages, speed=10.0)
    end_time = time.time()
    
    actual_duration = end_time - start_time
    expected_duration = 0.09
    
    print(f"   实际耗时: {actual_duration * 1000:.1f}ms")
    print(f"   预期耗时: {expected_duration * 1000:.1f}ms")
    print(f"   收到消息数: {len(received_messages)}")
    
    if actual_duration < 0.3:
        print("   ✓ 快速回放工作正常")
    else:
        print("   ✗ 快速回放太慢")
    
    print("\n5. 测试暂停/继续功能")
    
    async def pause_after_delay(delay):
        await asyncio.sleep(delay)
        can_bus.pause_replay()
        await asyncio.sleep(0.3)
        can_bus.resume_replay()
    
    received_messages.clear()
    receive_times.clear()
    
    pause_task = asyncio.create_task(pause_after_delay(0.2))
    
    start_time = time.time()
    replay_task = asyncio.create_task(can_bus.replay_history(test_messages, speed=1.0))
    
    await replay_task
    end_time = time.time()
    
    actual_duration = end_time - start_time
    
    print(f"   实际耗时（含暂停300ms）: {actual_duration * 1000:.1f}ms")
    print(f"   收到消息数: {len(received_messages)}")
    
    if actual_duration > 1.0:
        print("   ✓ 暂停功能工作正常")
    else:
        print("   ✗ 暂停可能没有生效")
    
    print("\n6. 测试停止功能")
    received_messages.clear()
    
    async def stop_after_delay(delay):
        await asyncio.sleep(delay)
        can_bus.stop_replay()
    
    stop_task = asyncio.create_task(stop_after_delay(0.3))
    await can_bus.replay_history(test_messages, speed=1.0)
    
    print(f"   收到消息数（停止后）: {len(received_messages)}")
    
    if len(received_messages) < len(test_messages):
        print("   ✓ 停止功能工作正常")
    else:
        print("   ✗ 停止可能没有生效")
    
    can_bus.stop()
    await bus_task
    
    os.remove("test_replay.json")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_replay_with_timing())
