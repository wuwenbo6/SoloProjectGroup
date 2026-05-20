import asyncio
import json
import websockets
from websockets.server import WebSocketServerProtocol
from typing import Set, Dict, Optional
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from can_stack.can_bus import VirtualCANBus, CANMessage
from can_stack.uds import UDSMessage, UDSService, DataIdentifier
from can_stack.tp_layer import TPLayer
from ecu_sim import EngineECU, TransmissionECU, ABSECU

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DiagnosticServer:
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.can_bus = VirtualCANBus()
        
        self.engine_ecu = EngineECU(self.can_bus)
        self.transmission_ecu = TransmissionECU(self.can_bus)
        self.abs_ecu = ABSECU(self.can_bus)
        
        self.testers: Dict[str, TPLayer] = {
            "engine": TPLayer(self.can_bus, 0x7E8, 0x7E0),
            "transmission": TPLayer(self.can_bus, 0x7E9, 0x7E1),
            "abs": TPLayer(self.can_bus, 0x7EA, 0x7E2),
        }
        
        self.clients: Set[WebSocketServerProtocol] = set()
        self.response_events: Dict[str, asyncio.Event] = {}
        self.last_responses: Dict[str, Optional[UDSMessage]] = {}
        
        for name, tp in self.testers.items():
            tp.set_receive_callback(lambda data, n=name: self._on_response_received(n, data))
        
        self.can_bus.add_listener(self._on_can_message)
        self.can_bus.add_load_listener(self._on_load_update)

    async def _on_load_update(self, load: float):
        message = {
            "type": "bus_load",
            "load": round(load, 2),
            "baud_rate": self.can_bus.baud_rate
        }
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.clients],
                return_exceptions=True
            )

    async def start(self):
        await asyncio.gather(
            self.can_bus.start(),
            self.engine_ecu.start(),
            self.transmission_ecu.start(),
            self.abs_ecu.start(),
            self._start_websocket_server(),
        )

    async def _start_websocket_server(self):
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        async with websockets.serve(self._handle_client, self.host, self.port):
            await asyncio.Future()

    async def _handle_client(self, websocket: WebSocketServerProtocol):
        self.clients.add(websocket)
        logger.info(f"Client connected: {websocket.remote_address}")
        
        try:
            async for message in websocket:
                await self._process_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.remove(websocket)
            logger.info(f"Client disconnected: {websocket.remote_address}")

    async def _process_client_message(self, websocket: WebSocketServerProtocol, message: str):
        try:
            data = json.loads(message)
            command = data.get("command")
            
            if command == "send_uds":
                await self._handle_send_uds(websocket, data)
            elif command == "change_session":
                await self._handle_change_session(websocket, data)
            elif command == "get_session_status":
                await self._handle_get_session_status(websocket, data)
            elif command == "save_history":
                self.can_bus.save_history(data.get("filename", "can_history.json"))
                await websocket.send(json.dumps({"type": "info", "message": "History saved"}))
            elif command == "start_replay":
                await self._handle_start_replay(websocket, data)
            elif command == "stop_replay":
                self.can_bus.stop_replay()
                await websocket.send(json.dumps({"type": "replay_stopped"}))
            elif command == "pause_replay":
                self.can_bus.pause_replay()
                await websocket.send(json.dumps({"type": "replay_paused"}))
            elif command == "resume_replay":
                self.can_bus.resume_replay()
                await websocket.send(json.dumps({"type": "replay_resumed"}))
            elif command == "get_replay_status":
                status = self.can_bus.get_replay_status()
                await websocket.send(json.dumps({"type": "replay_status", "status": status}))
            elif command == "get_available_dids":
                await self._send_available_dids(websocket, data.get("ecu", "engine"))
        except Exception as e:
            logger.error(f"Error processing client message: {e}")
            await websocket.send(json.dumps({"type": "error", "message": str(e)}))

    async def _handle_send_uds(self, websocket: WebSocketServerProtocol, data: dict):
        ecu_name = data.get("ecu", "engine")
        service_id = data.get("service_id")
        service_data = bytes.fromhex(data.get("data", ""))
        
        if ecu_name not in self.testers:
            await websocket.send(json.dumps({"type": "error", "message": f"Unknown ECU: {ecu_name}"}))
            return
        
        tp = self.testers[ecu_name]
        request = UDSMessage(service_id, service_data)
        
        event = asyncio.Event()
        self.response_events[ecu_name] = event
        self.last_responses[ecu_name] = None
        
        await tp.send_data(request.to_bytes())
        
        try:
            await asyncio.wait_for(event.wait(), timeout=2.0)
            response = self.last_responses.get(ecu_name)
            
            if response:
                parsed_response = self._parse_uds_response(response)
                await websocket.send(json.dumps({
                    "type": "uds_response",
                    "ecu": ecu_name,
                    "request": {
                        "service_id": f"0x{service_id:02X}",
                        "service_name": UDSService(service_id).name if service_id in UDSService.__members__.values() else "UNKNOWN",
                        "data": service_data.hex().upper()
                    },
                    "response": parsed_response
                }))
            else:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "No response received"
                }))
        except asyncio.TimeoutError:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "Response timeout"
            }))
        finally:
            if ecu_name in self.response_events:
                del self.response_events[ecu_name]

    def _on_response_received(self, ecu_name: str, raw_data: bytes):
        try:
            response = UDSMessage.from_bytes(raw_data)
            self.last_responses[ecu_name] = response
            if ecu_name in self.response_events:
                self.response_events[ecu_name].set()
        except Exception as e:
            logger.error(f"Error parsing response: {e}")

    def _parse_uds_response(self, response: UDSMessage) -> dict:
        result = {
            "service_id": f"0x{response.service_id:02X}",
            "service_name": response.get_service_name(),
            "is_response": response.is_response,
            "data_hex": response.data.hex().upper(),
            "parsed_data": {}
        }
        
        if response.service_id == UDSService.DIAGNOSTIC_SESSION_CONTROL and len(response.data) >= 5:
            session_type = response.data[0]
            p2_server = (response.data[1] << 8) | response.data[2]
            p2_star_server = (response.data[3] << 8) | response.data[4]
            session_names = {1: "默认会话", 2: "编程会话", 3: "扩展会话"}
            result["parsed_data"] = {
                "session_type": session_type,
                "session_name": session_names.get(session_type, f"0x{session_type:02X}"),
                "p2_server_ms": p2_server,
                "p2_star_server_ms": p2_star_server
            }
        elif response.service_id == UDSService.READ_DATA_BY_IDENTIFIER and len(response.data) >= 2:
            did = (response.data[0] << 8) | response.data[1]
            did_value = response.data[2:]
            result["parsed_data"] = {
                "did": f"0x{did:04X}",
                "did_name": DataIdentifier.get_name(did),
                "value": self._parse_did_value(did, did_value)
            }
        elif response.service_id == UDSService.WRITE_DATA_BY_IDENTIFIER and len(response.data) >= 2:
            did = (response.data[0] << 8) | response.data[1]
            result["parsed_data"] = {
                "did": f"0x{did:04X}",
                "did_name": DataIdentifier.get_name(did),
                "status": "写入成功"
            }
        elif response.service_id == UDSService.INPUT_OUTPUT_CONTROL_BY_IDENTIFIER and len(response.data) >= 3:
            did = (response.data[0] << 8) | response.data[1]
            control_param = response.data[2]
            param_names = {0: "返回控制", 1: "复位默认", 2: "冻结当前", 3: "调整输出"}
            result["parsed_data"] = {
                "did": f"0x{did:04X}",
                "control_param": f"0x{control_param:02X}",
                "control_name": param_names.get(control_param, "未知")
            }
        elif response.service_id == UDSService.READ_DTC_INFORMATION and len(response.data) >= 2:
            sub_function = response.data[0]
            result["parsed_data"] = {
                "sub_function": f"0x{sub_function:02X}",
                "dtcs": []
            }
            if sub_function == 0x02:
                for i in range(2, len(response.data), 4):
                    if i + 3 < len(response.data):
                        dtc_code = (response.data[i] << 16) | (response.data[i+1] << 8) | response.data[i+2]
                        status = response.data[i+3]
                        result["parsed_data"]["dtcs"].append({
                            "dtc_code": f"P{dtc_code:04X}",
                            "status": f"0x{status:02X}"
                        })
        elif response.service_id == UDSService.NEGATIVE_RESPONSE and len(response.data) >= 2:
            result["parsed_data"] = {
                "original_service": f"0x{response.data[0]:02X}",
                "nrc": f"0x{response.data[1]:02X}",
                "nrc_name": self._get_nrc_name(response.data[1])
            }
        
        return result

    def _parse_did_value(self, did: int, value: bytes) -> str:
        if did == 0x1001 and len(value) >= 2:
            return f"{(value[0] << 8) | value[1]} RPM"
        elif did == 0x1002 and len(value) >= 2:
            return f"{(value[0] << 8) | value[1]} km/h"
        elif did in [0x1003, 0x2002] and len(value) >= 1:
            return f"{value[0] - 40} °C"
        elif did in [0x1004, 0x1005] and len(value) >= 1:
            return f"{value[0]} %"
        elif did == 0x2001 and len(value) >= 1:
            return f"Gear {value[0]}"
        elif did in [0x3001, 0x3002, 0x3003, 0x3004] and len(value) >= 2:
            return f"{(value[0] << 8) | value[1]} km/h"
        else:
            return value.decode('ascii', errors='replace') if all(32 <= b < 127 for b in value) else value.hex().upper()

    def _get_nrc_name(self, nrc: int) -> str:
        nrc_names = {
            0x10: "General Reject",
            0x11: "Service Not Supported",
            0x12: "Sub Function Not Supported",
            0x13: "Incorrect Message Length",
            0x21: "Busy Repeat Request",
            0x22: "Conditions Not Correct",
            0x31: "Request Out Of Range",
            0x33: "Security Access Denied",
            0x7E: "Sub Function Not Supported In Active Session",
            0x7F: "Service Not Supported In Active Session",
        }
        return nrc_names.get(nrc, "Unknown NRC")

    async def _on_can_message(self, msg: CANMessage):
        message_data = {
            "type": "can_message",
            "data": msg.to_dict()
        }
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message_data)) for client in self.clients],
                return_exceptions=True
            )

    async def _send_available_dids(self, websocket: WebSocketServerProtocol, ecu_name: str):
        ecu_map = {
            "engine": self.engine_ecu,
            "transmission": self.transmission_ecu,
            "abs": self.abs_ecu
        }
        
        ecu = ecu_map.get(ecu_name)
        if ecu:
            dids = []
            for did, value in ecu.data_identifiers.items():
                writable = did in ecu.did_write_session_requirements
                required_session = ecu.did_write_session_requirements.get(did, 0) if writable else 0
                dids.append({
                    "did": f"0x{did:04X}",
                    "name": DataIdentifier.get_name(did),
                    "value": self._parse_did_value(did, value),
                    "writable": writable,
                    "required_session": required_session
                })
            await websocket.send(json.dumps({
                "type": "available_dids",
                "ecu": ecu_name,
                "dids": dids
            }))

    async def _handle_change_session(self, websocket: WebSocketServerProtocol, data: dict):
        ecu_name = data.get("ecu", "engine")
        session_level = data.get("session_level", 1)
        
        request = UDSMessage(UDSService.DIAGNOSTIC_SESSION_CONTROL, bytes([session_level]))
        await self.testers[ecu_name].send_data(request.to_bytes())
        
        event = asyncio.Event()
        self.response_events[ecu_name] = event
        
        try:
            await asyncio.wait_for(event.wait(), timeout=2.0)
            response = self.last_responses.get(ecu_name)
            
            if response:
                parsed_response = self._parse_uds_response(response)
                await websocket.send(json.dumps({
                    "type": "session_changed",
                    "ecu": ecu_name,
                    "response": parsed_response
                }))
            else:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "No response received"
                }))
        except asyncio.TimeoutError:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "Response timeout"
            }))
        finally:
            if ecu_name in self.response_events:
                del self.response_events[ecu_name]

    async def _handle_get_session_status(self, websocket: WebSocketServerProtocol, data: dict):
        ecu_map = {
            "engine": self.engine_ecu,
            "transmission": self.transmission_ecu,
            "abs": self.abs_ecu
        }
        
        ecu_name = data.get("ecu", "engine")
        ecu = ecu_map.get(ecu_name)
        
        if ecu:
            session_names = {1: "默认会话", 2: "编程会话", 3: "扩展会话"}
            await websocket.send(json.dumps({
                "type": "session_status",
                "ecu": ecu_name,
                "current_session": ecu.active_session,
                "session_name": session_names.get(ecu.active_session, "未知会话")
            }))

    async def _handle_start_replay(self, websocket: WebSocketServerProtocol, data: dict):
        filename = data.get("filename", "can_history.json")
        speed = data.get("speed", 1.0)

        try:
            messages = self.can_bus.load_history(filename)
        except Exception as e:
            await websocket.send(json.dumps({"type": "error", "message": f"Failed to load history: {e}"}))
            return

        if not messages:
            await websocket.send(json.dumps({"type": "error", "message": "No messages to replay"}))
            return

        def replay_callback(msg, index, total):
            asyncio.create_task(
                websocket.send(json.dumps({
                    "type": "replay_progress",
                    "current": index + 1,
                    "total": total,
                    "percentage": round((index + 1) / total * 100, 1)
                }))
            )

        await websocket.send(json.dumps({
            "type": "replay_started",
            "total_messages": len(messages),
            "speed": speed
        }))

        success = await self.can_bus.replay_history(messages, speed, replay_callback)

        if success:
            await websocket.send(json.dumps({"type": "replay_completed"}))
        else:
            await websocket.send(json.dumps({"type": "replay_stopped"}))


async def main():
    server = DiagnosticServer()
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
