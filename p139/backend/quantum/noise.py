import numpy as np
from typing import Dict, List, Optional, Tuple
import random


class NoiseModel:
    def __init__(
        self,
        depolarizing_rate: float = 0.0,
        amplitude_damping: float = 0.0,
        phase_damping: float = 0.0,
        readout_error: float = 0.0,
    ):
        self.depolarizing_rate = depolarizing_rate
        self.amplitude_damping = amplitude_damping
        self.phase_damping = phase_damping
        self.readout_error = readout_error

    def apply_depolarizing_noise(self, state, qubit: int, num_qubits: int):
        if self.depolarizing_rate <= 0:
            return state

        if isinstance(state, dict):
            return self._apply_depolarizing_sparse(state, qubit, num_qubits)
        else:
            return self._apply_depolarizing_dense(state, qubit, num_qubits)

    def _apply_depolarizing_dense(self, state: np.ndarray, qubit: int, num_qubits: int) -> np.ndarray:
        target_bit = num_qubits - 1 - qubit
        target_mask = 1 << target_bit

        X = np.array([[0, 1], [1, 0]], dtype=np.complex128)
        Y = np.array([[0, -1j], [1j, 0]], dtype=np.complex128)
        Z = np.array([[1, 0], [0, -1]], dtype=np.complex128)

        p = self.depolarizing_rate
        identity_term = (1 - p) * state
        x_term = (p / 3) * self._apply_single_qubit_gate(state, X, num_qubits, qubit)
        y_term = (p / 3) * self._apply_single_qubit_gate(state, Y, num_qubits, qubit)
        z_term = (p / 3) * self._apply_single_qubit_gate(state, Z, num_qubits, qubit)

        return identity_term + x_term + y_term + z_term

    def _apply_depolarizing_sparse(self, state: Dict, qubit: int, num_qubits: int) -> Dict:
        amplitudes = state["amplitudes"].copy()
        target_bit = num_qubits - 1 - qubit
        target_mask = 1 << target_bit
        p = self.depolarizing_rate

        new_amplitudes = {}

        for idx, amp in amplitudes.items():
            bit = (idx >> target_bit) & 1
            other_idx = idx ^ target_mask

            new_amplitudes[idx] = new_amplitudes.get(idx, 0) + (1 - p) * amp

            new_amplitudes[other_idx] = new_amplitudes.get(other_idx, 0) + (p / 3) * amp
            new_amplitudes[idx] = new_amplitudes.get(idx, 0) - (p / 3) * amp if bit else new_amplitudes.get(idx, 0) + (p / 3) * amp
            new_amplitudes[other_idx] = new_amplitudes.get(other_idx, 0) - (p / 3) * amp if bit else new_amplitudes.get(other_idx, 0) + (p / 3) * amp

            if bit:
                new_amplitudes[idx] = new_amplitudes.get(idx, 0) - (p / 3) * 1j * amp
                new_amplitudes[other_idx] = new_amplitudes.get(other_idx, 0) + (p / 3) * 1j * amp
            else:
                new_amplitudes[idx] = new_amplitudes.get(idx, 0) + (p / 3) * 1j * amp
                new_amplitudes[other_idx] = new_amplitudes.get(other_idx, 0) - (p / 3) * 1j * amp

        cleaned = {k: v for k, v in new_amplitudes.items() if abs(v) > 1e-10}
        return {"type": "sparse", "num_qubits": num_qubits, "amplitudes": cleaned}

    def _apply_single_qubit_gate(self, state: np.ndarray, gate: np.ndarray, num_qubits: int, target: int) -> np.ndarray:
        target_bit = num_qubits - 1 - target
        target_mask = 1 << target_bit
        other_mask = ((1 << num_qubits) - 1) ^ target_mask

        new_state = np.zeros_like(state)
        for i in range(1 << (num_qubits - 1)):
            base = i & other_mask
            idx0 = base
            idx1 = base | target_mask

            new_state[idx0] = gate[0, 0] * state[idx0] + gate[0, 1] * state[idx1]
            new_state[idx1] = gate[1, 0] * state[idx0] + gate[1, 1] * state[idx1]

        return new_state

    def apply_amplitude_damping(self, state, qubit: int, num_qubits: int):
        if self.amplitude_damping <= 0:
            return state

        gamma = self.amplitude_damping

        if isinstance(state, dict):
            return self._apply_amplitude_damping_sparse(state, qubit, num_qubits, gamma)
        else:
            return self._apply_amplitude_damping_dense(state, qubit, num_qubits, gamma)

    def _apply_amplitude_damping_dense(self, state: np.ndarray, qubit: int, num_qubits: int, gamma: float) -> np.ndarray:
        target_bit = num_qubits - 1 - qubit
        target_mask = 1 << target_bit
        new_state = np.zeros_like(state)

        for i in range(len(state)):
            bit = (i >> target_bit) & 1
            if bit == 1:
                new_state[i & ~target_mask] += np.sqrt(1 - gamma) * state[i]
                new_state[i] += np.sqrt(gamma) * state[i]
            else:
                new_state[i] += state[i]

        return new_state

    def _apply_amplitude_damping_sparse(self, state: Dict, qubit: int, num_qubits: int, gamma: float) -> Dict:
        amplitudes = state["amplitudes"]
        target_bit = num_qubits - 1 - qubit
        target_mask = 1 << target_bit
        new_amplitudes = {}

        for idx, amp in amplitudes.items():
            bit = (idx >> target_bit) & 1
            if bit == 1:
                new_idx = idx & ~target_mask
                new_amplitudes[new_idx] = new_amplitudes.get(new_idx, 0) + np.sqrt(1 - gamma) * amp
                new_amplitudes[idx] = new_amplitudes.get(idx, 0) + np.sqrt(gamma) * amp
            else:
                new_amplitudes[idx] = new_amplitudes.get(idx, 0) + amp

        cleaned = {k: v for k, v in new_amplitudes.items() if abs(v) > 1e-10}
        return {"type": "sparse", "num_qubits": num_qubits, "amplitudes": cleaned}

    def apply_readout_error(self, measurement_counts: Dict[str, int]) -> Dict[str, int]:
        if self.readout_error <= 0:
            return measurement_counts

        error_counts = {}
        p_error = self.readout_error

        for bitstring, count in measurement_counts.items():
            num_qubits = len(bitstring)
            for _ in range(count):
                error_bitstring = list(bitstring)
                for i in range(num_qubits):
                    if random.random() < p_error:
                        error_bitstring[i] = "1" if error_bitstring[i] == "0" else "0"
                new_bitstring = "".join(error_bitstring)
                error_counts[new_bitstring] = error_counts.get(new_bitstring, 0) + 1

        return error_counts

    def apply_all_noise(self, state, gate_qubits: List[int], num_qubits: int):
        result = state
        for qubit in gate_qubits:
            if self.depolarizing_rate > 0:
                result = self.apply_depolarizing_noise(result, qubit, num_qubits)
            if self.amplitude_damping > 0:
                result = self.apply_amplitude_damping(result, qubit, num_qubits)
        return result


class ErrorCorrection:
    @staticmethod
    def steane_code_encode(qubit_state: complex = 1 + 0j) -> Dict:
        num_qubits = 7
        amplitudes = {}

        zero_state = 0 + 0j
        one_state = 0 + 0j

        if qubit_state != 0:
            zero_state = qubit_state * np.sqrt(1 / 8)
            if abs(qubit_state) > 1e-10:
                one_state = (1 / np.sqrt(8)) if abs(qubit_state) > 1e-10 else 0 + 0j

        for idx in range(128):
            bits = format(idx, '07b')
            parity_x = (int(bits[0]) + int(bits[2]) + int(bits[4]) + int(bits[6])) % 2
            parity_z = (int(bits[1]) + int(bits[2]) + int(bits[5]) + int(bits[6])) % 2

            if parity_x == 0 and parity_z == 0:
                amplitudes[idx] = zero_state if int(bits[3]) == 0 else one_state

        cleaned = {k: v for k, v in amplitudes.items() if abs(v) > 1e-10}
        return {"type": "sparse", "num_qubits": num_qubits, "amplitudes": cleaned}

    @staticmethod
    def steane_code_stabilizers() -> List[Dict]:
        stabilizers = [
            {"type": "X", "targets": [0, 2, 4, 6]},
            {"type": "X", "targets": [1, 2, 5, 6]},
            {"type": "X", "targets": [3, 4, 5, 6]},
            {"type": "Z", "targets": [0, 2, 4, 6]},
            {"type": "Z", "targets": [1, 2, 5, 6]},
            {"type": "Z", "targets": [3, 4, 5, 6]},
        ]
        return stabilizers


def export_to_qasm(num_qubits: int, gates: List[Dict], name: str = "quantum_circuit") -> str:
    lines = [
        f"// Quantum Circuit: {name}",
        f"// Generated by Quantum Circuit Simulator",
        "",
        f"OPENQASM 2.0;",
        f'include "qelib1.inc";',
        "",
        f"qreg q[{num_qubits}];",
        f"creg c[{num_qubits}];",
        "",
    ]

    gate_map = {
        "H": "h",
        "X": "x",
        "Y": "y",
        "Z": "z",
        "CNOT": "cx",
        "Toffoli": "ccx",
    }

    for gate in gates:
        gate_type = gate.get("type")
        target = gate.get("target")
        controls = gate.get("controls", [])

        qasm_gate = gate_map.get(gate_type, gate_type.lower())

        if gate_type in ["H", "X", "Y", "Z"]:
            lines.append(f"{qasm_gate} q[{target}];")
        elif gate_type == "CNOT":
            control = controls[0] if controls else 0
            lines.append(f"{qasm_gate} q[{control}],q[{target}];")
        elif gate_type == "Toffoli":
            if len(controls) >= 2:
                lines.append(f"{qasm_gate} q[{controls[0]}],q[{controls[1]}],q[{target}];")

    lines.append("")
    for i in range(num_qubits):
        lines.append(f"measure q[{i}] -> c[{i}];")

    return "\n".join(lines)
