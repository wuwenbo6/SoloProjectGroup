import asyncio
import sys
import os
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from can_stack.can_bus import VirtualCANBus, CANMessage


async def simulate_ecu_sending(can_bus: VirtualCANBus, arbitration_id: int, num_messages: int, delay: float = 0):
    await asyncio.sleep(delay)
    for i in range(num_messages):
        data = bytes([arbitration_id & 0xFF, i & 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        await can_bus.send_message(arbitration_id, data)
        await asyncio.sleep(0)


async def test_fair_queuing():
    print("=" * 60)
    print("测试公平队列：多个ECU同时发送消息")
    print("=" * 60)
    
    can_bus = VirtualCANBus()
    received_messages: list = []
    
    def on_message(msg: CANMessage):
        received_messages.append(msg)
    
    can_bus.add_listener(on_message)
    
    bus_task = asyncio.create_task(can_bus.start())
    
    await asyncio.sleep(0.1)
    
    ecu_ids = [0x7E8, 0x7E9, 0x7EA]
    ecu_names = {0x7E8: "发动机(Engine)", 0x7E9: "变速箱(Transmission)", 0x7EA: "ABS"}
    messages_per_ecu = 20
    
    print(f"\n开始测试：每个ECU发送 {messages_per_ecu} 条消息")
    print(f"ECU IDs: {[hex(id) for id in ecu_ids]}")
    
    start_time = asyncio.get_event_loop().time()
    
    send_tasks = [
        simulate_ecu_sending(can_bus, ecu_id, messages_per_ecu)
        for ecu_id in ecu_ids
    ]
    await asyncio.gather(*send_tasks)
    
    await asyncio.sleep(0.5)
    
    end_time = asyncio.get_event_loop().time()
    
    can_bus.stop()
    await bus_task
    
    print(f"\n测试完成！总耗时: {(end_time - start_time)*1000:.2f}ms")
    print(f"收到消息总数: {len(received_messages)}")
    
    counter = Counter(msg.arbitration_id for msg in received_messages)
    
    print("\n各ECU消息发送统计：")
    print("-" * 40)
    for ecu_id in ecu_ids:
        count = counter.get(ecu_id, 0)
        name = ecu_names[ecu_id]
        print(f"  {name} (0x{ecu_id:03X}): {count} 条消息")
    
    print("\n消息发送顺序分析（前30条）：")
    print("-" * 40)
    for i, msg in enumerate(received_messages[:30]):
        name = ecu_names.get(msg.arbitration_id, f"0x{msg.arbitration_id:03X}")
        print(f"  [{i:2d}] {name}")
    
    consecutive_count = 1
    max_consecutive = 1
    consecutive_ecu = received_messages[0].arbitration_id
    
    for msg in received_messages[1:]:
        if msg.arbitration_id == consecutive_ecu:
            consecutive_count += 1
            max_consecutive = max(max_consecutive, consecutive_count)
        else:
            consecutive_count = 1
            consecutive_ecu = msg.arbitration_id
    
    print(f"\n最大连续发送数: {max_consecutive} (fair_queue限制: 3)")
    
    min_messages = min(counter.values())
    max_messages = max(counter.values())
    fairness_ratio = min_messages / max_messages if max_messages > 0 else 0
    
    print(f"公平性比率: {fairness_ratio:.2%} (100% = 完全公平)")
    
    if max_consecutive <= 3 and fairness_ratio > 0.8:
        print("\n✅ 测试通过！公平队列工作正常")
    else:
        print("\n❌ 测试失败！")
    
    print("=" * 60)
    return fairness_ratio


async def test_burst_behavior():
    print("\n\n" + "=" * 60)
    print("测试突发行为：验证突发限制")
    print("=" * 60)
    
    can_bus = VirtualCANBus()
    received_messages: list = []
    
    def on_message(msg: CANMessage):
        received_messages.append(msg)
    
    can_bus.add_listener(on_message)
    
    bus_task = asyncio.create_task(can_bus.start())
    
    await asyncio.sleep(0.1)
    
    ecu_id = 0x7E8
    num_messages = 10
    
    print(f"\n单个ECU突发发送 {num_messages} 条消息...")
    
    for i in range(num_messages):
        data = bytes([ecu_id & 0xFF, i & 0xFF])
        await can_bus.send_message(ecu_id, data)
    
    await asyncio.sleep(0.3)
    
    can_bus.stop()
    await bus_task
    
    print(f"收到消息: {len(received_messages)}")
    
    consecutive_runs = []
    current_run = 1
    for i in range(1, len(received_messages)):
        if received_messages[i].arbitration_id == received_messages[i-1].arbitration_id:
            current_run += 1
        else:
            consecutive_runs.append(current_run)
            current_run = 1
    consecutive_runs.append(current_run)
    
    print(f"连续发送序列: {consecutive_runs}")
    print(f"最大连续发送: {max(consecutive_runs) if consecutive_runs else 0}")
    
    print("=" * 60)


async def main():
    await test_fair_queuing()
    await test_burst_behavior()


if __name__ == "__main__":
    asyncio.run(main())
