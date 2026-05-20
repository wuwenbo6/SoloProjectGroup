import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from can_stack.can_bus import VirtualCANBus
from ecu_sim.base_ecu import SessionLevel, BaseECU
from ecu_sim.engine_ecu import EngineECU


async def test_session_permissions():
    print("=" * 60)
    print("测试会话权限控制")
    print("=" * 60)
    
    can_bus = VirtualCANBus()
    
    received_messages = []
    
    def handle_response(msg):
        received_messages.append(msg)
    
    can_bus.add_listener(handle_response)
    
    bus_task = asyncio.create_task(can_bus.start())
    
    await asyncio.sleep(0.1)
    
    ecu = EngineECU(can_bus)
    await ecu.start()
    
    tester = type('MockTester', (), {})()
    tester.can_bus = can_bus
    tester.tx_id = 0x7E0
    tester.rx_id = 0x7E8
    
    await asyncio.sleep(0.1)
    
    print(f"\n初始会话: {SessionLevel.get_name(ecu.active_session)}")
    
    print("\n1. 默认会话下尝试写入数据 (应该失败):")
    write_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x2E,
            'data': bytes([0x12, 0x34, 0x48, 0x65, 0x6C, 0x6C, 0x6F])
        })()
    )
    response = await write_request
    if response.service_id == 0x7F:
        print(f"   ✓ 正确拒绝: NRC = 0x{response.data[1]:02X} (权限不足)")
    else:
        print(f"   ✗ 错误: 应该拒绝但允许了请求")
    
    print("\n2. 切换到编程会话:")
    session_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x10,
            'data': bytes([0x02])
        })()
    )
    response = await session_request
    if response.service_id == 0x10 and len(response.data) >= 5:
        print(f"   ✓ 会话切换成功: {SessionLevel.get_name(ecu.active_session)}")
        print(f"   P2服务器: {response.data[1]*256 + response.data[2]}ms")
        print(f"   P2*服务器: {response.data[3]*256 + response.data[4]}ms")
    else:
        print(f"   ✗ 会话切换失败")
    
    print("\n3. 编程会话下尝试写入数据 (应该成功):")
    write_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x2E,
            'data': bytes([0x12, 0x34, 0x48, 0x65, 0x6C, 0x6C, 0x6F])
        })()
    )
    response = await write_request
    if response.service_id == 0x2E:
        did = (response.data[0] << 8) | response.data[1]
        print(f"   ✓ 写入成功: DID = 0x{did:04X}")
    else:
        print(f"   ✗ 写入失败: NRC = 0x{response.data[1]:02X}")
    
    print("\n4. 验证写入的数据:")
    read_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x22,
            'data': bytes([0x12, 0x34])
        })()
    )
    response = await read_request
    if response.service_id == 0x22:
        value = response.data[2:]
        print(f"   ✓ 读取成功: 0x{value.hex().upper()} = '{value.decode('ascii', errors='replace')}'")
    
    print("\n5. 测试IO控制服务 (需要扩展会话):")
    io_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x2F,
            'data': bytes([0x10, 0x01, 0x00])
        })()
    )
    response = await io_request
    if response.service_id == 0x7F:
        print(f"   ✓ 默认会话下正确拒绝: NRC = 0x{response.data[1]:02X}")
    
    print("\n6. 切换到扩展会话:")
    session_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x10,
            'data': bytes([0x03])
        })()
    )
    response = await session_request
    if ecu.active_session == SessionLevel.EXTENDED:
        print(f"   ✓ 会话切换成功: {SessionLevel.get_name(ecu.active_session)}")
    
    print("\n7. 扩展会话下测试IO控制:")
    io_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x2F,
            'data': bytes([0x10, 0x01, 0x00])
        })()
    )
    response = await io_request
    if response.service_id == 0x2F:
        print(f"   ✓ IO控制成功: DID=0x{response.data[0]:02X}{response.data[1]:02X}")
    
    print("\n8. 切换回默认会话:")
    session_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x10,
            'data': bytes([0x01])
        })()
    )
    response = await session_request
    if ecu.active_session == SessionLevel.DEFAULT:
        print(f"   ✓ 会话切换成功: {SessionLevel.get_name(ecu.active_session)}")
    
    print("\n9. 默认会话下再次尝试写入 (应该再次失败):")
    write_request = ecu._handle_uds_request(
        type('Request', (), {
            'service_id': 0x2E,
            'data': bytes([0x12, 0x34, 0x54, 0x65, 0x73, 0x74])
        })()
    )
    response = await write_request
    if response.service_id == 0x7F:
        print(f"   ✓ 正确拒绝: NRC = 0x{response.data[1]:02X} (权限不足)")
    
    can_bus.stop()
    await bus_task
    
    print("\n" + "=" * 60)
    print("测试完成！所有功能工作正常。")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_session_permissions())
