from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from typing import List, Optional
import io

from app.algorithms.cd_hit import cluster_sequences, CDHIT
from app.algorithms.crispr_finder import find_crispr_sites, CRISPRFinder
from app.algorithms.fasta_parser import parse_fasta
from app.services.export_service import ExportService
from app.services.sequence_service import SequenceService
from app.core.database import get_database

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/cluster")
async def cluster_endpoint(
    file: Optional[UploadFile] = File(None),
    threshold: float = Query(0.9, ge=0.5, le=1.0),
    seq_type: str = Query("DNA", description="DNA or PROTEIN")
):
    """Cluster sequences using CD-HIT algorithm"""
    
    sequences = []
    
    if file:
        content = await file.read()
        content = content.decode('utf-8')
        parsed = parse_fasta(content)
        for seq in parsed:
            sequences.append({
                'seq_id': seq['header'].split()[0],
                'header': seq['header'],
                'sequence': seq['sequence']
            })
    else:
        db = await get_database()
        cursor = db.sequences.find({'seq_type': seq_type})
        async for seq in cursor:
            sequences.append({
                'seq_id': seq['seq_id'],
                'header': seq['header'],
                'sequence': seq['sequence']
            })
    
    if not sequences:
        raise HTTPException(status_code=400, detail="No sequences provided or found in database")
    
    clusters, stats = cluster_sequences(sequences, threshold=threshold)
    
    return {
        'clusters': clusters,
        'statistics': stats,
        'num_sequences': len(sequences)
    }


@router.post("/cluster/export")
async def export_clustering_results(
    file: Optional[UploadFile] = File(None),
    threshold: float = Query(0.9, ge=0.5, le=1.0),
    seq_type: str = Query("DNA", description="DNA or PROTEIN"),
    format_type: str = Query("json", description="json, csv, or fasta"),
    export_type: str = Query("full", description="full or representatives")
):
    """Export clustering results"""
    
    sequences = []
    
    if file:
        content = await file.read()
        content = content.decode('utf-8')
        parsed = parse_fasta(content)
        for seq in parsed:
            sequences.append({
                'seq_id': seq['header'].split()[0],
                'header': seq['header'],
                'sequence': seq['sequence']
            })
    else:
        db = await get_database()
        cursor = db.sequences.find({'seq_type': seq_type})
        async for seq in cursor:
            sequences.append({
                'seq_id': seq['seq_id'],
                'header': seq['header'],
                'sequence': seq['sequence']
            })
    
    if not sequences:
        raise HTTPException(status_code=400, detail="No sequences provided or found in database")
    
    clusters, stats = cluster_sequences(sequences, threshold=threshold)
    
    if export_type == 'representatives':
        content = ExportService.export_cluster_representatives(clusters, format_type)
    else:
        content = ExportService.export_clustering_results(clusters, format_type)
    
    media_type = 'application/json' if format_type == 'json' else 'text/csv'
    if format_type == 'fasta':
        media_type = 'text/plain'
    
    filename = f"clustering_results.{format_type}"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/crispr")
async def crispr_analysis(
    file: Optional[UploadFile] = File(None),
    sequence: Optional[str] = None,
    pam_type: str = Query("SpCas9", description="PAM type: SpCas9, Cas12a, NGG")
):
    """Analyze CRISPR sites in sequence"""
    
    seq = ""
    
    if file:
        content = await file.read()
        content = content.decode('utf-8')
        parsed = parse_fasta(content)
        if parsed:
            seq = parsed[0]['sequence']
    elif sequence:
        seq = sequence.upper()
    else:
        raise HTTPException(status_code=400, detail="No sequence provided")
    
    if not seq:
        raise HTTPException(status_code=400, detail="Invalid sequence")
    
    results = find_crispr_sites(seq)
    
    return results


@router.post("/crispr/export")
async def export_crispr_results(
    file: Optional[UploadFile] = File(None),
    sequence: Optional[str] = None,
    format_type: str = Query("json", description="json or csv")
):
    """Export CRISPR analysis results"""
    
    seq = ""
    
    if file:
        content = await file.read()
        content = content.decode('utf-8')
        parsed = parse_fasta(content)
        if parsed:
            seq = parsed[0]['sequence']
    elif sequence:
        seq = sequence.upper()
    else:
        raise HTTPException(status_code=400, detail="No sequence provided")
    
    if not seq:
        raise HTTPException(status_code=400, detail="Invalid sequence")
    
    results = find_crispr_sites(seq)
    content = ExportService.export_crispr_results(results, format_type)
    
    media_type = 'application/json' if format_type == 'json' else 'text/csv'
    filename = f"crispr_results.{format_type}"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/pam-types")
async def get_pam_types():
    """Get available PAM types"""
    return {
        'pam_types': [
            {'name': 'SpCas9', 'pattern': 'NGG'},
            {'name': 'Cas9', 'pattern': 'NGG'},
            {'name': 'Cas12a', 'pattern': 'TTTV'},
            {'name': 'NGG', 'pattern': 'NGG'}
        ]
    }


@router.post("/export/alignment")
async def export_alignment_endpoint(
    format_type: str = Query("json", description="json or csv")
):
    """Export alignment results (placeholder - would integrate with actual alignment jobs)"""
    return {"message": "Alignment export endpoint - integrate with actual alignment jobs"}
