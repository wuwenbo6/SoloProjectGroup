import numpy as np
from typing import Dict, List, Optional


class CPUBackend:
    def __init__(self):
        self.xp = np

    def initialize_state(self, num_qubits: int) -> np.ndarray:
        if num_qubits <= 20:
            state = np.zeros(2 ** num_qubits, dtype=np.complex128)
            state[0] = 1.0
            return state
        else:
            return self._initialize_sparse_state(num_qubits)

    def _initialize_sparse_state(self, num_qubits: int) -> Dict:
        return {
            "type": "sparse",
            "num_qubits": num_qubits,
            "amplitudes": {0: 1.0 + 0.0j}
        }

    def apply_gate(self, state, gate_type: str, target: int, controls: Optional[List[int]] = None):
        controls = controls or []
        
        if isinstance(state, dict) and state.get("type") == "sparse":
            return self._apply_gate_sparse(state, gate_type, target, controls)
        else:
            return self._apply_gate_dense(state, gate_type, target, controls)

    def _apply_gate_dense(self, state: np.ndarray, gate_type: str, target: int, controls: List[int]) -> np.ndarray:
        num_qubits = int(np.log2(len(state)))
        
        if gate_type in ['H', 'X', 'Y', 'Z']:
            return self._apply_single_qubit_gate_dense(state, gate_type, num_qubits, target)
        elif gate_type == 'CNOT':
            return self._apply_cnot_dense(state, num_qubits, controls[0], target)
        elif gate_type == 'Toffoli':
            return self._apply_toffoli_dense(state, num_qubits, controls, target)
        else:
            raise ValueError(f"Unsupported gate type: {gate_type}")

    def _apply_single_qubit_gate_dense(self, state: np.ndarray, gate_type: str, num_qubits: int, target: int) -> np.ndarray:
        gate_map = {
            'H': np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2),
            'X': np.array([[0, 1], [1, 0]], dtype=np.complex128),
            'Y': np.array([[0, -1j], [1j, 0]], dtype=np.complex128),
            'Z': np.array([[1, 0], [0, -1]], dtype=np.complex128)
        }
        gate = gate_map[gate_type]
        
        target_mask = 1 << (num_qubits - 1 - target)
        other_mask = ((1 << num_qubits) - 1) ^ target_mask
        
        new_state = np.zeros_like(state)
        
        for i in range(1 << (num_qubits - 1)):
            base = i & other_mask
            idx0 = base
            idx1 = base | target_mask
            
            new_state[idx0] = gate[0, 0] * state[idx0] + gate[0, 1] * state[idx1]
            new_state[idx1] = gate[1, 0] * state[idx0] + gate[1, 1] * state[idx1]
        
        return new_state

    def _apply_cnot_dense(self, state: np.ndarray, num_qubits: int, control: int, target: int) -> np.ndarray:
        new_state = state.copy()
        control_mask = 1 << (num_qubits - 1 - control)
        target_mask = 1 << (num_qubits - 1 - target)
        
        for i in range(len(state)):
            if i & control_mask:
                flipped = i ^ target_mask
                new_state[i] = state[flipped]
        return new_state

    def _apply_toffoli_dense(self, state: np.ndarray, num_qubits: int, controls: List[int], target: int) -> np.ndarray:
        new_state = state.copy()
        control_masks = [1 << (num_qubits - 1 - c) for c in controls]
        target_mask = 1 << (num_qubits - 1 - target)
        
        for i in range(len(state)):
            if all(i & mask for mask in control_masks):
                flipped = i ^ target_mask
                new_state[i] = state[flipped]
        return new_state

    def _apply_gate_sparse(self, state: Dict, gate_type: str, target: int, controls: List[int]) -> Dict:
        num_qubits = state["num_qubits"]
        amplitudes = state["amplitudes"]
        new_amplitudes = {}
        
        if gate_type in ['H', 'X', 'Y', 'Z']:
            target_bit = num_qubits - 1 - target
            target_mask = 1 << target_bit
            
            gate_map = {
                'H': np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2),
                'X': np.array([[0, 1], [1, 0]], dtype=np.complex128),
                'Y': np.array([[0, -1j], [1j, 0]], dtype=np.complex128),
                'Z': np.array([[1, 0], [0, -1]], dtype=np.complex128)
            }
            gate = gate_map[gate_type]
            
            for idx, amp in amplitudes.items():
                bit = (idx >> target_bit) & 1
                other_idx = idx ^ target_mask
                
                if bit == 0:
                    new_amplitudes[idx] = new_amplitudes.get(idx, 0) + gate[0, 0] * amp
                    new_amplitudes[other_idx] = new_amplitudes.get(other_idx, 0) + gate[0, 1] * amp
                else:
                    new_amplitudes[other_idx] = new_amplitudes.get(other_idx, 0) + gate[1, 0] * amp
                    new_amplitudes[idx] = new_amplitudes.get(idx, 0) + gate[1, 1] * amp
        
        elif gate_type == 'CNOT':
            control_bit = num_qubits - 1 - controls[0]
            target_bit = num_qubits - 1 - target
            control_mask = 1 << control_bit
            target_mask = 1 << target_bit
            
            for idx, amp in amplitudes.items():
                if idx & control_mask:
                    new_idx = idx ^ target_mask
                    new_amplitudes[new_idx] = new_amplitudes.get(new_idx, 0) + amp
                else:
                    new_amplitudes[idx] = new_amplitudes.get(idx, 0) + amp
        
        elif gate_type == 'Toffoli':
            control_bits = [num_qubits - 1 - c for c in controls]
            control_masks = [1 << b for b in control_bits]
            target_bit = num_qubits - 1 - target
            target_mask = 1 << target_bit
            
            for idx, amp in amplitudes.items():
                if all(idx & mask for mask in control_masks):
                    new_idx = idx ^ target_mask
                    new_amplitudes[new_idx] = new_amplitudes.get(new_idx, 0) + amp
                else:
                    new_amplitudes[idx] = new_amplitudes.get(idx, 0) + amp
        
        cleaned_amplitudes = {k: v for k, v in new_amplitudes.items() if abs(v) > 1e-10}
        
        return {
            "type": "sparse",
            "num_qubits": num_qubits,
            "amplitudes": cleaned_amplitudes
        }

    def get_probabilities(self, state) -> Dict[str, float]:
        probabilities = {}
        
        if isinstance(state, dict) and state.get("type") == "sparse":
            num_qubits = state["num_qubits"]
            for idx, amp in state["amplitudes"].items():
                bitstring = format(idx, f'0{num_qubits}b')
                probabilities[bitstring] = float(abs(amp) ** 2)
        else:
            num_qubits = int(np.log2(len(state)))
            for i in range(len(state)):
                prob = abs(state[i]) ** 2
                if prob > 1e-10:
                    bitstring = format(i, f'0{num_qubits}b')
                    probabilities[bitstring] = float(prob)
        
        return probabilities

    def measure(self, state, shots: int = 1024) -> Dict[str, int]:
        if isinstance(state, dict) and state.get("type") == "sparse":
            return self._measure_sparse(state, shots)
        else:
            return self._measure_dense(state, shots)

    def _measure_dense(self, state: np.ndarray, shots: int) -> Dict[str, int]:
        num_qubits = int(np.log2(len(state)))
        probabilities = np.abs(state) ** 2
        probabilities = probabilities / np.sum(probabilities)
        
        results = {}
        outcomes = np.random.choice(len(state), size=shots, p=probabilities)
        for outcome in outcomes:
            bitstring = format(outcome, f'0{num_qubits}b')
            results[bitstring] = results.get(bitstring, 0) + 1
        return results

    def _measure_sparse(self, state: Dict, shots: int) -> Dict[str, int]:
        num_qubits = state["num_qubits"]
        amplitudes = state["amplitudes"]
        
        indices = list(amplitudes.keys())
        probs = [abs(amp) ** 2 for amp in amplitudes.values()]
        total = sum(probs)
        probs = [p / total for p in probs]
        
        results = {}
        for _ in range(shots):
            idx = indices[np.random.choice(len(indices), p=probs)]
            bitstring = format(idx, f'0{num_qubits}b')
            results[bitstring] = results.get(bitstring, 0) + 1
        return results

    def get_statevector(self, state) -> List[complex]:
        if isinstance(state, dict) and state.get("type") == "sparse":
            num_qubits = state["num_qubits"]
            statevector = [0 + 0j] * (2 ** num_qubits)
            for idx, amp in state["amplitudes"].items():
                if idx < len(statevector):
                    statevector[idx] = amp
            return statevector
        else:
            return [complex(x) for x in state]

    def get_single_qubit_state(self, state, qubit: int, num_qubits: int = None) -> tuple:
        if num_qubits is None:
            if isinstance(state, dict) and state.get("type") == "sparse":
                num_qubits = state["num_qubits"]
            else:
                num_qubits = int(np.log2(len(state)))
        
        alpha = 0.0 + 0.0j
        beta = 0.0 + 0.0j
        
        if isinstance(state, dict) and state.get("type") == "sparse":
            target_bit = num_qubits - 1 - qubit
            for idx, amp in state["amplitudes"].items():
                if not ((idx >> target_bit) & 1):
                    alpha += amp
                else:
                    beta += amp
        else:
            target_bit = num_qubits - 1 - qubit
            target_mask = 1 << target_bit
            for i in range(len(state)):
                if not (i & target_mask):
                    alpha += state[i]
                else:
                    beta += state[i]
        
        norm = np.sqrt(abs(alpha) ** 2 + abs(beta) ** 2)
        if norm > 1e-10:
            alpha /= norm
            beta /= norm
        
        return alpha, beta
