from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from app.models.schemas import (
    AlignmentRequest, AlignmentJobResponse, TaskStatus
)
from app.services.sequence_service import SequenceService
from app.tasks.alignment_tasks import (
    align_single_sequence,
    align_sequence_with_job,
    get_task_status
)

router = APIRouter(prefix="/alignment", tags=["alignment"])


@router.post("/submit", response_model=dict)
async def submit_alignment(alignment_request: AlignmentRequest):
    job_data = {
        'sequence': alignment_request.sequence,
        'seq_type': alignment_request.seq_type,
        'evalue_threshold': alignment_request.evalue_threshold
    }
    
    job_id = await SequenceService.create_alignment_job(job_data)
    
    task = align_sequence_with_job.delay(
        job_id,
        alignment_request.sequence,
        alignment_request.seq_type,
        alignment_request.evalue_threshold
    )
    
    return {
        'job_id': job_id,
        'task_id': task.id,
        'message': 'Alignment job submitted successfully'
    }


@router.post("/submit-fasta")
async def submit_fasta_alignment(file: UploadFile = File(...), seq_type: str = 'DNA', evalue_threshold: float = 10.0):
    content = await file.read()
    content = content.decode('utf-8')
    
    from app.algorithms.fasta_parser import parse_fasta
    sequences = parse_fasta(content)
    
    if not sequences:
        raise HTTPException(status_code=400, detail="No sequences found in FASTA file")
    
    results = []
    for seq in sequences:
        job_data = {
            'sequence': seq['sequence'],
            'seq_type': seq_type,
            'evalue_threshold': evalue_threshold,
            'header': seq['header']
        }
        
        job_id = await SequenceService.create_alignment_job(job_data)
        
        task = align_sequence_with_job.delay(
            job_id,
            seq['sequence'],
            seq_type,
            evalue_threshold
        )
        
        results.append({
            'header': seq['header'],
            'job_id': job_id,
            'task_id': task.id
        })
    
    return {
        'submitted_count': len(results),
        'jobs': results
    }


@router.get("/job/{job_id}", response_model=AlignmentJobResponse)
async def get_alignment_job(job_id: str):
    job = await SequenceService.get_alignment_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/task/{task_id}", response_model=TaskStatus)
async def get_task_status_endpoint(task_id: str):
    status = get_task_status(task_id)
    return status


@router.post("/sync", response_model=dict)
async def sync_alignment(alignment_request: AlignmentRequest):
    blast = SequenceService.load_blast_instance(alignment_request.seq_type)
    results = blast.align_single(
        alignment_request.sequence,
        alignment_request.evalue_threshold
    )
    
    return {
        'query_length': len(alignment_request.sequence),
        'results_count': len(results),
        'results': results
    }
