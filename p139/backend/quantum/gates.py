import numpy as np
from typing import List, Optional


class QuantumGates:
    @staticmethod
    def H() -> np.ndarray:
        return np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2)

    @staticmethod
    def X() -> np.ndarray:
        return np.array([[0, 1], [1, 0]], dtype=np.complex128)

    @staticmethod
    def Y() -> np.ndarray:
        return np.array([[0, -1j], [1j, 0]], dtype=np.complex128)

    @staticmethod
    def Z() -> np.ndarray:
        return np.array([[1, 0], [0, -1]], dtype=np.complex128)

    @staticmethod
    def CNOT() -> np.ndarray:
        return np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ], dtype=np.complex128)

    @staticmethod
    def Toffoli() -> np.ndarray:
        toffoli = np.eye(8, dtype=np.complex128)
        toffoli[6, 6] = 0
        toffoli[7, 7] = 0
        toffoli[6, 7] = 1
        toffoli[7, 6] = 1
        return toffoli

    @staticmethod
    def get_gate(gate_type: str) -> np.ndarray:
        gate_map = {
            'H': QuantumGates.H(),
            'X': QuantumGates.X(),
            'Y': QuantumGates.Y(),
            'Z': QuantumGates.Z(),
            'CNOT': QuantumGates.CNOT(),
            'Toffoli': QuantumGates.Toffoli()
        }
        return gate_map[gate_type]

    @staticmethod
    def expand_gate(gate: np.ndarray, num_qubits: int, target: int, controls: Optional[List[int]] = None) -> np.ndarray:
        controls = controls or []
        gate_qubits = len(controls) + 1
        
        if gate_qubits == 1:
            return QuantumGates._expand_single_qubit_gate(gate, num_qubits, target)
        elif gate_qubits == 2:
            return QuantumGates._expand_two_qubit_gate(gate, num_qubits, controls[0], target)
        elif gate_qubits == 3:
            return QuantumGates._expand_three_qubit_gate(gate, num_qubits, controls, target)
        else:
            raise ValueError(f"Unsupported gate with {gate_qubits} qubits")

    @staticmethod
    def _expand_single_qubit_gate(gate: np.ndarray, num_qubits: int, target: int) -> np.ndarray:
        result = np.eye(1, dtype=np.complex128)
        for i in range(num_qubits):
            if i == target:
                result = np.kron(result, gate)
            else:
                result = np.kron(result, np.eye(2, dtype=np.complex128))
        return result

    @staticmethod
    def _expand_two_qubit_gate(gate: np.ndarray, num_qubits: int, control: int, target: int) -> np.ndarray:
        if control > target:
            gate = QuantumGates._swap_qubits_in_gate(gate, 2, 0, 1)
            control, target = target, control
        
        result = np.eye(1, dtype=np.complex128)
        idx = 0
        while idx < num_qubits:
            if idx == control:
                result = np.kron(result, gate)
                idx += 2
            else:
                result = np.kron(result, np.eye(2, dtype=np.complex128))
                idx += 1
        return result

    @staticmethod
    def _expand_three_qubit_gate(gate: np.ndarray, num_qubits: int, controls: List[int], target: int) -> np.ndarray:
        qubits = sorted(controls + [target])
        result = np.eye(1, dtype=np.complex128)
        idx = 0
        while idx < num_qubits:
            if idx in qubits and idx + 2 < num_qubits and all(q in [idx, idx+1, idx+2] for q in qubits):
                result = np.kron(result, gate)
                idx += 3
            else:
                result = np.kron(result, np.eye(2, dtype=np.complex128))
                idx += 1
        return result

    @staticmethod
    def _swap_qubits_in_gate(gate: np.ndarray, num_qubits: int, q1: int, q2: int) -> np.ndarray:
        size = 2 ** num_qubits
        permutation = np.zeros((size, size), dtype=np.complex128)
        for i in range(size):
            bits = list(format(i, f'0{num_qubits}b'))
            bits[q1], bits[q2] = bits[q2], bits[q1]
            j = int(''.join(bits), 2)
            permutation[j, i] = 1
        return permutation @ gate @ permutation.conj().T
