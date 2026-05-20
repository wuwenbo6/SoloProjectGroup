from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import uuid
import json
import pickle
import math
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import UPLOAD_DIR, RESULT_DIR, GRNA_LENGTH, CRISPR_MODE_CAS9, CRISPR_MODE_DCAS9
from aligner.aligner import find_offtargets
from scorer.scorer import score_offtargets, export_bed
from annotator.gtf_parser import GTFParser, prioritize_offtargets

router = APIRouter()

CHUNK_SIZE = 100
GTF_DIR = UPLOAD_DIR / "gtf"
GTF_DIR.mkdir(exist_ok=True)

PRIORITIZATION_JOBS = {}

class AnalysisRequest(BaseModel):
    grna: str
    fasta_filename: str
    use_bwa: bool = True
    mode: str = CRISPR_MODE_CAS9

class JobStatus(BaseModel):
    job_id: str
    status: str
    message: str = ""

jobs = {}

def save_chunked_results(job_id: str, grna: str, fasta_file: str, offtargets: list, mode: str):
    job_dir = RESULT_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    total_chunks = math.ceil(len(offtargets) / CHUNK_SIZE)
    
    metadata = {
        'grna': grna,
        'fasta_file': fasta_file,
        'mode': mode,
        'total_count': len(offtargets),
        'total_chunks': total_chunks,
        'chunk_size': CHUNK_SIZE,
        'ontarget_count': sum(1 for ot in offtargets if ot['is_ontarget']),
        'offtarget_count': sum(1 for ot in offtargets if not ot['is_ontarget'])
    }
    
    with open(job_dir / "metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)
    
    for i in range(total_chunks):
        start_idx = i * CHUNK_SIZE
        end_idx = min(start_idx + CHUNK_SIZE, len(offtargets))
        chunk = offtargets[start_idx:end_idx]
        
        with open(job_dir / f"chunk_{i:04d}.pkl", 'wb') as f:
            pickle.dump(chunk, f)
    
    all_bed_path = RESULT_DIR / f"{job_id}.bed"
    export_bed(offtargets, all_bed_path, grna[:8])

@router.post("/upload")
async def upload_fasta(file: UploadFile = File(...)):
    if not file.filename.endswith(('.fasta', '.fa', '.fna')):
        raise HTTPException(status_code=400, detail="File must be FASTA format")
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    
    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)
    
    return {
        "success": True,
        "filename": file.filename,
        "stored_filename": f"{file_id}_{file.filename}",
        "size": len(content)
    }

@router.post("/analyze")
async def analyze_offtargets(request: AnalysisRequest, background_tasks: BackgroundTasks):
    if len(request.grna) != GRNA_LENGTH:
        raise HTTPException(status_code=400, detail=f"gRNA must be exactly {GRNA_LENGTH}bp")
    
    if request.mode not in [CRISPR_MODE_CAS9, CRISPR_MODE_DCAS9]:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Must be '{CRISPR_MODE_CAS9}' or '{CRISPR_MODE_DCAS9}'")
    
    fasta_path = UPLOAD_DIR / request.fasta_filename
    if not fasta_path.exists():
        raise HTTPException(status_code=404, detail="FASTA file not found")
    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "running", "result": None}
    
    def run_analysis():
        try:
            offtargets = find_offtargets(request.grna, fasta_path, request.mode, request.use_bwa)
            scored = score_offtargets(request.grna, offtargets, request.mode)
            
            save_chunked_results(job_id, request.grna, request.fasta_filename, scored, request.mode)
            
            jobs[job_id] = {
                "status": "completed",
                "total_count": len(scored),
                "mode": request.mode
            }
        except Exception as e:
            jobs[job_id] = {"status": "failed", "error": str(e)}
    
    background_tasks.add_task(run_analysis)
    
    return {"job_id": job_id, "status": "running", "mode": request.mode}

@router.get("/status/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@router.get("/results/{job_id}/metadata")
async def get_results_metadata(job_id: str):
    metadata_path = RESULT_DIR / job_id / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Results not found")
    
    with open(metadata_path, 'r') as f:
        return json.load(f)

@router.get("/results/{job_id}/page")
async def get_results_paginated(
    job_id: str,
    page: int = Query(0, ge=0, description="Page number, starting from 0"),
    page_size: int = Query(100, ge=10, le=500, description="Items per page")
):
    job_dir = RESULT_DIR / job_id
    metadata_path = job_dir / "metadata.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Results not found")
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    total_pages = math.ceil(metadata["total_count"] / page_size)
    
    if page >= total_pages:
        raise HTTPException(status_code=400, detail=f"Page {page} out of range. Total pages: {total_pages}")
    
    start_idx = page * page_size
    end_idx = min(start_idx + page_size, metadata["total_count"])
    
    chunk_start = start_idx // CHUNK_SIZE
    chunk_end = (end_idx - 1) // CHUNK_SIZE
    
    results = []
    for chunk_idx in range(chunk_start, chunk_end + 1):
        chunk_file = job_dir / f"chunk_{chunk_idx:04d}.pkl"
        if chunk_file.exists():
            with open(chunk_file, 'rb') as f:
                chunk_data = pickle.load(f)
                results.extend(chunk_data)
    
    offset_in_first_chunk = start_idx % CHUNK_SIZE
    results = results[offset_in_first_chunk:offset_in_first_chunk + (end_idx - start_idx)]
    
    return {
        "grna": metadata["grna"],
        "page": page,
        "page_size": page_size,
        "total_count": metadata["total_count"],
        "total_pages": total_pages,
        "offtargets": results
    }

@router.get("/results/{job_id}/all")
async def get_all_results(job_id: str):
    job_dir = RESULT_DIR / job_id
    metadata_path = job_dir / "metadata.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Results not found")
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    all_results = []
    for chunk_idx in range(metadata["total_chunks"]):
        chunk_file = job_dir / f"chunk_{chunk_idx:04d}.pkl"
        if chunk_file.exists():
            with open(chunk_file, 'rb') as f:
                chunk_data = pickle.load(f)
                all_results.extend(chunk_data)
    
    return {
        "grna": metadata["grna"],
        "fasta_file": metadata["fasta_file"],
        "total_count": metadata["total_count"],
        "offtargets": all_results
    }

@router.get("/results/{job_id}/top")
async def get_top_results(
    job_id: str,
    limit: int = Query(200, ge=10, le=1000, description="Number of top results by score")
):
    job_dir = RESULT_DIR / job_id
    metadata_path = job_dir / "metadata.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Results not found")
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    top_results = []
    for chunk_idx in range(metadata["total_chunks"]):
        chunk_file = job_dir / f"chunk_{chunk_idx:04d}.pkl"
        if chunk_file.exists():
            with open(chunk_file, 'rb') as f:
                chunk_data = pickle.load(f)
                top_results.extend(chunk_data)
                if len(top_results) >= limit:
                    break
    
    return {
        "grna": metadata["grna"],
        "count": min(limit, len(top_results)),
        "offtargets": top_results[:limit]
    }

@router.get("/export/bed/{job_id}")
async def export_bed_file(job_id: str):
    bed_path = RESULT_DIR / f"{job_id}.bed"
    if not bed_path.exists():
        raise HTTPException(status_code=404, detail="BED file not found")
    
    return FileResponse(
        bed_path,
        media_type="text/bed",
        filename=f"offtargets_{job_id[:8]}.bed"
    )

@router.get("/uploads")
async def list_uploads():
    files = []
    for f in UPLOAD_DIR.glob("*"):
        if f.is_file():
            files.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "created": f.stat().st_ctime
            })
    return files

@router.delete("/uploads/{filename}")
async def delete_upload(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    file_path.unlink()
    return {"success": True, "message": "File deleted"}

class PrioritizationRequest(BaseModel):
    job_id: str
    gtf_filename: str
    top_n: int = 100

@router.post("/upload/gtf")
async def upload_gtf(file: UploadFile = File(...)):
    if not file.filename.endswith(('.gtf', '.gtf.gz', '.gff')):
        raise HTTPException(status_code=400, detail="File must be GTF/GFF format")
    
    file_id = str(uuid.uuid4())
    file_path = GTF_DIR / f"{file_id}_{file.filename}"
    
    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)
    
    return {
        "success": True,
        "filename": file.filename,
        "stored_filename": f"{file_id}_{file.filename}",
        "size": len(content)
    }

@router.post("/prioritize")
async def prioritize_offtarget_sites(request: PrioritizationRequest, background_tasks: BackgroundTasks):
    job_id = request.job_id
    gtf_filename = request.gtf_filename
    
    job_dir = RESULT_DIR / job_id
    metadata_path = job_dir / "metadata.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Analysis results not found")
    
    gtf_path = GTF_DIR / gtf_filename
    if not gtf_path.exists():
        raise HTTPException(status_code=404, detail="GTF file not found")
    
    priority_job_id = str(uuid.uuid4())
    PRIORITIZATION_JOBS[priority_job_id] = {"status": "running", "job_id": job_id}
    
    def run_prioritization():
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            all_offtargets = []
            for chunk_idx in range(metadata["total_chunks"]):
                chunk_file = job_dir / f"chunk_{chunk_idx:04d}.pkl"
                if chunk_file.exists():
                    with open(chunk_file, 'rb') as f:
                        chunk_data = pickle.load(f)
                        all_offtargets.extend(chunk_data)
            
            gtf_parser = GTFParser(gtf_path)
            
            prioritized = prioritize_offtargets(all_offtargets, gtf_parser, request.top_n)
            
            priority_result = {
                "original_job_id": job_id,
                "gtf_file": gtf_filename,
                "total_analyzed": len(all_offtargets),
                "top_n": request.top_n,
                "prioritized_sites": prioritized,
                "risk_distribution": {
                    "CRITICAL": sum(1 for p in prioritized if p["risk_category"] == "CRITICAL"),
                    "HIGH": sum(1 for p in prioritized if p["risk_category"] == "HIGH"),
                    "MEDIUM": sum(1 for p in prioritized if p["risk_category"] == "MEDIUM"),
                    "LOW": sum(1 for p in prioritized if p["risk_category"] == "LOW")
                },
                "feature_distribution": {
                    "CDS": sum(1 for p in prioritized if p["functional_risk"]["max_feature_type"] == "CDS"),
                    "UTR5": sum(1 for p in prioritized if p["functional_risk"]["max_feature_type"] == "UTR5"),
                    "UTR3": sum(1 for p in prioritized if p["functional_risk"]["max_feature_type"] == "UTR3"),
                    "exon": sum(1 for p in prioritized if p["functional_risk"]["max_feature_type"] == "exon"),
                    "intron": sum(1 for p in prioritized if p["functional_risk"]["max_feature_type"] == "intron"),
                    "intergenic": sum(1 for p in prioritized if p["functional_risk"]["max_feature_type"] == "intergenic")
                }
            }
            
            priority_file = RESULT_DIR / f"{job_id}_priority.pkl"
            with open(priority_file, 'wb') as f:
                pickle.dump(priority_result, f)
            
            PRIORITIZATION_JOBS[priority_job_id] = {
                "status": "completed",
                "result": priority_result
            }
            
        except Exception as e:
            PRIORITIZATION_JOBS[priority_job_id] = {
                "status": "failed",
                "error": str(e)
            }
    
    background_tasks.add_task(run_prioritization)
    
    return {"priority_job_id": priority_job_id, "status": "running"}

@router.get("/prioritize/status/{priority_job_id}")
async def get_prioritization_status(priority_job_id: str):
    if priority_job_id not in PRIORITIZATION_JOBS:
        raise HTTPException(status_code=404, detail="Prioritization job not found")
    return PRIORITIZATION_JOBS[priority_job_id]

@router.get("/prioritize/results/{priority_job_id}")
async def get_prioritization_results(priority_job_id: str):
    if priority_job_id not in PRIORITIZATION_JOBS:
        raise HTTPException(status_code=404, detail="Prioritization job not found")
    
    job_data = PRIORITIZATION_JOBS[priority_job_id]
    
    if job_data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Prioritization not completed yet")
    
    return job_data["result"]

@router.get("/gtf")
async def list_gtf_files():
    files = []
    for f in GTF_DIR.glob("*"):
        if f.is_file():
            files.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "created": f.stat().st_ctime
            })
    return files

@router.delete("/gtf/{filename}")
async def delete_gtf(filename: str):
    file_path = GTF_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="GTF file not found")
    file_path.unlink()
    return {"success": True, "message": "GTF file deleted"}
