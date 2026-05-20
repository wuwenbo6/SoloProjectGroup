from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List
import time

from app.core.database import get_db
from quantum.noise import NoiseModel, ErrorCorrection, export_to_qasm
from quantum.simulator import QuantumSimulator

router = APIRouter(prefix="/error-correction", tags=["error-correction"])


@router.get("/steane-code/circuit")
def get_steane_circuit():
    circuit = {
        "name": "Steane Code Encoding",
        "num_qubits": 7,
        "gates": [
            {"type": "H", "target": 0},
            {"type": "H", "target": 1},
            {"type": "H", "target": 2},
            {"type": "CNOT", "target": 3, "controls": [0]},
            {"type": "CNOT", "target": 4, "controls": [0]},
            {"type": "CNOT", "target": 5, "controls": [1]},
            {"type": "CNOT", "target": 6, "controls": [2]},
            {"type": "CNOT", "target": 4, "controls": [3]},
            {"type": "CNOT", "target": 5, "controls": [3]},
            {"type": "CNOT", "target": 6, "controls": [4]},
        ],
    }
    return circuit


@router.post("/steane-code/demonstrate")
def demonstrate_steane_code(
    noise_rate: float = 0.05,
    shots: int = 1024,
    db: Session = Depends(get_db),
):
    try:
        start_time = time.time()

        gates = [
            {"type": "H", "target": 0},
            {"type": "CNOT", "target": 1, "controls": [0]},
            {"type": "CNOT", "target": 2, "controls": [0]},
            {"type": "H", "target": 1},
            {"type": "H", "target": 2},
        ]

        noise_model_none = None
        simulator_none = QuantumSimulator(3, noise_model=noise_model_none)
        simulator_none.apply_circuit(gates)
        probs_none = simulator_none.get_probabilities()
        meas_none = simulator_none.measure(shots)

        noise_model_noisy = NoiseModel(depolarizing_rate=noise_rate)
        simulator_noisy = QuantumSimulator(3, noise_model=noise_model_noisy)
        simulator_noisy.apply_circuit(gates)
        probs_noisy = simulator_noisy.get_probabilities()
        meas_noisy = simulator_noisy.measure(shots)

        noisy_fidelity = max(probs_noisy.values(), default=0)

        gates7 = gates + [
            {"type": "CNOT", "target": 3, "controls": [0]},
            {"type": "CNOT", "target": 4, "controls": [0]},
            {"type": "CNOT", "target": 5, "controls": [1]},
            {"type": "CNOT", "target": 6, "controls": [2]},
        ]
        simulator_ec = QuantumSimulator(7, noise_model=noise_model_noisy)
        simulator_ec.apply_circuit(gates7)
        probs_ec = simulator_ec.get_probabilities()

        execution_time = time.time() - start_time

        return {
            "execution_time": execution_time,
            "noise_rate": noise_rate,
            "with_error_correction": {
                "probabilities": probs_ec,
                "description": "7-qubit Steane code encoded Bell state",
            },
            "without_noise": {
                "probabilities": probs_none,
                "measurements": meas_none,
            },
            "with_noise_no_ec": {
                "probabilities": probs_noisy,
                "measurements": meas_noisy,
                "fidelity": noisy_fidelity,
            },
            "stabilizers": ErrorCorrection.steane_code_stabilizers(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/noise-models")
def get_noise_models():
    return {
        "models": [
            {
                "name": "depolarizing",
                "description": "Random Pauli errors (X, Y, Z) with equal probability",
                "params": ["depolarizing_rate"],
                "range": [0, 0.5],
            },
            {
                "name": "amplitude_damping",
                "description": "Energy relaxation from |1> to |0>",
                "params": ["amplitude_damping"],
                "range": [0, 1],
            },
            {
                "name": "readout_error",
                "description": "Classical bit-flip during measurement readout",
                "params": ["readout_error"],
                "range": [0, 0.5],
            },
        ]
    }
