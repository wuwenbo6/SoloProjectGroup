import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from can_stack.can_bus import VirtualCANBus, CANMessage


async def test_bus_load_calculation():
    print("=" * 60)
    print("测试CAN总线负载率计算")
    print("=" * 60)
    
    can_bus = VirtualCANBus(baud_rate=500000)
    load_readings = []
    
    def on_load_update(load):
        load_readings.append(load)
        print(f"   负载率更新: {load:.2f}%")
    
    can_bus.add_load_listener(on_load_update)
    
    bus_task = asyncio.create_task(can_bus.start())
    
    await asyncio.sleep(0.1)
    
    print("\n1. 低负载测试 (100ms 发送 10条消息)")
    load_readings.clear()
    
    for i in range(10):
        await can_bus.send_message(0x100 + i, bytes([i] * 8))
        await asyncio.sleep(0.01)
    
    await asyncio.sleep(1.2)
    
    if load_readings:
        avg_load = sum(load_readings) / len(load_readings)
        print(f"   平均负载率: {avg_load:.2f}%")
        print(f"   读数次数: {len(load_readings)}")
    
    print("\n2. 高负载测试 (快速发送大量消息)")
    load_readings.clear()
    
    for i in range(5000):
        await can_bus.send_message(0x200 + (i % 50), bytes([i] * 8))
    
    await asyncio.sleep(1.2)
    
    if load_readings:
        max_load = max(load_readings)
        avg_load = sum(load_readings) / len(load_readings)
        print(f"   最高负载率: {max_load:.2f}%")
        print(f"   平均负载率: {avg_load:.2f}%")
        if max_load >= 70:
            print("   ✓ 触发高负载告警阈值")
        else:
            print("   ✗ 未达到告警阈值")
    
    print("\n3. 验证消息位数计算")
    test_msg = CANMessage(0x123, bytes([0] * 8))
    bits = can_bus._calculate_message_bits(test_msg)
    print(f"   标准CAN帧 (8字节数据): {bits} bits")
    print(f"   理论计算: 47(帧头) + 64(数据) + 15(CRC) + 2(ACK) + 7(EOF) + 3(IFS) = 138 bits")
    
    extended_msg = CANMessage(0x1234, bytes([0] * 8))
    ext_bits = can_bus._calculate_message_bits(extended_msg)
    print(f"   扩展CAN帧 (8字节数据): {ext_bits} bits")
    
    print("\n4. 获取当前负载率")
    current_load = can_bus.get_current_load()
    print(f"   当前负载率: {current_load:.2f}%")
    
    can_bus.stop()
    await bus_task
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_bus_load_calculation())
