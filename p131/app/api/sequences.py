from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import List
from app.models.schemas import SequenceCreate, SequenceResponse, DatabaseStats
from app.services.sequence_service import SequenceService
from app.algorithms.fasta_parser import parse_fasta, guess_sequence_type

router = APIRouter(prefix="/sequences", tags=["sequences"])


@router.post("/", response_model=SequenceResponse)
async def create_sequence(sequence: SequenceCreate):
    existing = await SequenceService.get_sequence(sequence.seq_id)
    if existing:
        raise HTTPException(status_code=400, detail=f"Sequence ID {sequence.seq_id} already exists")
    
    seq_type = guess_sequence_type(sequence.sequence)
    if seq_type == 'UNKNOWN':
        raise HTTPException(status_code=400, detail="Invalid sequence type")
    
    sequence_data = sequence.dict()
    sequence_data['seq_type'] = seq_type
    
    result = await SequenceService.create_sequence(sequence_data)
    return result


@router.post("/upload-fasta")
async def upload_fasta(file: UploadFile = File(...)):
    content = await file.read()
    content = content.decode('utf-8')
    
    sequences = parse_fasta(content)
    created_count = 0
    
    for seq in sequences:
        seq_id = seq['header'].split()[0]
        seq_type = guess_sequence_type(seq['sequence'])
        
        if seq_type != 'UNKNOWN':
            existing = await SequenceService.get_sequence(seq_id)
            if not existing:
                seq_data = {
                    'seq_id': seq_id,
                    'header': seq['header'],
                    'sequence': seq['sequence'],
                    'seq_type': seq_type,
                    'description': seq['header']
                }
                await SequenceService.create_sequence(seq_data)
                created_count += 1
    
    return {
        'parsed_count': len(sequences),
        'created_count': created_count
    }


@router.get("/{seq_id}", response_model=SequenceResponse)
async def get_sequence(seq_id: str):
    seq = await SequenceService.get_sequence(seq_id)
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return seq


@router.get("/")
async def list_sequences(skip: int = 0, limit: int = Query(20, le=100)):
    sequences, total = await SequenceService.get_all_sequences(skip, limit)
    return {
        'sequences': sequences,
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': skip + limit < total
    }


@router.delete("/{seq_id}")
async def delete_sequence(seq_id: str):
    deleted = await SequenceService.delete_sequence(seq_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return {"message": "Sequence deleted successfully"}


@router.get("/stats", response_model=DatabaseStats)
async def get_stats():
    stats = await SequenceService.get_stats()
    return stats
