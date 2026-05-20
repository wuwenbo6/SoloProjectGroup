import numpy as np
from typing import Dict, List, Optional

try:
    import cupy as cp
    CUPY_AVAILABLE = True
except ImportError:
    CUPY_AVAILABLE = False
    cp = np


class CUDABackend:
    def __init__(self):
        if not CUPY_AVAILABLE:
            raise ImportError("CuPy is not installed. Please install it with 'pip install cupy'")
        self.xp = cp

    def initialize_state(self, num_qubits: int) -> cp.ndarray:
        state = cp.zeros(2 ** num_qubits, dtype=cp.complex128)
        state[0] = 1.0
        return state

    def apply_gate(self, state: cp.ndarray, gate_type: str, target: int, controls: Optional[List[int]] = None) -> cp.ndarray:
        controls = controls or []
        num_qubits = int(cp.log2(len(state)))
        
        if gate_type in ['H', 'X', 'Y', 'Z']:
            return self._apply_single_qubit_gate(state, gate_type, num_qubits, target)
        elif gate_type == 'CNOT':
            return self._apply_cnot(state, num_qubits, controls[0], target)
        elif gate_type == 'Toffoli':
            return self._apply_toffoli(state, num_qubits, controls, target)
        else:
            raise ValueError(f"Unsupported gate type: {gate_type}")

    def _apply_single_qubit_gate(self, state: cp.ndarray, gate_type: str, num_qubits: int, target: int) -> cp.ndarray:
        gate_map = {
            'H': cp.array([[1, 1], [1, -1]], dtype=cp.complex128) / cp.sqrt(2),
            'X': cp.array([[0, 1], [1, 0]], dtype=cp.complex128),
            'Y': cp.array([[0, -1j], [1j, 0]], dtype=cp.complex128),
            'Z': cp.array([[1, 0], [0, -1]], dtype=cp.complex128)
        }
        gate = gate_map[gate_type]
        
        target_mask = 1 << (num_qubits - 1 - target)
        other_mask = ((1 << num_qubits) - 1) ^ target_mask
        
        new_state = cp.zeros_like(state)
        
        for i in range(1 << (num_qubits - 1)):
            base = i & other_mask
            idx0 = base
            idx1 = base | target_mask
            
            new_state[idx0] = gate[0, 0] * state[idx0] + gate[0, 1] * state[idx1]
            new_state[idx1] = gate[1, 0] * state[idx0] + gate[1, 1] * state[idx1]
        
        return new_state

    def _apply_cnot(self, state: cp.ndarray, num_qubits: int, control: int, target: int) -> cp.ndarray:
        new_state = state.copy()
        control_mask = 1 << (num_qubits - 1 - control)
        target_mask = 1 << (num_qubits - 1 - target)
        
        for i in range(len(state)):
            if i & control_mask:
                flipped = i ^ target_mask
                new_state[i] = state[flipped]
        return new_state

    def _apply_toffoli(self, state: cp.ndarray, num_qubits: int, controls: List[int], target: int) -> cp.ndarray:
        new_state = state.copy()
        control_masks = [1 << (num_qubits - 1 - c) for c in controls]
        target_mask = 1 << (num_qubits - 1 - target)
        
        for i in range(len(state)):
            if all(i & mask for mask in control_masks):
                flipped = i ^ target_mask
                new_state[i] = state[flipped]
        return new_state

    def get_probabilities(self, state: cp.ndarray) -> Dict[str, float]:
        num_qubits = int(cp.log2(len(state)))
        probs = cp.abs(state) ** 2
        probs_np = cp.asnumpy(probs)
        
        probabilities = {}
        for i in range(len(probs_np)):
            if probs_np[i] > 1e-10:
                bitstring = format(i, f'0{num_qubits}b')
                probabilities[bitstring] = float(probs_np[i])
        return probabilities

    def measure(self, state: cp.ndarray, shots: int = 1024) -> Dict[str, int]:
        num_qubits = int(cp.log2(len(state)))
        probabilities = cp.abs(state) ** 2
        probabilities = probabilities / cp.sum(probabilities)
        probs_np = cp.asnumpy(probabilities)
        
        results = {}
        for _ in range(shots):
            outcome = np.random.choice(len(probs_np), p=probs_np)
            bitstring = format(outcome, f'0{num_qubits}b')
            results[bitstring] = results.get(bitstring, 0) + 1
        return results

    def get_statevector(self, state: cp.ndarray) -> List[complex]:
        state_np = cp.asnumpy(state)
        return [complex(x) for x in state_np]

    def get_single_qubit_state(self, state: cp.ndarray, qubit: int) -> tuple:
        num_qubits = int(cp.log2(len(state)))
        alpha = 0.0 + 0.0j
        beta = 0.0 + 0.0j
        
        state_np = cp.asnumpy(state)
        for i in range(len(state_np)):
            if not ((i >> (num_qubits - 1 - qubit)) & 1):
                alpha += state_np[i]
            else:
                beta += state_np[i]
        
        norm = np.sqrt(np.abs(alpha)**2 + np.abs(beta)**2)
        if norm > 1e-10:
            alpha /= norm
            beta /= norm
        
        return alpha, beta
