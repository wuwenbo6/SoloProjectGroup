from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson.objectid import ObjectId
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import uuid
import json
import asyncio

try:
    from qiskit import QuantumCircuit, transpile
    from qiskit_aer import AerSimulator
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

app = FastAPI(title="量子电路模拟器 API")

job_results_cache = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
client = MongoClient(MONGODB_URL)
db = client["quantum_simulator"]
circuits_collection = db["circuits"]

class Gate(BaseModel):
    type: str
    qubit: int
    target: Optional[int] = None

class Circuit(BaseModel):
    name: str
    num_qubits: int
    gates: List[Gate]

class CircuitResponse(BaseModel):
    id: str
    name: str
    num_qubits: int
    gates: List[Gate]

class QASMRequest(BaseModel):
    qasm: str
    backend: str = "aer_simulator"
    shots: int = 1024
    optimization_level: int = 1

class ExecuteRequest(BaseModel):
    num_qubits: int
    gates: List[Gate]
    backend: str = "local"
    shots: int = 1024

class JobResponse(BaseModel):
    job_id: str
    status: str
    backend: str
    shots: int
    created_at: str

class JobResult(JobResponse):
    counts: Optional[Dict[str, int]] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None

class BackendInfo(BaseModel):
    id: str
    name: str
    type: str
    provider: str
    qubits: int
    status: str = "available"
    avg_queue_time: Optional[int] = None

@app.get("/")
async def root():
    return {"message": "量子电路模拟器 API", "version": "1.0"}

@app.post("/api/circuits", response_model=CircuitResponse)
async def create_circuit(circuit: Circuit):
    circuit_dict = circuit.dict()
    result = circuits_collection.insert_one(circuit_dict)
    return CircuitResponse(
        id=str(result.inserted_id),
        name=circuit.name,
        num_qubits=circuit.num_qubits,
        gates=circuit.gates
    )

@app.get("/api/circuits", response_model=List[CircuitResponse])
async def get_all_circuits():
    circuits = []
    for circuit in circuits_collection.find():
        circuits.append(CircuitResponse(
            id=str(circuit["_id"]),
            name=circuit["name"],
            num_qubits=circuit["num_qubits"],
            gates=[Gate(**gate) for gate in circuit["gates"]]
        ))
    return circuits

@app.get("/api/circuits/{circuit_id}", response_model=CircuitResponse)
async def get_circuit(circuit_id: str):
    try:
        circuit = circuits_collection.find_one({"_id": ObjectId(circuit_id)})
        if not circuit:
            raise HTTPException(status_code=404, detail="电路未找到")
        return CircuitResponse(
            id=str(circuit["_id"]),
            name=circuit["name"],
            num_qubits=circuit["num_qubits"],
            gates=[Gate(**gate) for gate in circuit["gates"]]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的电路ID: {str(e)}")

@app.put("/api/circuits/{circuit_id}", response_model=CircuitResponse)
async def update_circuit(circuit_id: str, circuit: Circuit):
    try:
        result = circuits_collection.update_one(
            {"_id": ObjectId(circuit_id)},
            {"$set": circuit.dict()}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="电路未找到")
        return CircuitResponse(
            id=circuit_id,
            name=circuit.name,
            num_qubits=circuit.num_qubits,
            gates=circuit.gates
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"更新失败: {str(e)}")

@app.delete("/api/circuits/{circuit_id}")
async def delete_circuit(circuit_id: str):
    try:
        result = circuits_collection.delete_one({"_id": ObjectId(circuit_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="电路未找到")
        return {"message": "电路已成功删除", "id": circuit_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"删除失败: {str(e)}")

def gates_to_qasm(num_qubits: int, gates: List[Gate]) -> str:
    qasm = [
        "OPENQASM 2.0;",
        'include "qelib1.inc";',
        f"qreg q[{num_qubits}];",
        f"creg c[{num_qubits}];",
        ""
    ]
    
    gate_map = {
        'H': 'h', 'X': 'x', 'Y': 'y', 'Z': 'z', 'CNOT': 'cx'
    }
    
    for gate in gates:
        qasm_gate = gate_map.get(gate.type)
        if qasm_gate:
            if gate.type == 'CNOT':
                qasm.append(f"{qasm_gate} q[{gate.qubit}], q[{gate.target}];")
            else:
                qasm.append(f"{qasm_gate} q[{gate.qubit}];")
    
    for i in range(num_qubits):
        qasm.append(f"measure q[{i}] -> c[{i}];")
    
    return "\n".join(qasm)

async def run_qiskit_simulation(qasm: str, shots: int):
    if not QISKIT_AVAILABLE:
        raise HTTPException(status_code=500, detail="Qiskit not installed")
    
    start_time = datetime.now()
    
    try:
        qc = QuantumCircuit.from_qasm_str(qasm)
        simulator = AerSimulator()
        transpiled = transpile(qc, simulator, optimization_level=1)
        result = simulator.run(transpiled, shots=shots).result()
        counts = result.get_counts()
        
        counts_json = {k: int(v) for k, v in counts.items()}
        
        exec_time = (datetime.now() - start_time).total_seconds()
        return {"counts": counts_json, "execution_time": exec_time}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Qiskit execution failed: {str(e)}")

@app.get("/api/backends", response_model=List[BackendInfo])
async def get_backends():
    backends = [
        BackendInfo(
            id="local",
            name="Local JavaScript Simulator",
            type="local",
            provider="Local",
            qubits=15,
            status="available"
        ),
        BackendInfo(
            id="aer_simulator",
            name="Qiskit Aer Simulator",
            type="simulator",
            provider="IBM",
            qubits=32,
            status="available" if QISKIT_AVAILABLE else "unavailable"
        ),
        BackendInfo(
            id="aer_simulator_gpu",
            name="Qiskit Aer Simulator (GPU)",
            type="simulator",
            provider="IBM",
            qubits=32,
            status="available" if QISKIT_AVAILABLE else "unavailable"
        ),
        BackendInfo(
            id="aer_statevector",
            name="Qiskit Statevector Simulator",
            type="simulator",
            provider="IBM",
            qubits=20,
            status="available" if QISKIT_AVAILABLE else "unavailable"
        ),
        BackendInfo(
            id="ibmq_qasm_simulator",
            name="IBM Cloud QASM Simulator",
            type="cloud",
            provider="IBM",
            qubits=32,
            status="requires_api_key",
            avg_queue_time=15
        ),
        BackendInfo(
            id="ibm_perth",
            name="IBM Perth (7-qubit Hardware)",
            type="hardware",
            provider="IBM",
            qubits=7,
            status="requires_api_key",
            avg_queue_time=1800
        ),
        BackendInfo(
            id="ibm_lagos",
            name="IBM Lagos (7-qubit Hardware)",
            type="hardware",
            provider="IBM",
            qubits=7,
            status="requires_api_key",
            avg_queue_time=3600
        )
    ]
    return backends

@app.post("/api/execute", response_model=JobResponse)
async def execute_circuit(request: ExecuteRequest):
    job_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    
    qasm = gates_to_qasm(request.num_qubits, request.gates)
    
    job_info = {
        "job_id": job_id,
        "status": "running",
        "backend": request.backend,
        "shots": request.shots,
        "created_at": created_at,
        "qasm": qasm
    }
    job_results_cache[job_id] = job_info
    
    if request.backend in ["aer_simulator", "aer_simulator_gpu", "aer_statevector"]:
        asyncio.create_task(execute_qiskit_job(job_id, qasm, request.shots))
    else:
        job_results_cache[job_id]["status"] = "completed"
        job_results_cache[job_id]["counts"] = {}
        job_results_cache[job_id]["execution_time"] = 0
    
    return JobResponse(**job_info)

async def execute_qiskit_job(job_id: str, qasm: str, shots: int):
    try:
        result = await run_qiskit_simulation(qasm, shots)
        job_results_cache[job_id].update({
            "status": "completed",
            "counts": result["counts"],
            "execution_time": result["execution_time"]
        })
    except Exception as e:
        job_results_cache[job_id].update({
            "status": "error",
            "error": str(e)
        })

@app.post("/api/execute/qasm", response_model=JobResponse)
async def execute_qasm(request: QASMRequest):
    job_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    
    job_info = {
        "job_id": job_id,
        "status": "running",
        "backend": request.backend,
        "shots": request.shots,
        "created_at": created_at,
        "qasm": request.qasm
    }
    job_results_cache[job_id] = job_info
    
    asyncio.create_task(execute_qiskit_job(job_id, request.qasm, request.shots))
    
    return JobResponse(**job_info)

@app.get("/api/jobs/{job_id}", response_model=JobResult)
async def get_job_result(job_id: str):
    job = job_results_cache.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobResult(**job)

@app.get("/api/jobs")
async def get_all_jobs():
    return [
        {k: v for k, v in job.items() if k != 'qasm'}
        for job in job_results_cache.values()
    ]

@app.get("/api/qasm/generate")
async def generate_qasm(num_qubits: int, gates: str, name: str = "circuit"):
    try:
        gates_list = json.loads(gates)
        gate_objects = [Gate(**g) for g in gates_list]
        qasm = gates_to_qasm(num_qubits, gate_objects)
        return {
            "name": name,
            "qasm_2": qasm,
            "num_qubits": num_qubits,
            "num_gates": len(gate_objects)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate QASM: {str(e)}")

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    if job_id in job_results_cache:
        del job_results_cache[job_id]
        return {"message": "Job deleted", "job_id": job_id}
    raise HTTPException(status_code=404, detail="Job not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

