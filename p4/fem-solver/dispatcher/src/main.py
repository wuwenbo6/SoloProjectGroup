from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import uuid
import os
import json
import asyncio
import aiohttp
from parser import INPParser
from splitter import MeshSplitter
import sys
sys.path.append('../../aggregator/src')
from merger import ResultMerger
from exporter import VTKExporter

app = FastAPI(title="FEM Solver Dispatcher")

UPLOAD_DIR = "uploads"
RESULTS_DIR = "results"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

tasks: Dict[str, Dict[str, Any]] = {}
compute_nodes: List[str] = ["http://localhost:8001", "http://localhost:8002"]

class TaskStatus(BaseModel):
    task_id: str
    status: str
    progress: float
    subdomain_count: int
    completed_subdomains: int

class ComputeNodeRegister(BaseModel):
    url: str

@app.post("/upload", response_description="Upload FEM model file")
async def upload_model(file: UploadFile = File(...)):
    if not file.filename.endswith('.inp'):
        raise HTTPException(status_code=400, detail="Only .inp files are supported")
    
    task_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{task_id}.inp")
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    tasks[task_id] = {
        "status": "uploaded",
        "progress": 0.0,
        "file_path": file_path,
        "model_data": None,
        "subdomains": None,
        "subdomain_count": 0,
        "completed_subdomains": 0,
        "results": [],
        "final_result": None
    }
    
    return {"task_id": task_id, "filename": file.filename, "status": "uploaded"}

@app.post("/solve/{task_id}", response_description="Start solving the FEM model")
async def start_solve(task_id: str, num_subdomains: int = 4):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    task["status"] = "parsing"
    task["progress"] = 10.0
    
    parser = INPParser()
    model_data = parser.parse(task["file_path"])
    task["model_data"] = model_data
    
    task["status"] = "splitting"
    task["progress"] = 20.0
    
    splitter = MeshSplitter(num_subdomains=num_subdomains)
    subdomains = splitter.split(model_data)
    task["subdomains"] = subdomains
    task["subdomain_count"] = len(subdomains)
    
    task["status"] = "distributing"
    task["progress"] = 30.0
    
    asyncio.create_task(distribute_tasks(task_id, subdomains))
    
    return {
        "task_id": task_id,
        "status": "solving",
        "subdomain_count": len(subdomains),
        "subdomain_sizes": splitter.get_subdomain_sizes(subdomains)
    }

async def distribute_tasks(task_id: str, subdomains: List[Dict[str, Any]]):
    task = tasks[task_id]
    semaphore = asyncio.Semaphore(len(compute_nodes))
    
    async def solve_subdomain(subdomain: Dict[str, Any]):
        async with semaphore:
            subdomain_id = subdomain["subdomain_id"]
            node_url = compute_nodes[subdomain_id % len(compute_nodes)]
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{node_url}/solve",
                        json={"subdomain": subdomain},
                        timeout=aiohttp.ClientTimeout(total=3600)
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            task["results"].append(result)
                            task["completed_subdomains"] += 1
                            task["progress"] = 30.0 + 60.0 * (task["completed_subdomains"] / task["subdomain_count"])
                        else:
                            print(f"Error solving subdomain {subdomain_id}: {response.status}")
            except Exception as e:
                print(f"Exception solving subdomain {subdomain_id}: {e}")
    
    await asyncio.gather(*[solve_subdomain(sd) for sd in subdomains])
    
    if task["completed_subdomains"] == task["subdomain_count"]:
        task["status"] = "aggregating"
        task["progress"] = 90.0
        
        merger = ResultMerger()
        final_result = merger.merge(task["model_data"], task["results"])
        task["final_result"] = final_result
        
        json_result = merger.serialize_for_json(final_result)
        json_path = os.path.join(RESULTS_DIR, f"{task_id}_merged.json")
        with open(json_path, 'w') as f:
            json.dump(json_result, f, indent=2)
        
        exporter = VTKExporter()
        vtk_path = os.path.join(RESULTS_DIR, f"{task_id}.vtk")
        exporter.export(final_result, vtk_path)
        
        task["status"] = "completed"
        task["progress"] = 100.0

@app.get("/status/{task_id}", response_model=TaskStatus)
async def get_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "subdomain_count": task["subdomain_count"],
        "completed_subdomains": task["completed_subdomains"]
    }

@app.get("/download/{task_id}")
async def download_results(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Task not completed yet")
    
    vtk_path = os.path.join(RESULTS_DIR, f"{task_id}.vtk")
    if not os.path.exists(vtk_path):
        raise HTTPException(status_code=404, detail="Result file not found")
    
    return FileResponse(
        path=vtk_path,
        filename=f"result_{task_id}.vtk",
        media_type="application/octet-stream"
    )

@app.post("/register-compute-node")
async def register_compute_node(node: ComputeNodeRegister):
    if node.url not in compute_nodes:
        compute_nodes.append(node.url)
    return {"status": "registered", "compute_nodes": compute_nodes}

@app.get("/compute-nodes")
async def get_compute_nodes():
    return {"compute_nodes": compute_nodes}

@app.get("/visualizer")
async def visualizer():
    template_path = os.path.join(os.path.dirname(__file__), "..", "templates", "visualizer.html")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Visualizer template not found")
    return FileResponse(template_path, media_type="text/html")

@app.get("/api/visualization/{task_id}")
async def get_visualization_data(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Task not completed yet")
    
    result_path = os.path.join(RESULTS_DIR, f"{task_id}_merged.json")
    if not os.path.exists(result_path):
        raise HTTPException(status_code=404, detail="Result data not found")
    
    with open(result_path, 'r') as f:
        merged_result = json.load(f)
    
    return {
        "nodes": merged_result.get("nodes", {}),
        "elements": merged_result.get("elements", {}),
        "displacements": merged_result.get("displacements", {}),
        "stresses": merged_result.get("stresses", {})
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
