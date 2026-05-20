import time
from typing import Dict, List, Optional
from .cpu_backend import CPUBackend
from .noise import NoiseModel

try:
    from .cuda_backend import CUDABackend
    CUDA_AVAILABLE = True
except ImportError:
    CUDA_AVAILABLE = False


class QuantumSimulator:
    def __init__(self, num_qubits: int, use_cuda: bool = False, noise_model: Optional[NoiseModel] = None):
        self.num_qubits = num_qubits
        self.use_cuda = use_cuda and CUDA_AVAILABLE
        self.noise_model = noise_model

        if self.use_cuda:
            self.backend = CUDABackend()
        else:
            self.backend = CPUBackend()

        self.state = self.backend.initialize_state(num_qubits)

    def apply_gate(self, gate_type: str, target: int, controls: Optional[List[int]] = None):
        controls = controls or []
        self.state = self.backend.apply_gate(self.state, gate_type, target, controls)

        if self.noise_model:
            affected_qubits = [target] + controls
            affected_qubits = list(set(affected_qubits))
            for q in affected_qubits:
                if q < self.num_qubits:
                    self.state = self.noise_model.apply_all_noise(
                        self.state, [q], self.num_qubits
                    )

    def apply_circuit(self, gates: List[Dict]):
        for gate in gates:
            gate_type = gate.get("type")
            target = gate.get("target")
            controls = gate.get("controls", [])
            self.apply_gate(gate_type, target, controls)

    def get_probabilities(self) -> Dict[str, float]:
        return self.backend.get_probabilities(self.state)

    def measure(self, shots: int = 1024) -> Dict[str, int]:
        measurements = self.backend.measure(self.state, shots)

        if self.noise_model and self.noise_model.readout_error > 0:
            measurements = self.noise_model.apply_readout_error(measurements)

        return measurements

    def get_statevector(self) -> List[complex]:
        return self.backend.get_statevector(self.state)

    def get_single_qubit_state(self, qubit: int) -> tuple:
        return self.backend.get_single_qubit_state(self.state, qubit, self.num_qubits)

    def get_bloch_coordinates(self, qubit: int) -> Dict[str, float]:
        alpha, beta = self.get_single_qubit_state(qubit)

        x = 2 * (alpha.conjugate() * beta).real
        y = 2 * (alpha.conjugate() * beta).imag
        z = abs(alpha) ** 2 - abs(beta) ** 2

        return {"x": x, "y": y, "z": z}

    def reset(self):
        self.state = self.backend.initialize_state(self.num_qubits)


def simulate_circuit(
    num_qubits: int,
    gates: List[Dict],
    shots: int = 1024,
    use_cuda: bool = False,
    noise_model: Optional[NoiseModel] = None,
) -> Dict:
    start_time = time.time()

    simulator = QuantumSimulator(num_qubits, use_cuda, noise_model)
    simulator.apply_circuit(gates)

    probabilities = simulator.get_probabilities()
    measurements = simulator.measure(shots)

    bloch_spheres = []
    for q in range(min(num_qubits, 5)):
        bloch_spheres.append(simulator.get_bloch_coordinates(q))

    execution_time = time.time() - start_time

    return {
        "num_qubits": num_qubits,
        "probabilities": probabilities,
        "measurements": measurements,
        "bloch_spheres": bloch_spheres,
        "execution_time": execution_time,
        "noise_applied": noise_model is not None,
    }
