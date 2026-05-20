from enum import IntEnum
from dataclasses import dataclass
from typing import Optional
import time


class NMTCommand(IntEnum):
    START = 0x01
    STOP = 0x02
    ENTER_PRE_OPERATIONAL = 0x80
    RESET_NODE = 0x81
    RESET_COMMUNICATION = 0x82


class NMTState(IntEnum):
    INITIALISING = 0x00
    STOPPED = 0x04
    OPERATIONAL = 0x05
    PRE_OPERATIONAL = 0x7F
    UNKNOWN = 0xFF


@dataclass
class NodeState:
    node_id: int
    state: NMTState
    last_heartbeat: float = 0.0
    heartbeat_timeout: int = 0


class NMTManager:
    def __init__(self, network):
        self.network = network
        self.node_states: dict[int, NodeState] = {}
        self.heartbeat_enabled = False

    def send_command(self, node_id: int, command: NMTCommand) -> None:
        msg = bytearray([command, node_id])
        self.network.send_message(0x000, msg)

    def start_node(self, node_id: int) -> None:
        self.send_command(node_id, NMTCommand.START)

    def stop_node(self, node_id: int) -> None:
        self.send_command(node_id, NMTCommand.STOP)

    def enter_pre_operational(self, node_id: int) -> None:
        self.send_command(node_id, NMTCommand.ENTER_PRE_OPERATIONAL)

    def reset_node(self, node_id: int) -> None:
        self.send_command(node_id, NMTCommand.RESET_NODE)

    def reset_communication(self, node_id: int) -> None:
        self.send_command(node_id, NMTCommand.RESET_COMMUNICATION)

    def start_all_nodes(self) -> None:
        self.send_command(0, NMTCommand.START)

    def stop_all_nodes(self) -> None:
        self.send_command(0, NMTCommand.STOP)

    def on_heartbeat(self, node_id: int, data: bytes) -> None:
        state_value = data[0] if len(data) > 0 else 0xFF
        try:
            state = NMTState(state_value)
        except ValueError:
            state = NMTState.UNKNOWN

        if node_id not in self.node_states:
            self.node_states[node_id] = NodeState(node_id=node_id, state=state)
        else:
            self.node_states[node_id].state = state
        
        self.node_states[node_id].last_heartbeat = time.time()

    def get_node_state(self, node_id: int) -> Optional[NMTState]:
        if node_id in self.node_states:
            return self.node_states[node_id].state
        return None

    def get_all_node_states(self) -> dict[int, NodeState]:
        return self.node_states.copy()

    def check_heartbeat_timeout(self, node_id: int) -> bool:
        if node_id not in self.node_states:
            return False
        
        node = self.node_states[node_id]
        if node.heartbeat_timeout == 0:
            return False
        
        elapsed = time.time() - node.last_heartbeat
        return elapsed > node.heartbeat_timeout / 1000.0
